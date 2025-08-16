#!/usr/bin/env ts-node

// Test script for addon functionality
import { config } from '../src/config';
import { addonService } from '../src/services/addon';

async function testAddon() {
  console.log('=== Testing SukeNyaa Addon ===\n');
  
  try {
    // Test catalog request
    console.log('1. Testing catalog request...');
    const catalogResult = await addonService.getCatalog({
      type: 'anime',
      id: 'nyaa-anime-all',
      extra: {}
    });
    
    console.log(`📊 Catalog returned ${catalogResult.metas.length} items`);
    
    if (catalogResult.metas.length > 0) {
      const firstMeta = catalogResult.metas[0]!;
      console.log('\n🎯 First catalog item:');
      console.log(`  ID: ${firstMeta.id}`);
      console.log(`  Name: ${firstMeta.name}`);
      console.log(`  Type: ${firstMeta.type}`);
      console.log(`  Year: ${firstMeta.year || 'N/A'}`);
      console.log(`  Poster: ${firstMeta.poster || 'N/A'}`);
      console.log(`  Description length: ${firstMeta.description?.length || 0} chars`);
      console.log(`  Genres: ${firstMeta.genres?.join(', ') || 'N/A'}`);
      
      // Test meta request
      console.log('\n2. Testing meta request...');
      try {
        const metaResult = await addonService.getMeta({
          type: firstMeta.type,
          id: firstMeta.id,
          extra: {}
        });
        
        console.log('✅ Meta request successful');
        console.log(`  Name: ${metaResult.meta.name}`);
        console.log(`  Poster: ${metaResult.meta.poster || 'N/A'}`);
        console.log(`  Description length: ${metaResult.meta.description?.length || 0} chars`);
      } catch (metaError) {
        console.log(`❌ Meta request failed: ${metaError instanceof Error ? metaError.message : metaError}`);
      }
      
      // Test stream request
      console.log('\n3. Testing stream request...');
      try {
        const streamResult = await addonService.getStream({
          type: firstMeta.type,
          id: firstMeta.id,
          extra: {}
        });
        
        console.log('✅ Stream request successful');
        console.log(`  Found ${streamResult.streams.length} streams`);
        if (streamResult.streams.length > 0) {
          console.log(`  First stream: ${streamResult.streams[0]?.title}`);
        }
      } catch (streamError) {
        console.log(`❌ Stream request failed: ${streamError instanceof Error ? streamError.message : streamError}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Catalog test failed:', error instanceof Error ? error.message : error);
  }
}

// Run test
testAddon().catch(console.error);