import { addonService } from '../../src/services/addon';
import { describe, it, expect, beforeAll } from '@jest/globals';

describe('Addon Integration - Fixed ID System', () => {
  beforeAll(async () => {
    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  it('should complete full catalog -> meta -> stream flow successfully', async () => {
    // 1. Get catalog
    const catalogResult = await addonService.getCatalog({
      type: 'anime',
      id: 'nyaa-anime-all',
      extra: {}
    });

    expect(catalogResult.metas).toBeDefined();
    expect(catalogResult.metas.length).toBeGreaterThan(0);

    const firstItem = catalogResult.metas[0]!;
    
    // Verify ID format is fixed (should be nyaa:hash, not encoded title)
    expect(firstItem.id).toMatch(/^nyaa:[a-f0-9]{40}|[A-Za-z0-9+/=]{20}$/);
    expect(firstItem.id).not.toContain('%5B'); // Should not contain URL encoding
    
    // Verify poster is modern placeholder
    expect(firstItem.poster).toContain('data:image/svg+xml;base64,');
    
    // 2. Get meta for first item
    const metaResult = await addonService.getMeta({
      type: firstItem.type,
      id: firstItem.id,
      extra: {}
    });

    expect(metaResult.meta).toBeDefined();
    expect(metaResult.meta.id).toBe(firstItem.id);
    expect(metaResult.meta.name).toBeDefined();
    expect(metaResult.meta.poster).toBeDefined();

    // 3. Get streams for first item
    const streamResult = await addonService.getStream({
      type: firstItem.type,
      id: firstItem.id,
      extra: {}
    });

    expect(streamResult.streams).toBeDefined();
    expect(streamResult.streams.length).toBeGreaterThan(0);
    
    const firstStream = streamResult.streams[0]!;
    expect(firstStream.url).toContain('magnet:');
    expect(firstStream.title).toBeDefined();
    expect(firstStream.name).toBeDefined();
  }, 30000); // 30 second timeout for network requests

  it('should generate proper modern poster placeholders', async () => {
    const catalogResult = await addonService.getCatalog({
      type: 'anime',
      id: 'nyaa-anime-all',
      extra: {}
    });

    const animeItem = catalogResult.metas[0];
    expect(animeItem?.poster).toContain('data:image/svg+xml;base64,');
    
    // Decode and verify SVG structure
    const base64Data = animeItem?.poster?.replace('data:image/svg+xml;base64,', '');
    if (base64Data) {
      const svgContent = Buffer.from(base64Data, 'base64').toString('utf-8');
      expect(svgContent).toContain('<svg');
      expect(svgContent).toContain('linearGradient');
      expect(svgContent).toContain('SukeNyaa'); // Branding
      expect(svgContent).toContain('🎭'); // Anime icon
    }
  }, 15000);

  it('should handle missing content gracefully', async () => {
    // Test with non-existent ID
    const metaResult = await addonService.getMeta({
      type: 'anime',
      id: 'nyaa:nonexistenthash12345',
      extra: {}
    });

    expect(metaResult.meta).toBeDefined();
    // Should fallback to any available content or throw error
  }, 15000);
});