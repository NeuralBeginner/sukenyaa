import { config } from '../config';
import { TorrentItem } from '../types';
import { logger } from './logger';

export class ContentFilter {
  private static blockedKeywordsRegex: RegExp;

  static {
    const keywords = config.contentFilter.blockedKeywords.join('|');
    this.blockedKeywordsRegex = new RegExp(`\\b(${keywords})\\b`, 'i');
  }

  static isAllowed(torrent: TorrentItem): boolean {
    // Strict minor content exclusion
    if (config.contentFilter.strictMinorContentExclusion) {
      if (this.containsBlockedKeywords(torrent.title)) {
        logger.warn({ title: torrent.title }, 'Blocked torrent due to prohibited keywords');
        return false;
      }
    }

    // Block specific categories
    const categoryMatches = config.contentFilter.blockedCategories.some(blockedCat => 
      torrent.category.includes(blockedCat)
    );
    if (categoryMatches) {
      logger.warn({ category: torrent.category, title: torrent.title }, 'Blocked torrent due to prohibited category');
      return false;
    }

    // NSFW filter (if enabled)
    if (config.contentFilter.enableNsfwFilter && this.isNsfw(torrent)) {
      return false;
    }

    // Trusted uploaders only (if enabled)
    if (config.contentFilter.trustedUploadersOnly && !torrent.trusted) {
      return false;
    }

    return true;
  }

  private static containsBlockedKeywords(title: string): boolean {
    return this.blockedKeywordsRegex.test(title);
  }

  private static isNsfw(torrent: TorrentItem): boolean {
    // Categories that are considered NSFW
    const nsfwCategories = ['6_0', '6_1', '6_2']; // Sukebei categories
    return nsfwCategories.some(cat => torrent.category.startsWith(cat));
  }

  static filterTorrents(torrents: TorrentItem[]): TorrentItem[] {
    return torrents.filter(torrent => this.isAllowed(torrent));
  }
}

export default ContentFilter;