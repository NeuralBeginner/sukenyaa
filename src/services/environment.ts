import { logger } from '../utils/logger';
import { UserConfiguration, DEFAULT_CONFIG } from './config';
import os from 'os';
import fs from 'fs';

export interface EnvironmentInfo {
  platform: 'android' | 'desktop' | 'termux' | 'docker' | 'unknown';
  isTermux: boolean;
  isAndroid: boolean;
  isDocker: boolean;
  networkCapabilities: {
    hasInternet: boolean;
    canAccessNyaa: boolean;
    recommendsVPN: boolean;
  };
  performance: {
    cpuCores: number;
    totalMemoryMB: number;
    recommendedMaxConcurrent: number;
    recommendedCacheSize: number;
  };
  optimizedConfig: UserConfiguration;
}

class EnvironmentDetectionService {
  private cachedEnvironment: EnvironmentInfo | null = null;

  /**
   * Detect the current environment and return optimized configuration
   */
  async detectEnvironment(): Promise<EnvironmentInfo> {
    if (this.cachedEnvironment) {
      return this.cachedEnvironment;
    }

    logger.info('Detecting environment for optimal configuration...');

    const platform = this.detectPlatform();
    const isTermux = this.isTermuxEnvironment();
    const isAndroid = this.isAndroidEnvironment();
    const isDocker = this.isDockerEnvironment();

    const networkCapabilities = await this.checkNetworkCapabilities();
    const performance = this.analyzePerformance();
    const optimizedConfig = this.generateOptimizedConfig(platform, performance, networkCapabilities);

    this.cachedEnvironment = {
      platform,
      isTermux,
      isAndroid,
      isDocker,
      networkCapabilities,
      performance,
      optimizedConfig,
    };

    logger.info({
      platform,
      isTermux,
      isAndroid,
      isDocker,
      networkCapabilities,
      performance: {
        cpuCores: performance.cpuCores,
        totalMemoryMB: performance.totalMemoryMB,
      }
    }, 'Environment detected successfully');

    return this.cachedEnvironment;
  }

  /**
   * Detect the platform type
   */
  private detectPlatform(): EnvironmentInfo['platform'] {
    // Check for Docker first
    if (this.isDockerEnvironment()) {
      return 'docker';
    }

    // Check for Termux
    if (this.isTermuxEnvironment()) {
      return 'termux';
    }

    // Check for Android (non-Termux)
    if (this.isAndroidEnvironment()) {
      return 'android';
    }

    // Check for common desktop platforms
    const platform = os.platform();
    if (platform === 'win32' || platform === 'darwin' || platform === 'linux') {
      return 'desktop';
    }

    return 'unknown';
  }

  /**
   * Check if running in Termux
   */
  private isTermuxEnvironment(): boolean {
    return (
      // Check for Termux-specific environment variables
      !!process.env.TERMUX_VERSION ||
      !!process.env.PREFIX && process.env.PREFIX.includes('com.termux') ||
      // Check for Termux directory structure
      fs.existsSync('/data/data/com.termux') ||
      // Check if we're in a typical Termux path
      process.cwd().includes('/data/data/com.termux')
    );
  }

  /**
   * Check if running on Android (including Termux)
   */
  private isAndroidEnvironment(): boolean {
    return (
      this.isTermuxEnvironment() ||
      // Check for Android-specific paths
      fs.existsSync('/system/build.prop') ||
      fs.existsSync('/system/bin/app_process') ||
      // Check environment variables that indicate Android
      !!process.env.ANDROID_ROOT ||
      !!process.env.ANDROID_DATA
    );
  }

  /**
   * Check if running in Docker
   */
  private isDockerEnvironment(): boolean {
    return (
      // Check for Docker-specific files
      fs.existsSync('/.dockerenv') ||
      // Check cgroup for docker
      this.checkCGroupForDocker() ||
      // Check for common Docker environment variables
      !!process.env.DOCKER_CONTAINER ||
      !!process.env.CONTAINER
    );
  }

  /**
   * Check cgroup information for Docker indicators
   */
  private checkCGroupForDocker(): boolean {
    try {
      const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
      return cgroup.includes('docker') || cgroup.includes('containerd');
    } catch {
      return false;
    }
  }

  /**
   * Check network capabilities
   */
  private async checkNetworkCapabilities(): Promise<EnvironmentInfo['networkCapabilities']> {
    const capabilities = {
      hasInternet: false,
      canAccessNyaa: false,
      recommendsVPN: false,
    };

    try {
      // Quick internet connectivity check
      const { default: axios } = await import('axios');
      
      // Test basic internet connectivity
      try {
        await axios.get('https://www.google.com', { timeout: 5000 });
        capabilities.hasInternet = true;
        logger.debug('Internet connectivity confirmed');
      } catch {
        logger.warn('No internet connectivity detected');
        return capabilities;
      }

      // Test nyaa.si accessibility
      try {
        await axios.head('https://nyaa.si', { timeout: 10000 });
        capabilities.canAccessNyaa = true;
        logger.debug('Nyaa.si is accessible');
      } catch (error: any) {
        logger.warn({ error: error.message }, 'Nyaa.si is not accessible, VPN may be needed');
        capabilities.recommendsVPN = true;
      }

    } catch (error) {
      logger.error({ error }, 'Error checking network capabilities');
    }

    return capabilities;
  }

