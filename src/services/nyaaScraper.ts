import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config';
import { TorrentItem, SearchFilters, SearchOptions, SearchResult } from '../types';
import { logger } from '../utils/logger';
import { ContentFilter } from '../utils/contentFilter';

export class NyaaScraper {
  private client: AxiosInstance;
  private lastRequestTime = 0;

  constructor(private baseUrl: string = config.externalServices.nyaaBaseUrl) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.scraping.timeoutMs,
      headers: {
        'User-Agent': config.scraping.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });
  }

  async search(filters: SearchFilters = {}, options: SearchOptions = {}): Promise<SearchResult> {
    await this.throttle();

    const page = options.page || 1;
    const limit = Math.min(options.limit || 75, 75); // Nyaa shows max 75 items per page
    const maxRetries = 3;
    let lastError: Error | null = null;

    // Retry mechanism for improved reliability
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = this.buildSearchUrl(filters, options);
        logger.info({ 
          url, 
          filters, 
          options, 
          attempt, 
          maxRetries 
        }, `Searching nyaa.si (attempt ${attempt}/${maxRetries})`);

        const response = await this.client.get(url);
        const $ = cheerio.load(response.data);

        const items = this.parseSearchResults($);
        const filteredItems = ContentFilter.filterTorrents(items);

        // Apply client-side limit if needed
        const startIndex = 0;
        const endIndex = Math.min(limit, filteredItems.length);
        const paginatedItems = filteredItems.slice(startIndex, endIndex);

        const totalPages = this.extractTotalPages($);
        const totalItems = this.estimateTotalItems($, totalPages);

        const result = {
          items: paginatedItems,
          pagination: {
            currentPage: page,
            totalPages,
            totalItems,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        };

        // Log successful attempt if it wasn't the first try
        if (attempt > 1) {
          logger.info({ 
            attempt, 
            itemCount: paginatedItems.length,
            filters,
            options 
          }, 'Search succeeded after retry');
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.warn({ 
          error: {
            message: lastError.message,
            code: (lastError as any).code
          },
          attempt, 
          maxRetries,
          filters,
          options,
          willRetry: attempt < maxRetries 
        }, `Search attempt ${attempt} failed${attempt < maxRetries ? ', retrying...' : ''}`);

        // If this isn't the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          logger.info({ 
            delay: backoffDelay, 
            nextAttempt: attempt + 1 
          }, 'Waiting before retry');
          
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }

    // All retries exhausted, handle the final error
    if (lastError) {
      // Enhanced error logging with Android-specific troubleshooting
      const errorContext = {
        error: {
          message: lastError.message,
          code: (lastError as any).code,
          stack: lastError.stack
        },
        filters,
        options,
        attemptsExhausted: maxRetries,
        userAgent: 'nyaaScraper',
        timestamp: new Date().toISOString(),
        androidTroubleshooting: {
          networkIssue: 'Check mobile data or WiFi connection',
          dnsIssue: 'Try switching between mobile data and WiFi',
          firewallIssue: 'Some networks may block nyaa.si access',
          siteDown: 'nyaa.si may be temporarily unavailable'
        }
      };
      
      logger.error(errorContext, `Failed to search nyaa.si after ${maxRetries} attempts - Android troubleshooting included`);
      
      // Create more user-friendly error message for mobile users
      let userFriendlyMessage = 'Failed to search content from nyaa.si after multiple attempts';
      
      if (lastError.message.includes('ENOTFOUND') || lastError.message.includes('ECONNREFUSED')) {
        userFriendlyMessage = 'Network connection error. Check your internet connection or try switching between mobile data and WiFi.';
      } else if (lastError.message.includes('timeout') || lastError.message.includes('ETIMEDOUT')) {
        userFriendlyMessage = 'Request timed out repeatedly. Check your network connection and try again later.';
      } else if (lastError.message.includes('429') || lastError.message.toLowerCase().includes('rate limit')) {
        userFriendlyMessage = 'Too many requests. Please wait several minutes before trying again.';
      } else if (lastError.message.includes('403') || lastError.message.includes('forbidden')) {
        userFriendlyMessage = 'Access restricted. Your network may be blocking nyaa.si.';
      }
      
      throw new Error(userFriendlyMessage);
    }

    // This should never be reached, but just in case
    throw new Error('Search failed for unknown reasons after all retry attempts');
  }

  private buildSearchUrl(filters: SearchFilters, options: SearchOptions): string {
    const params = new URLSearchParams();

    // Build search query including quality and language filters
    let searchQuery = filters.query || '';
    
    if (filters.quality) {
      searchQuery = searchQuery ? `${searchQuery} ${filters.quality}` : filters.quality;
    }
    
    if (filters.language) {
      // Map language to common search terms
      const languageMap: Record<string, string> = {
        'Japanese': 'JP',
        'English': 'EN',
        'Chinese': 'CN',
        'Korean': 'KR',
        'Dual Audio': 'Dual',
        'Multi': 'Multi',
      };
      const langTerm = languageMap[filters.language] || filters.language;
      searchQuery = searchQuery ? `${searchQuery} ${langTerm}` : langTerm;
    }

    if (searchQuery) {
      params.set('q', searchQuery);
    }

    if (filters.category) {
      params.set('c', filters.category);
    }

    if (filters.trusted) {
      params.set('f', '2'); // Trusted only
    } else if (filters.remake === false) {
      params.set('f', '1'); // No remakes
    }

    if (options.sort) {
      const sortMap: Record<string, string> = {
        date: 'id',
        size: 'size',
        seeders: 'seeders',
        leechers: 'leechers',
        downloads: 'downloads',
        title: 'name',
      };
      params.set('s', sortMap[options.sort] || 'id');
    }

    if (options.order) {
      params.set('o', options.order === 'asc' ? 'asc' : 'desc');
    }

    if (options.page && options.page > 1) {
      params.set('p', options.page.toString());
    }

    return `/?${params.toString()}`;
  }

  private parseSearchResults($: ReturnType<typeof cheerio.load>): TorrentItem[] {
    const items: TorrentItem[] = [];

    $('tbody tr').each((_, element) => {
      try {
        const row = $(element);
        const categoryCell = row.find('td').eq(0);
        const nameCell = row.find('td').eq(1);
        const sizeCell = row.find('td').eq(3);
        const seedersCell = row.find('td').eq(5);
        const leechersCell = row.find('td').eq(6);
        const downloadsCell = row.find('td').eq(7);
        const dateCell = row.find('td').eq(4);

        if (!nameCell.length) return;

        const titleElement = nameCell.find('a[title]').last();
        const title = titleElement.attr('title') || titleElement.text().trim();
        if (!title) return;

        const magnetLink = row.find('a[href^="magnet:"]').attr('href');
        if (!magnetLink) return;

        const id = this.extractIdFromMagnet(magnetLink) || this.generateId(title);
        const categoryText = categoryCell.find('a').attr('title') || '';
        const [category, subcategory] = this.parseCategory(categoryText);

        const sizeText = sizeCell.text().trim();
        const sizeBytes = this.parseSizeToBytes(sizeText);

        const uploaderElement = nameCell.find('a[href*="/user/"]');
        const uploader = uploaderElement.text().trim() || 'Anonymous';
        const trusted = uploaderElement.hasClass('text-success') || row.hasClass('success');
        const remake = row.hasClass('danger');

        const item: TorrentItem = {
          id,
          title,
          magnet: magnetLink,
          size: sizeText,
          sizeBytes,
          seeders: parseInt(seedersCell.text().trim()) || 0,
          leechers: parseInt(leechersCell.text().trim()) || 0,
          downloads: parseInt(downloadsCell.text().trim()) || 0,
          date: dateCell.text().trim(),
          category,
          subcategory,
          uploader,
          trusted,
          remake,
          quality: this.extractQuality(title),
          language: this.extractLanguage(title),
          resolution: this.extractResolution(title),
        };

        items.push(item);
      } catch (error) {
        logger.warn({ error }, 'Failed to parse torrent row');
      }
    });

    return items;
  }

  private extractIdFromMagnet(magnet: string): string | null {
    const match = magnet.match(/btih:([a-fA-F0-9]{40})/);
    return match?.[1]?.toLowerCase() || null;
  }

  private generateId(title: string): string {
    return Buffer.from(title).toString('base64').slice(0, 20);
  }

  private parseCategory(categoryText: string): [string, string] {
    const parts = categoryText.split(' - ');
    return [parts[0] || '', parts[1] || ''];
  }

  private parseSizeToBytes(sizeText: string): number {
    const match = sizeText.match(/([0-9.]+)\s*(B|KB|MB|GB|TB)/i);
    if (!match?.[1] || !match?.[2]) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
      TB: 1024 * 1024 * 1024 * 1024,
    };

    return Math.floor(value * (multipliers[unit] || 0));
  }

  private extractQuality(title: string): string | undefined {
    const qualityPatterns = [
      /\b(4K|2160p)\b/i,
      /\b(1080p|1080i|FHD)\b/i,
      /\b(720p|HD)\b/i,
      /\b(480p|SD)\b/i,
      /\b(360p)\b/i,
    ];

    for (const pattern of qualityPatterns) {
      const match = title.match(pattern);
      if (match?.[1]) {
        return match[1].toUpperCase();
      }
    }

    return undefined;
  }

  private extractLanguage(title: string): string | undefined {
    const languagePatterns = [
      /\[(JP|JPN|Japanese)\]/i,
      /\[(EN|ENG|English)\]/i,
      /\[(KR|KOR|Korean)\]/i,
      /\[(CN|CHN|Chinese)\]/i,
      /\[(Multi|Dual)\]/i,
    ];

    for (const pattern of languagePatterns) {
      const match = title.match(pattern);
      if (match?.[1]) {
        return match[1].toUpperCase();
      }
    }

    return undefined;
  }

  private extractResolution(title: string): string | undefined {
    const resolutionPattern = /\b(\d{3,4}[xX]\d{3,4}|\d{3,4}p)\b/;
    const match = title.match(resolutionPattern);
    return match ? match[1] : undefined;
  }

  private extractTotalPages($: ReturnType<typeof cheerio.load>): number {
    const paginationLinks = $('.pagination .page-link');
    let maxPage = 1;

    paginationLinks.each((_, element) => {
      const pageText = $(element).text().trim();
      const pageNum = parseInt(pageText);
      if (!isNaN(pageNum) && pageNum > maxPage) {
        maxPage = pageNum;
      }
    });

    return maxPage;
  }

  private estimateTotalItems($: ReturnType<typeof cheerio.load>, totalPages: number): number {
    const currentPageItems = $('tbody tr').length;
    return Math.max(currentPageItems, totalPages * 75); // Estimate based on max items per page
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = config.scraping.delayMs;

    if (timeSinceLastRequest < minDelay) {
      const delay = minDelay - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.throttle();
      const response = await this.client.get('/', { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

export default NyaaScraper;
