import NyaaScraper from '../../src/services/nyaaScraper';
import { SearchFilters, SearchOptions } from '../../src/types';

// Mock axios to avoid network calls in tests
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn()
  }))
}));

describe('NyaaScraper', () => {
  let scraper: NyaaScraper;

  beforeAll(() => {
    scraper = new NyaaScraper();
  });

  describe('buildSearchUrl', () => {
    test('should build correct URL with query', () => {
      const filters: SearchFilters = {
        query: 'One Piece',
        category: '1_0',
      };
      
      const options: SearchOptions = {
        page: 1,
        limit: 10,
      };

      // Access private method for testing
      const url = (scraper as any).buildSearchUrl(filters, options);
      expect(url).toContain('q=One+Piece');
      expect(url).toContain('c=1_0');
    });

    test('should handle pagination', () => {
      const filters: SearchFilters = {};
      const options: SearchOptions = {
        page: 2,
      };

      const url = (scraper as any).buildSearchUrl(filters, options);
      expect(url).toContain('p=2');
    });

    test('should handle sorting', () => {
      const filters: SearchFilters = {};
      const options: SearchOptions = {
        sort: 'seeders',
        order: 'desc',
      };

      const url = (scraper as any).buildSearchUrl(filters, options);
      expect(url).toContain('s=seeders');
      expect(url).toContain('o=desc');
    });
  });

  describe('extractQuality', () => {
    test('should extract quality from title', () => {
      const extractQuality = (scraper as any).extractQuality.bind(scraper);
      
      expect(extractQuality('[1080p] Anime Title')).toBe('1080P');
      expect(extractQuality('Movie 720p HEVC')).toBe('720P');
      expect(extractQuality('Series 4K UHD')).toBe('4K');
      expect(extractQuality('No quality here')).toBeUndefined();
    });
  });

  describe('extractLanguage', () => {
    test('should extract language from title', () => {
      const extractLanguage = (scraper as any).extractLanguage.bind(scraper);
      
      expect(extractLanguage('[JP] Anime Title')).toBe('JP');
      expect(extractLanguage('[English] Movie')).toBe('ENGLISH');
      expect(extractLanguage('[Multi] Series')).toBe('MULTI');
      expect(extractLanguage('No language tag')).toBeUndefined();
    });
  });

  describe('parseSizeToBytes', () => {
    test('should parse size to bytes correctly', () => {
      const parseSizeToBytes = (scraper as any).parseSizeToBytes.bind(scraper);
      
      expect(parseSizeToBytes('1.5 GB')).toBe(1610612736);
      expect(parseSizeToBytes('500 MB')).toBe(524288000);
      expect(parseSizeToBytes('2 TB')).toBe(2199023255552);
      expect(parseSizeToBytes('invalid')).toBe(0);
    });
  });
});