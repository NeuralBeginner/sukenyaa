#!/usr/bin/env ts-node

// Debug magnet link detection
import * as cheerio from 'cheerio';
import axios from 'axios';

async function debugMagnetLinks() {
  console.log('=== Magnet Link Debug ===\n');
  
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
    
    // Look for ALL magnet links on the page
    console.log('1. Finding all magnet links on page...');
    const allMagnets = $('a[href^="magnet:"]');
    console.log(`Found ${allMagnets.length} magnet links total`);
    
    // Look in the first row specifically
    const firstRow = $('tbody tr').first();
    const nameCell = firstRow.find('td').eq(1);
    
    console.log('\n2. Checking name cell structure...');
    console.log('Name cell HTML:');
    console.log(nameCell.html());
    
    console.log('\n3. Looking for links in name cell...');
    const allLinksInCell = nameCell.find('a');
    console.log(`Found ${allLinksInCell.length} links in name cell`);
    
    allLinksInCell.each((i, link) => {
      const href = $(link).attr('href');
      const text = $(link).text();
      const title = $(link).attr('title');
      console.log(`Link ${i}: href="${href}", text="${text.substring(0, 30)}", title="${title}"`);
    });
    
    // Check if magnet links are in a different location
    console.log('\n4. Looking for magnet links in the entire first row...');
    const rowMagnets = firstRow.find('a[href^="magnet:"]');
    console.log(`Found ${rowMagnets.length} magnet links in first row`);
    
    if (rowMagnets.length > 0) {
      const magnetHref = rowMagnets.first().attr('href');
      console.log('First magnet link:', magnetHref?.substring(0, 80) + '...');
      
      // Find what cell contains the magnet
      rowMagnets.each((i, magnet) => {
        const parentCell = $(magnet).closest('td');
        const cellIndex = parentCell.index();
        console.log(`Magnet ${i} is in cell ${cellIndex}`);
      });
    }
    
    // Check if there are other columns that might contain download links
    console.log('\n5. Checking all cells for download-related content...');
    const cells = firstRow.find('td');
    cells.each((i, cell) => {
      const cellHtml = $(cell).html();
      if (cellHtml && (cellHtml.includes('magnet:') || cellHtml.includes('download') || cellHtml.includes('torrent'))) {
        console.log(`Cell ${i} contains download content:`, cellHtml);
      }
    });
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
  
  console.log('\n=== Debug Complete ===');
}

if (require.main === module) {
  debugMagnetLinks().catch(console.error);
}