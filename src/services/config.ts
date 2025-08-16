import { logger } from '../utils/logger';
import { cacheService } from './cache';

export interface UserConfiguration {
  // Content filters
  enableNsfwFilter: boolean;
  trustedUploadersOnly: boolean;
  blockedCategories: string[];
  
  // Search preferences
  defaultSort: 'date' | 'seeders' | 'size' | 'title';
  defaultOrder: 'asc' | 'desc';
  maxResults: number;
  
  // Quality preferences
  preferredQuality: string[];
  preferredLanguages: string[];
  
  // Advanced options
  enableDetailedLogging: boolean;
  cacheTimeout: number;
}

export const DEFAULT_CONFIG: UserConfiguration = {
  // Content filters - secure and family-friendly by default
  enableNsfwFilter: true,
  trustedUploadersOnly: false, // Allow all, but prioritize trusted
  blockedCategories: ['1_3'], // Sukebei real/Junior Idol category
  
  // Search preferences - optimized for best user experience
  defaultSort: 'date',
  defaultOrder: 'desc',
  maxResults: 50, // Good balance between content and performance
  
  // Quality preferences - cover all common use cases
  preferredQuality: ['1080p', '720p', '480p', '4K'], // Most to least common
  preferredLanguages: ['English', 'Japanese', 'Chinese', 'Korean'], // Popular languages
  
  // Advanced options - balanced for zero-configuration
  enableDetailedLogging: false, // Reduce log noise by default
  cacheTimeout: 300, // 5 minutes - good balance between freshness and performance
};

class ConfigurationService {
  private static readonly CONFIG_KEY = 'user_configuration';
  private static readonly CONFIG_VERSION = '1.0.0';

  async getUserConfiguration(userId?: string): Promise<UserConfiguration> {
    try {
      const key = this.getConfigKey(userId);
      const cached = await cacheService.get<UserConfiguration>(key);
      
      if (cached) {
        // Merge with defaults to ensure all properties exist
        return { ...DEFAULT_CONFIG, ...cached };
      }
      
      return DEFAULT_CONFIG;
    } catch (error) {
      logger.error({ error }, 'Failed to get user configuration');
      return DEFAULT_CONFIG;
    }
  }

  async saveUserConfiguration(config: Partial<UserConfiguration>, userId?: string): Promise<UserConfiguration> {
    try {
      const currentConfig = await this.getUserConfiguration(userId);
      const updatedConfig = { ...currentConfig, ...config };
      
      const key = this.getConfigKey(userId);
      await cacheService.set(key, updatedConfig, 86400); // Cache for 24 hours
      
      logger.info({ userId, changes: config }, 'User configuration updated');
      return updatedConfig;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to save user configuration');
      throw error;
    }
  }

  async resetUserConfiguration(userId?: string): Promise<UserConfiguration> {
    try {
      const key = this.getConfigKey(userId);
      await cacheService.del(key);
      
      logger.info({ userId }, 'User configuration reset to defaults');
      return DEFAULT_CONFIG;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to reset user configuration');
      throw error;
    }
  }

  getConfigurationSchema() {
    return {
      version: ConfigurationService.CONFIG_VERSION,
      sections: [
        {
          name: 'Content Filtering',
          description: 'Control what content is shown and filtered',
          fields: [
            {
              key: 'enableNsfwFilter',
              type: 'boolean',
              label: 'Enable NSFW Content Filter',
              description: 'Filter out adult/NSFW content from results',
              default: true,
            },
            {
              key: 'trustedUploadersOnly',
              type: 'boolean',
              label: 'Trusted Uploaders Only',
              description: 'Show only content from trusted uploaders',
              default: false,
            },
            {
              key: 'blockedCategories',
              type: 'multiselect',
              label: 'Blocked Categories',
              description: 'Categories to exclude from results',
              options: [
                { value: '1_3', label: 'Sukebei Real/Junior Idol' },
                { value: '6_0', label: 'Sukebei Art - Anime' },
                { value: '6_1', label: 'Sukebei Art - Doujinshi' },
                { value: '6_2', label: 'Sukebei Art - Games' },
              ],
              default: ['1_3'],
            },
          ],
        },
        {
          name: 'Search Preferences',
          description: 'Configure how search results are displayed',
          fields: [
            {
              key: 'defaultSort',
              type: 'select',
              label: 'Default Sort Order',
              description: 'How to sort search results by default',
              options: [
                { value: 'date', label: 'Date Added' },
                { value: 'seeders', label: 'Number of Seeders' },
                { value: 'size', label: 'File Size' },
                { value: 'title', label: 'Title' },
              ],
              default: 'date',
            },
            {
              key: 'defaultOrder',
              type: 'select',
              label: 'Sort Direction',
              description: 'Ascending or descending order',
              options: [
                { value: 'desc', label: 'Descending (Newest/Highest first)' },
                { value: 'asc', label: 'Ascending (Oldest/Lowest first)' },
              ],
              default: 'desc',
            },
            {
              key: 'maxResults',
              type: 'number',
              label: 'Maximum Results',
              description: 'Maximum number of items to show per page',
              min: 10,
              max: 75,
              default: 50,
            },
          ],
        },
        {
          name: 'Quality Preferences',
          description: 'Set preferred video quality and language options',
          fields: [
            {
              key: 'preferredQuality',
              type: 'multiselect',
              label: 'Preferred Video Quality',
              description: 'Prioritize these quality options in results',
              options: [
                { value: '2160p', label: '2160p (4K)' },
                { value: '1080p', label: '1080p (Full HD)' },
                { value: '720p', label: '720p (HD)' },
                { value: '480p', label: '480p (SD)' },
              ],
              default: ['1080p', '720p', '480p'],
            },
            {
              key: 'preferredLanguages',
              type: 'multiselect',
              label: 'Preferred Languages',
              description: 'Prefer content in these languages',
              options: [
                { value: 'English', label: 'English' },
                { value: 'Japanese', label: 'Japanese' },
                { value: 'Chinese', label: 'Chinese' },
                { value: 'Korean', label: 'Korean' },
              ],
              default: ['English', 'Japanese'],
            },
          ],
        },
        {
          name: 'Advanced Options',
          description: 'Advanced configuration options',
          fields: [
            {
              key: 'enableDetailedLogging',
              type: 'boolean',
              label: 'Enable Detailed Logging',
              description: 'Enable detailed debug logging for troubleshooting',
              default: false,
            },
            {
              key: 'cacheTimeout',
              type: 'number',
              label: 'Cache Timeout (seconds)',
              description: 'How long to cache search results',
              min: 60,
              max: 3600,
              default: 300,
            },
          ],
        },
      ],
    };
  }

  private getConfigKey(userId?: string): string {
    return `${ConfigurationService.CONFIG_KEY}:${userId || 'default'}`;
  }
}

export const configurationService = new ConfigurationService();
export default configurationService;