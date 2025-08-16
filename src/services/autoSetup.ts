import { logger } from '../utils/logger';
import { environmentService, EnvironmentInfo } from './environment';
import { configurationService } from './config';
import { cacheService } from './cache';
import fs from 'fs/promises';
import path from 'path';

export interface AutoSetupResult {
  success: boolean;
  environment: EnvironmentInfo;
  actions: string[];
  warnings: string[];
  errors: string[];
  configuration: any;
}

class AutoSetupService {
  private setupCompleted = false;

  /**
   * Perform complete auto-setup for zero-configuration installation
   */
  async performAutoSetup(): Promise<AutoSetupResult> {
    const result: AutoSetupResult = {
      success: false,
      environment: {} as EnvironmentInfo,
      actions: [],
      warnings: [],
      errors: [],
      configuration: {},
    };

    try {
      logger.info('Starting auto-setup for zero-configuration installation...');

      // Step 1: Detect environment
      result.actions.push('Detecting environment and platform capabilities...');
      result.environment = await environmentService.detectEnvironment();
      result.actions.push(`Detected platform: ${result.environment.platform}`);

      // Step 2: Validate network connectivity
      await this.validateNetworkSetup(result);

      // Step 3: Apply optimal configuration
      await this.applyOptimalConfiguration(result);

      // Step 4: Initialize cache with default content
      await this.initializeCache(result);

      // Step 5: Verify installation
      await this.verifyInstallation(result);

      // Step 6: Create helpful files
      await this.createHelpfulFiles(result);

      result.success = result.errors.length === 0;
      this.setupCompleted = result.success;

      if (result.success) {
        logger.info('Auto-setup completed successfully');
        result.actions.push('✅ Auto-setup completed successfully - SukeNyaa is ready to use!');
      } else {
        logger.warn({ errors: result.errors }, 'Auto-setup completed with some issues');
        result.actions.push('⚠️ Auto-setup completed with some issues');
      }

    } catch (error: any) {
      logger.error({ error }, 'Auto-setup failed');
      result.errors.push(`Setup failed: ${error.message}`);
      result.success = false;
    }

    return result;
  }

  /**
   * Validate and optimize network setup
   */
  private async validateNetworkSetup(result: AutoSetupResult): Promise<void> {
    const network = result.environment.networkCapabilities;

    if (!network.hasInternet) {
      result.errors.push('No internet connectivity detected');
      return;
    }

    result.actions.push('✅ Internet connectivity confirmed');

    if (!network.canAccessNyaa) {
      if (network.recommendsVPN) {
        result.warnings.push('Nyaa.si is not accessible - VPN recommended for optimal experience');
        result.actions.push('⚠️ Nyaa.si blocked - configured for limited connectivity mode');
      } else {
        result.warnings.push('Nyaa.si accessibility could not be verified');
      }
    } else {
      result.actions.push('✅ Nyaa.si is accessible');
    }
  }

  /**
   * Apply optimal configuration based on environment
   */
  private async applyOptimalConfiguration(result: AutoSetupResult): Promise<void> {
    try {
      // Apply the optimized configuration from environment detection
      const config = result.environment.optimizedConfig;
      await configurationService.saveUserConfiguration(config);
      
      result.configuration = config;
      result.actions.push('✅ Applied optimal configuration for your platform');
      result.actions.push(`   - Max results: ${config.maxResults}`);
      result.actions.push(`   - Cache timeout: ${config.cacheTimeout}s`);
      result.actions.push(`   - Preferred quality: ${config.preferredQuality.join(', ')}`);
      result.actions.push(`   - NSFW filter: ${config.enableNsfwFilter ? 'enabled' : 'disabled'}`);
      result.actions.push(`   - Trusted uploaders only: ${config.trustedUploadersOnly ? 'enabled' : 'disabled'}`);

      // Enable additional features for zero-configuration
      await this.enableAdvancedFeatures(result);

    } catch (error: any) {
      result.errors.push(`Configuration failed: ${error.message}`);
    }
  }

  /**
   * Enable advanced features for optimal experience
   */
  private async enableAdvancedFeatures(result: AutoSetupResult): Promise<void> {
    try {
      // Configure all available catalogs with optimal settings
      const enhancedConfig = {
        ...result.environment.optimizedConfig,
        // Enable all main sources by default
        enabledCatalogs: [
          'nyaa-anime-all',
          'nyaa-anime-trusted', 
          'nyaa-live-action',
          'nyaa-other'
        ],
        // Enhanced filtering
        enableQualityDetection: true,
        enableLanguageDetection: true,
        enableGenreDetection: true,
        // Better user experience
        enablePosters: true,
        enableSynopsis: true,
        enableTags: true,
        enableRatings: true,
        // Performance optimizations
        enableSmartCaching: true,
        enablePrefetching: result.environment.performance.totalMemoryMB > 2048,
      };

      await configurationService.saveUserConfiguration(enhancedConfig);
      result.actions.push('✅ Enabled advanced features: posters, synopsis, smart caching');

    } catch (error: any) {
      result.warnings.push(`Some advanced features could not be enabled: ${error.message}`);
    }
  }

