#!/usr/bin/env ts-node

// CLI test script for the Nyaa scraper
import { NyaaScraper } from '../src/services/nyaaScraper';
import { SearchFilters, SearchOptions, TorrentItem } from '../src/types';

async function testScraper() {
  console.log('=== Nyaa Scraper CLI Test ===\n');
  
  const scraper = new NyaaScraper();
  
  // Test 1: Basic connectivity
  console.log('1. Testing basic connectivity...');
  try {
    const isHealthy = await scraper.checkHealth();
    console.log(`✅ Health check: ${isHealthy}\n`);
  } catch (error: any) {
    console.error(`❌ Health check failed: ${error.message}\n`);
    return;
  }
  
  // Test 2: Search without filters (should get recent uploads)
  console.log('2. Testing basic search (recent anime)...');
  try {
    const filters: SearchFilters = {
      category: '1_0' // Anime
    };
    const options: SearchOptions = {
      limit: 5,
      sort: 'date',
      order: 'desc'
    };
    
    const result = await scraper.search(filters, options);
    console.log(`📊 Found ${result.items.length} items`);
    console.log(`📄 Total pages: ${result.pagination.totalPages}`);
    console.log(`📈 Total items: ${result.pagination.totalItems}`);
    
    if (result.items.length > 0) {
      console.log('\n🎯 First result:');
      const first = result.items[0]!;
      console.log(`  Title: ${first.title}`);
      console.log(`  Category: ${first.category} - ${first.subcategory}`);
      console.log(`  Size: ${first.size}`);
      console.log(`  Seeders: ${first.seeders}/${first.leechers}`);
      console.log(`  Uploader: ${first.uploader}${first.trusted ? ' ✅' : ''}`);
      console.log(`  Date: ${first.date}`);
      console.log(`  Quality: ${first.quality || 'Unknown'}`);
      console.log(`  Language: ${first.language || 'Unknown'}`);
      console.log(`  Magnet: ${first.magnet.substring(0, 60)}...`);
    }
    console.log();
  } catch (error: any) {
    console.error(`❌ Basic search failed: ${error.message}\n`);
  }
  
  // Test 3: Search with query
  console.log('3. Testing search with query...');
  try {
    const filters: SearchFilters = {
      query: 'Attack on Titan',
      category: '1_0'
    };
    const options: SearchOptions = {
      limit: 3,
      sort: 'seeders',
      order: 'desc'
    };
    
    const result = await scraper.search(filters, options);
    console.log(`📊 Found ${result.items.length} items for "Attack on Titan"`);
    
    result.items.forEach((item: TorrentItem, index: number) => {
      console.log(`\n  ${index + 1}. ${item.title}`);
      console.log(`     Seeders: ${item.seeders} | Size: ${item.size} | Quality: ${item.quality || 'N/A'}`);
    });
    console.log();
  } catch (error: any) {
    console.error(`❌ Query search failed: ${error.message}\n`);
  }
  
  // Test 4: Test with trusted filter
  console.log('4. Testing trusted filter...');
  try {
    const filters: SearchFilters = {
      category: '1_0',
      trusted: true
    };
    const options: SearchOptions = {
      limit: 3
    };
    
    const result = await scraper.search(filters, options);
    console.log(`📊 Found ${result.items.length} trusted items`);
    
    result.items.forEach((item: TorrentItem, index: number) => {
      console.log(`  ${index + 1}. ${item.title} - Trusted: ${item.trusted ? '✅' : '❌'}`);
    });
    console.log();
  } catch (error: any) {
    console.error(`❌ Trusted search failed: ${error.message}\n`);
  }
  
  console.log('=== Test Complete ===');
}

// Run if called directly
if (require.main === module) {
  testScraper().catch(console.error);
}

export { testScraper };