  /**
   * Analyze system performance capabilities
   */
  private analyzePerformance(): EnvironmentInfo['performance'] {
    const cpuCores = os.cpus().length;
    const totalMemoryBytes = os.totalmem();
    const totalMemoryMB = Math.round(totalMemoryBytes / (1024 * 1024));

    // Calculate recommended settings based on available resources
    let recommendedMaxConcurrent: number;
    let recommendedCacheSize: number;

    if (totalMemoryMB < 1024) {
      // Low memory device (< 1GB) - very conservative settings
      recommendedMaxConcurrent = 2;
      recommendedCacheSize = 100;
    } else if (totalMemoryMB < 2048) {
      // Medium memory device (1-2GB) - moderate settings
      recommendedMaxConcurrent = 3;
      recommendedCacheSize = 300;
    } else if (totalMemoryMB < 4096) {
      // Good memory device (2-4GB) - standard settings
      recommendedMaxConcurrent = 5;
      recommendedCacheSize = 500;
    } else {
      // High memory device (4GB+) - aggressive settings
      recommendedMaxConcurrent = Math.min(cpuCores * 2, 10);
      recommendedCacheSize = 1000;
    }

    return {
      cpuCores,
      totalMemoryMB,
      recommendedMaxConcurrent,
      recommendedCacheSize,
    };
  }

  /**
   * Generate optimized configuration based on environment
   */
  private generateOptimizedConfig(
    platform: EnvironmentInfo['platform'],
    performance: EnvironmentInfo['performance'],
    network: EnvironmentInfo['networkCapabilities']
  ): UserConfiguration {
    const baseConfig = { ...DEFAULT_CONFIG };

    // Platform-specific optimizations
    switch (platform) {
      case 'termux':
      case 'android':
        // Mobile/Termux optimizations
        baseConfig.maxResults = Math.min(30, performance.totalMemoryMB < 2048 ? 20 : 30);
        baseConfig.cacheTimeout = 600; // Longer cache for mobile
        baseConfig.preferredQuality = ['720p', '480p', '1080p']; // Prioritize smaller files
        baseConfig.enableDetailedLogging = false; // Reduce log noise on mobile
        break;

      case 'docker':
        // Docker optimizations
        baseConfig.maxResults = 50;
        baseConfig.cacheTimeout = 300;
        baseConfig.enableDetailedLogging = true; // Useful for container debugging
        break;

      case 'desktop':
      default:
        // Desktop optimizations
        baseConfig.maxResults = 50;
        baseConfig.cacheTimeout = 300;
        baseConfig.preferredQuality = ['1080p', '720p', '4K', '480p'];
        break;
    }

    // Performance-based optimizations
    if (performance.totalMemoryMB < 1024) {
      // Very low memory - ultra conservative
      baseConfig.maxResults = Math.min(baseConfig.maxResults, 15);
      baseConfig.cacheTimeout = 900; // Longer cache to reduce requests
    }

    // Network-based optimizations
    if (!network.canAccessNyaa && network.recommendsVPN) {
      // If nyaa is blocked, enable more conservative settings
      baseConfig.cacheTimeout = 900; // Longer cache when network is limited
      baseConfig.trustedUploadersOnly = true; // Reduce requests by filtering
    }

    // Always enable optimal defaults for zero-configuration
    baseConfig.enableNsfwFilter = true;
    baseConfig.blockedCategories = ['1_3']; // Block inappropriate content by default
    baseConfig.defaultSort = 'date';
    baseConfig.defaultOrder = 'desc';
    baseConfig.preferredLanguages = ['English', 'Japanese', 'Chinese', 'Korean'];

    return baseConfig;
  }

  /**
   * Apply auto-configuration based on detected environment
   */
  async applyAutoConfiguration(): Promise<void> {
    const environment = await this.detectEnvironment();
    
    logger.info({
      platform: environment.platform,
      optimizations: {
        maxResults: environment.optimizedConfig.maxResults,
        cacheTimeout: environment.optimizedConfig.cacheTimeout,
        preferredQuality: environment.optimizedConfig.preferredQuality,
      }
    }, 'Applying auto-configuration based on environment');

    // Apply the optimized configuration
    const { configurationService } = await import('./config');
    await configurationService.saveUserConfiguration(environment.optimizedConfig);

    logger.info('Auto-configuration applied successfully');
  }

  /**
   * Get environment info for display purposes
   */
  async getEnvironmentSummary(): Promise<{
    platform: string;
    memory: string;
    network: string;
    optimization: string;
  }> {
    const env = await this.detectEnvironment();
    
    return {
      platform: `${env.platform}${env.isTermux ? ' (Termux)' : ''}${env.isDocker ? ' (Docker)' : ''}`,
      memory: `${env.performance.totalMemoryMB}MB (${env.performance.cpuCores} cores)`,
      network: env.networkCapabilities.canAccessNyaa 
        ? 'Nyaa accessible' 
        : env.networkCapabilities.recommendsVPN 
          ? 'VPN recommended' 
          : 'Limited connectivity',
      optimization: `${env.optimizedConfig.maxResults} results, ${env.optimizedConfig.cacheTimeout}s cache`,
    };
  }
}

export const environmentService = new EnvironmentDetectionService();
export default environmentService;