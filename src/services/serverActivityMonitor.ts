import { logger } from '../utils/logger';
import { cacheService } from './cache';

interface ServerActivity {
  lastRequestTime: number;
  requestCount: number;
  isActive: boolean;
  heartbeatInterval?: NodeJS.Timeout;
  termuxInBackground: boolean;
  activityWarning: boolean;
}

export class ServerActivityMonitor {
  private activity: ServerActivity = {
    lastRequestTime: Date.now(),
    requestCount: 0,
    isActive: true,
    termuxInBackground: false,
    activityWarning: false,
  };

  private readonly inactivityThresholdMs = 5 * 60 * 1000; // 5 minutes
  private readonly heartbeatIntervalMs = 30 * 1000; // 30 seconds
  private readonly backgroundDetectionDelayMs = 2 * 60 * 1000; // 2 minutes

  constructor() {
    this.startHeartbeat();
    this.setupTermuxDetection();
    logger.info({
      inactivityThreshold: this.inactivityThresholdMs / 1000,
      heartbeatInterval: this.heartbeatIntervalMs / 1000,
    }, 'Server activity monitor initialized');
  }

  recordActivity(source: 'request' | 'heartbeat' | 'user_interaction' = 'request'): void {
    const now = Date.now();
    
    if (source === 'request') {
      this.activity.requestCount++;
    }

    const wasInactive = !this.activity.isActive;
    this.activity.lastRequestTime = now;
    this.activity.isActive = true;

    // Reset background detection if activity is detected
    if (this.activity.termuxInBackground) {
      this.activity.termuxInBackground = false;
      logger.info('Termux activity detected - background status cleared');
    }

    // Reset warning flag
    if (this.activity.activityWarning) {
      this.activity.activityWarning = false;
      logger.info('Server activity warning cleared');
    }

    if (wasInactive) {
      logger.info({ 
        source,
        inactiveFor: (now - this.activity.lastRequestTime) / 1000,
        requestCount: this.activity.requestCount,
      }, 'Server activity resumed');
    }
  }

  private startHeartbeat(): void {
    this.activity.heartbeatInterval = setInterval(() => {
      this.checkActivityStatus();
      this.recordActivity('heartbeat');
    }, this.heartbeatIntervalMs);
  }

  private checkActivityStatus(): void {
    const now = Date.now();
    const timeSinceLastActivity = now - this.activity.lastRequestTime;
    
    if (timeSinceLastActivity > this.inactivityThresholdMs) {
      if (this.activity.isActive) {
        this.activity.isActive = false;
        logger.warn({
          inactiveFor: timeSinceLastActivity / 1000,
          threshold: this.inactivityThresholdMs / 1000,
          isAndroid: this.isAndroidEnvironment(),
          termuxDetected: this.isTermuxEnvironment(),
        }, 'Server inactivity detected - possible background mode');
      }

      // Check for Termux background mode
      if (this.isTermuxEnvironment() && timeSinceLastActivity > this.backgroundDetectionDelayMs) {
        if (!this.activity.termuxInBackground) {
          this.activity.termuxInBackground = true;
          this.activity.activityWarning = true;
          
          logger.warn({
            inactiveFor: timeSinceLastActivity / 1000,
            termuxBackground: true,
            androidTips: this.getAndroidTroubleshootingTips(),
          }, 'Termux background mode detected - server may be paused');
        }
      }
    }
  }

  private setupTermuxDetection(): void {
    // Detect if running in Termux by checking environment variables
    if (this.isTermuxEnvironment()) {
      logger.info({
        termuxVersion: process.env.TERMUX_VERSION,
        home: process.env.HOME,
        prefix: process.env.PREFIX,
      }, 'Termux environment detected - enhanced monitoring enabled');

      // Set up process monitoring for Termux-specific events
      process.on('SIGTSTP', () => {
        logger.warn('SIGTSTP received - Termux may be going to background');
        this.activity.termuxInBackground = true;
      });

      process.on('SIGCONT', () => {
        logger.info('SIGCONT received - Termux resumed from background');
        this.recordActivity('user_interaction');
      });
    }
  }

  private isTermuxEnvironment(): boolean {
    return !!(
      process.env.TERMUX_VERSION ||
      process.env.PREFIX?.includes('com.termux') ||
      process.env.HOME?.includes('com.termux')
    );
  }

  private isAndroidEnvironment(): boolean {
    return process.platform === 'linux' && (
      this.isTermuxEnvironment() ||
      process.env.ANDROID_ROOT !== undefined ||
      process.env.ANDROID_DATA !== undefined
    );
  }

