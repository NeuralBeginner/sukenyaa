#!/usr/bin/env ts-node

// Debug parsing step by step
import * as cheerio from 'cheerio';
import axios from 'axios';

async function debugParsing() {
  console.log('=== Nyaa Parsing Debug ===\n');
  
  try {
    const response = await axios.get('https://nyaa.si/?c=1_0&s=id&o=desc&p=1', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      },
    });
    
    const $ = cheerio.load(response.data);
    
    console.log('1. Looking for tbody tr elements...');
    const rows = $('tbody tr');
    console.log(`Found ${rows.length} rows`);
    
    if (rows.length > 0) {
      console.log('\n2. Analyzing first row in detail...');
      const firstRow = $(rows[0]);
      const cells = firstRow.find('td');
      
      console.log(`Row has ${cells.length} cells`);
      
      // Test each cell
      cells.each((i, cell) => {
        const cellContent = $(cell).text().trim();
        console.log(`Cell ${i}: "${cellContent.substring(0, 50)}${cellContent.length > 50 ? '...' : ''}"`);
      });
      
      console.log('\n3. Testing specific parsing logic...');
      
      // Test name cell (should be index 1)
      const nameCell = firstRow.find('td').eq(1);
      console.log('Name cell exists:', nameCell.length > 0);
      
      // Look for title element
      const titleElement = nameCell.find('a[title]').last();
      console.log('Title element found:', titleElement.length > 0);
      
      if (titleElement.length > 0) {
        const title = titleElement.attr('title') || titleElement.text().trim();
        console.log('Extracted title:', title);
      } else {
        // Try alternative selectors
        const allLinks = nameCell.find('a');
        console.log('All links in name cell:', allLinks.length);
        allLinks.each((i, link) => {
          const linkTitle = $(link).attr('title');
          const linkText = $(link).text().trim();
          console.log(`Link ${i}: title="${linkTitle}", text="${linkText.substring(0, 50)}"`);
        });
      }
      
      // Look for magnet link
      const magnetLink = nameCell.find('a[href^="magnet:"]').attr('href');
      console.log('Magnet link found:', !!magnetLink);
      if (magnetLink) {
        console.log('Magnet link preview:', magnetLink.substring(0, 80) + '...');
      }
      
      // Test category cell (should be index 0)
      const categoryCell = firstRow.find('td').eq(0);
      const categoryLink = categoryCell.find('a');
      console.log('Category link found:', categoryLink.length > 0);
      if (categoryLink.length > 0) {
        const categoryTitle = categoryLink.attr('title');
        console.log('Category title:', categoryTitle);
      }
      
      // Test size cell (should be index 3)
      const sizeCell = firstRow.find('td').eq(3);
      const sizeText = sizeCell.text().trim();
      console.log('Size text:', sizeText);
      
      // Test seeders/leechers (should be index 5, 6)
      const seedersCell = firstRow.find('td').eq(5);
      const leechersCell = firstRow.find('td').eq(6);
      console.log('Seeders:', seedersCell.text().trim());
      console.log('Leechers:', leechersCell.text().trim());
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
  
  console.log('\n=== Debug Complete ===');
}

if (require.main === module) {
  debugParsing().catch(console.error);
}