  /**
   * Initialize cache with some default content
   */
  private async initializeCache(result: AutoSetupResult): Promise<void> {
    try {
      // Pre-warm cache with popular searches to improve first-time experience
      result.actions.push('Initializing cache for better performance...');
      
      // This will be implemented when the addon service is available
      // For now, just ensure cache service is ready
      await cacheService.set('auto_setup_completed', true, 86400); // 24 hours
      
      result.actions.push('✅ Cache initialized successfully');

    } catch (error: any) {
      result.warnings.push(`Cache initialization warning: ${error.message}`);
    }
  }

  /**
   * Verify the installation is working correctly
   */
  private async verifyInstallation(result: AutoSetupResult): Promise<void> {
    try {
      // Verify configuration was saved
      const savedConfig = await configurationService.getUserConfiguration();
      if (!savedConfig) {
        throw new Error('Configuration could not be verified');
      }

      // Verify cache is working
      const cacheTest = await cacheService.get('auto_setup_completed');
      if (!cacheTest) {
        throw new Error('Cache system could not be verified');
      }

      result.actions.push('✅ Installation verified successfully');

    } catch (error: any) {
      result.errors.push(`Installation verification failed: ${error.message}`);
    }
  }

  /**
   * Create helpful files and documentation
   */
  private async createHelpfulFiles(result: AutoSetupResult): Promise<void> {
    try {
      const platform = result.environment.platform;
      
      // Create platform-specific quick start guide
      const quickStartContent = this.generateQuickStartGuide(result);
      await this.writeFileIfNotExists('QUICK_START.md', quickStartContent);
      
      // Create Stremio installation URLs file
      const installUrlsContent = this.generateInstallationUrls();
      await this.writeFileIfNotExists('STREMIO_INSTALL.md', installUrlsContent);

      // Create troubleshooting guide for the specific platform
      const troubleshootingContent = this.generateTroubleshootingGuide(platform);
      await this.writeFileIfNotExists(`TROUBLESHOOTING_${platform.toUpperCase()}.md`, troubleshootingContent);

      result.actions.push('✅ Created helpful documentation and guides');

    } catch (error: any) {
      result.warnings.push(`Could not create some documentation files: ${error.message}`);
    }
  }

  /**
   * Generate quick start guide based on setup results
   */
  private generateQuickStartGuide(result: AutoSetupResult): string {
    const env = result.environment;
    const port = process.env.PORT || '3000';

    return `# 🚀 SukeNyaa Quick Start Guide

Your SukeNyaa addon has been automatically configured for optimal performance!

## 📱 Platform Detected
- **Platform**: ${env.platform}
- **Memory**: ${env.performance.totalMemoryMB}MB (${env.performance.cpuCores} cores)
- **Network**: ${env.networkCapabilities.canAccessNyaa ? 'Nyaa accessible' : 'Limited connectivity'}

## 🎯 Installation in Stremio

### 📱 For Stremio Android:
1. Open **Stremio** on your Android device
2. Go to **Add-ons** → **Community Add-ons**
3. Enter this URL: \`http://localhost:${port}/manifest.json\`
4. Tap **Install**

### 🖥️ For Stremio Desktop:
1. Open **Stremio** on your computer
2. Go to **Add-ons** → **Community Add-ons**  
3. Enter this URL: \`http://localhost:${port}/manifest.json\`
4. Click **Install**

## ✅ Everything is Pre-Configured!

Your addon is ready with these optimal settings:
- ✅ **All main sources enabled**: Anime, Trusted, Movies, Other
- ✅ **Smart filtering**: ${result.configuration.enableNsfwFilter ? 'NSFW content filtered' : 'All content available'}
- ✅ **Optimal quality**: ${result.configuration.preferredQuality?.join(', ') || 'Auto-detected'}
- ✅ **Performance optimized**: ${result.configuration.maxResults} results per page
- ✅ **Cache configured**: ${result.configuration.cacheTimeout}s timeout

## 🔧 Optional Configuration

While everything works out of the box, you can customize settings at:
- **Web Interface**: http://localhost:${port}/configure
- **API**: http://localhost:${port}/configure/api

## 🧪 Test Your Installation

Visit these URLs to verify everything works:
- **Test Page**: http://localhost:${port}/test
- **Health Check**: http://localhost:${port}/api/health
- **Manifest**: http://localhost:${port}/manifest.json

${env.networkCapabilities.recommendsVPN ? '\n⚠️ **VPN Recommended**: Nyaa.si appears to be blocked in your region. Consider using a VPN for the best experience.\n' : ''}

Enjoy your zero-configuration SukeNyaa experience! 🎉
`;
  }