  getActivityStatus(): {
    isActive: boolean;
    lastActivity: string;
    inactiveForSeconds: number;
    requestCount: number;
    termuxInBackground: boolean;
    activityWarning: boolean;
    platform: {
      isAndroid: boolean;
      isTermux: boolean;
      environment: string;
    };
    recommendations: string[];
  } {
    const now = Date.now();
    const inactiveForSeconds = Math.floor((now - this.activity.lastRequestTime) / 1000);
    
    return {
      isActive: this.activity.isActive,
      lastActivity: new Date(this.activity.lastRequestTime).toISOString(),
      inactiveForSeconds,
      requestCount: this.activity.requestCount,
      termuxInBackground: this.activity.termuxInBackground,
      activityWarning: this.activity.activityWarning,
      platform: {
        isAndroid: this.isAndroidEnvironment(),
        isTermux: this.isTermuxEnvironment(),
        environment: this.getEnvironmentDescription(),
      },
      recommendations: this.getRecommendations(),
    };
  }

  private getEnvironmentDescription(): string {
    if (this.isTermuxEnvironment()) {
      return `Termux ${process.env.TERMUX_VERSION || 'unknown version'}`;
    } else if (this.isAndroidEnvironment()) {
      return 'Android (non-Termux)';
    } else {
      return `${process.platform} ${process.arch}`;
    }
  }

  private getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.activity.termuxInBackground) {
      recommendations.push(...this.getAndroidTroubleshootingTips());
    } else if (!this.activity.isActive) {
      recommendations.push(
        'Server appears inactive - check network connectivity',
        'Ensure Stremio is making requests to the addon',
        'Try refreshing your Stremio library or reopening the app'
      );
    } else {
      recommendations.push(
        'Server is active and responding normally',
        'All systems operating as expected'
      );
    }

    return recommendations;
  }

  private getAndroidTroubleshootingTips(): string[] {
    return [
      '📱 Keep Termux app open and in foreground when possible',
      '🔋 Disable battery optimization for Termux in Android settings',
      '⚡ Use "termux-wake-lock" to prevent system from sleeping',
      '🛡️ Add Termux to protected apps list (manufacturer-specific)',
      '📲 Use a session manager like "screen" or "tmux" to persist sessions',
      '🔄 Restart the SukeNyaa server if it becomes unresponsive',
      '🌐 Check that your network connection is stable',
      '⏰ Consider running server restart scripts periodically',
    ];
  }

  async generateActivityReport(): Promise<any> {
    const status = this.getActivityStatus();
    const cacheStats = cacheService.getStats();

    return {
      timestamp: new Date().toISOString(),
      server: status,
      cache: cacheStats,
      termuxSpecific: this.isTermuxEnvironment() ? {
        version: process.env.TERMUX_VERSION,
        home: process.env.HOME,
        prefix: process.env.PREFIX,
        wakeLockAvailable: this.checkWakeLockAvailability(),
        sessionManager: this.detectSessionManager(),
      } : undefined,
      troubleshooting: {
        nextSteps: status.activityWarning 
          ? this.getAndroidTroubleshootingTips()
          : ['Server is operating normally'],
        diagnosticCommands: this.isTermuxEnvironment() ? [
          'termux-wake-lock',
          'top -n 1',
          'netstat -tlnp | grep 3000',
          'curl -s http://localhost:3000/api/health'
        ] : [
          'curl -s http://localhost:3000/api/health',
          'netstat -tlnp | grep 3000'
        ]
      }
    };
  }

  private checkWakeLockAvailability(): boolean {
    try {
      // Check if termux-wake-lock command is available
      const { execSync } = require('child_process');
      execSync('which termux-wake-lock', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private detectSessionManager(): string | null {
    try {
      const { execSync } = require('child_process');
      
      // Check for tmux
      try {
        execSync('which tmux', { stdio: 'ignore' });
        return 'tmux available';
      } catch {}
      
      // Check for screen
      try {
        execSync('which screen', { stdio: 'ignore' });
        return 'screen available';
      } catch {}
      
      return null;
    } catch {
      return null;
    }
  }

  stop(): void {
    if (this.activity.heartbeatInterval) {
      clearInterval(this.activity.heartbeatInterval);
      delete this.activity.heartbeatInterval;
      logger.info('Server activity monitor stopped');
    }
  }
}

export const serverActivityMonitor = new ServerActivityMonitor();
export default serverActivityMonitor;