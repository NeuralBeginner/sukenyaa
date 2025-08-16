#!/usr/bin/env ts-node

// Debug script to see what we're getting from nyaa.si
import { NyaaScraper } from '../src/services/nyaaScraper';
import * as cheerio from 'cheerio';
import axios from 'axios';

async function debugNyaaResponse() {
  console.log('=== Nyaa Debug Response ===\n');
  
  try {
    // First, let's test a direct axios call
    console.log('1. Testing direct axios call...');
    const response = await axios.get('https://nyaa.si/?c=1_0&s=id&o=desc', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      },
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers['content-type']);
    console.log('Response encoding:', response.headers['content-encoding']);
    console.log('Response length:', response.data.length);
    
    // Check if response is HTML
    const isHtml = typeof response.data === 'string' && response.data.includes('<html');
    console.log('Is HTML:', isHtml);
    
    if (isHtml) {
      console.log('\n2. Parsing with cheerio...');
      const $ = cheerio.load(response.data);
      
      // Check for key elements
      const title = $('title').text();
      console.log('Page title:', title);
      
      const rows = $('tbody tr');
      console.log('Table rows found:', rows.length);
      
      // Check if we have the right structure
      const firstRow = rows.first();
      const cells = firstRow.find('td');
      console.log('Cells in first row:', cells.length);
      
      if (cells.length > 0) {
        console.log('First cell content:', cells.eq(0).text().trim());
        console.log('Second cell content:', cells.eq(1).text().trim().substring(0, 100));
      }
      
      // Look for torrent links
      const magnetLinks = $('a[href^="magnet:"]');
      console.log('Magnet links found:', magnetLinks.length);
      
      // Look for specific table classes/IDs that might indicate torrent listings
      const tables = $('table');
      console.log('Tables found:', tables.length);
      
      tables.each((i, table) => {
        const tableClass = $(table).attr('class');
        const tableId = $(table).attr('id');
        console.log(`Table ${i}: class="${tableClass}", id="${tableId}"`);
      });
      
    } else {
      console.log('Response is not HTML, first 200 chars:');
      console.log(response.data.toString().substring(0, 200));
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
  }
  
  console.log('\n=== Debug Complete ===');
}

if (require.main === module) {
  debugNyaaResponse().catch(console.error);
}