  /**
   * Generate installation URLs documentation
   */
  private generateInstallationUrls(): string {
    const port = process.env.PORT || '3000';

    return `# 📱 Stremio Installation URLs

## Main Installation URL
\`\`\`
http://localhost:${port}/manifest.json
\`\`\`

## Alternative Local Network URLs
If you're accessing from another device on the same network:

### Find Your Local IP:
**On Android/Termux:**
\`\`\`bash
# Method 1
ip route get 8.8.8.8 | awk '{print $7}'

# Method 2  
ifconfig | grep "inet " | grep -v 127.0.0.1
\`\`\`

**On Desktop:**
- Windows: \`ipconfig\`
- Mac/Linux: \`ifconfig\` or \`ip addr\`

### Then use:
\`\`\`
http://[YOUR_LOCAL_IP]:${port}/manifest.json
\`\`\`

## Testing URLs

### Health Check:
\`\`\`
http://localhost:${port}/api/health
\`\`\`

### Interactive Test Page:
\`\`\`
http://localhost:${port}/test
\`\`\`

### Configuration Interface:
\`\`\`
http://localhost:${port}/configure
\`\`\`

---
**Note**: Keep this server running while using Stremio with SukeNyaa addon.
`;
  }

  /**
   * Generate platform-specific troubleshooting guide
   */
  private generateTroubleshootingGuide(platform: string): string {
    const baseGuide = `# 🔧 Troubleshooting Guide - ${platform.toUpperCase()}

## Common Issues and Quick Fixes

### 1. "Add-on couldn't be detected"
- ✅ **Check server is running**: Visit http://localhost:3000/api/health
- ✅ **Verify URL**: Ensure you're using \`http://localhost:3000/manifest.json\`
- ✅ **Restart server**: Stop and start the SukeNyaa server

### 2. Empty Catalog / No Content
- ✅ **Test connectivity**: Visit http://localhost:3000/test
- ✅ **Check network**: Run \`curl -I https://nyaa.si\`
- ✅ **Reset config**: Visit http://localhost:3000/configure and reset to defaults

### 3. Slow Performance
- ✅ **Reduce results**: Lower max results in configuration
- ✅ **Enable trusted only**: Filter to trusted uploaders only
- ✅ **Close other apps**: Free up memory on your device

`;

    const platformSpecific = {
      termux: `
### Termux-Specific Issues

#### 4. "Permission denied" errors
\`\`\`bash
termux-setup-storage
pkg update && pkg upgrade
\`\`\`

#### 5. "Network unreachable"
\`\`\`bash
# Check DNS
nslookup nyaa.si

# Reset network
pkill -f nodejs
npm start
\`\`\`

#### 6. "Out of memory" 
\`\`\`bash
# Clear cache
npm run clean
# Restart Termux app completely
\`\`\`
`,
      android: `
### Android-Specific Issues

#### 4. App keeps stopping
- Close other apps to free memory
- Restart your device
- Check available storage space

#### 5. Network connection issues
- Switch between WiFi and mobile data
- Disable battery optimization for Termux
- Keep screen on while using
`,
      desktop: `
### Desktop-Specific Issues

#### 4. Firewall blocking connections
- Add exception for port 3000
- Temporarily disable firewall to test

#### 5. Multiple Node.js versions
\`\`\`bash
node --version  # Should be 16.0.0 or higher
npm --version
\`\`\`
`,
      docker: `
### Docker-Specific Issues

#### 4. Port mapping problems
\`\`\`bash
docker run -p 3000:3000 sukenyaa
\`\`\`

#### 5. Volume mounting issues
\`\`\`bash
docker run -v $(pwd):/app sukenyaa
\`\`\`
`
    };

    return baseGuide + (platformSpecific[platform as keyof typeof platformSpecific] || '');
  }

  /**
   * Write file if it doesn't exist
   */
  private async writeFileIfNotExists(filename: string, content: string): Promise<void> {
    try {
      const filePath = path.join(process.cwd(), filename);
      await fs.access(filePath);
      // File exists, don't overwrite
    } catch {
      // File doesn't exist, create it
      const filePath = path.join(process.cwd(), filename);
      await fs.writeFile(filePath, content, 'utf8');
    }
  }

  /**
   * Check if auto-setup has been completed
   */
  async isSetupCompleted(): Promise<boolean> {
    if (this.setupCompleted) {
      return true;
    }

    try {
      const cached = await cacheService.get('auto_setup_completed');
      this.setupCompleted = !!cached;
      return this.setupCompleted;
    } catch {
      return false;
    }
  }

  /**
   * Force re-run of auto-setup
   */
  async resetAndRerun(): Promise<AutoSetupResult> {
    this.setupCompleted = false;
    await cacheService.del('auto_setup_completed');
    return this.performAutoSetup();
  }

  /**
   * Get setup status for API endpoints
   */
  async getSetupStatus(): Promise<{
    completed: boolean;
    environment?: EnvironmentInfo;
    lastSetup?: Date;
  }> {
    const completed = await this.isSetupCompleted();
    
    if (!completed) {
      return { completed: false };
    }

    try {
      const environment = await environmentService.detectEnvironment();
      return {
        completed: true,
        environment,
        lastSetup: new Date(), // Could be stored in cache for accuracy
      };
    } catch {
      return { completed };
    }
  }
}

export const autoSetupService = new AutoSetupService();
export default autoSetupService;