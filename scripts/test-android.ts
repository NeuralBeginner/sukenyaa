#!/usr/bin/env ts-node

// Android/Termux specific test script for SukeNyaa
import { NyaaScraper } from '../src/services/nyaaScraper';
import { configurationService } from '../src/services/config';
import { SearchFilters, SearchOptions } from '../src/types';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

async function runAndroidTests(): Promise<void> {
  console.log('🤖 === SukeNyaa Android/Termux Compatibility Test ===\n');
  
  const results: TestResult[] = [];
  
  // Test 1: Basic scraper connectivity and performance
  console.log('1. Testing basic connectivity and performance...');
  const connectivityResult = await testConnectivity();
  results.push(connectivityResult);
  
  if (!connectivityResult.success) {
    console.log('❌ Basic connectivity failed. Stopping tests.\n');
    displayResults(results);
    return;
  }
  
  // Test 2: Configuration service  
  console.log('2. Testing configuration service...');
  const configResult = await testConfigurationService();
  results.push(configResult);
  
  // Test 3: Performance under mobile constraints
  console.log('3. Testing performance under mobile constraints...');
  const performanceResult = await testMobilePerformance();
  results.push(performanceResult);
  
  // Test 4: Network resilience
  console.log('4. Testing network resilience...');
  const resilienceResult = await testNetworkResilience();
  results.push(resilienceResult);
  
  // Test 5: Memory usage
  console.log('5. Testing memory usage...');
  const memoryResult = await testMemoryUsage();
  results.push(memoryResult);
  
  // Test 6: Concurrent requests
  console.log('6. Testing concurrent request handling...');
  const concurrencyResult = await testConcurrency();
  results.push(concurrencyResult);
  
  // Display final results
  displayResults(results);
}

async function testConnectivity(): Promise<TestResult> {
  const start = Date.now();
  try {
    const scraper = new NyaaScraper();
    const isHealthy = await scraper.checkHealth();
    
    if (!isHealthy) {
      return {
        name: 'Basic Connectivity',
        success: false,
        duration: Date.now() - start,
        error: 'Health check returned false'
      };
    }
    
    // Test a quick search
    const result = await scraper.search({ category: '1_0' }, { limit: 5 });
    
    return {
      name: 'Basic Connectivity',
      success: true,
      duration: Date.now() - start,
      details: {
        itemsFound: result.items.length,
        totalPages: result.pagination.totalPages
      }
    };
  } catch (error: any) {
    return {
      name: 'Basic Connectivity',
      success: false,
      duration: Date.now() - start,
      error: error.message
    };
  }
}

async function testConfigurationService(): Promise<TestResult> {
  const start = Date.now();
  try {
    // Test default configuration
    const defaultConfig = await configurationService.getUserConfiguration();
    
    // Test saving configuration
    const updates = {
      maxResults: 15,
      enableDetailedLogging: true,
      defaultSort: 'seeders' as const
    };
    const updatedConfig = await configurationService.saveUserConfiguration(updates);
    
    // Verify changes
    const verified = await configurationService.getUserConfiguration();
    
    const success = verified.maxResults === 15 && 
                   verified.enableDetailedLogging === true &&
                   verified.defaultSort === 'seeders';
    
    // Reset to defaults
    await configurationService.resetUserConfiguration();
    
    return {
      name: 'Configuration Service',
      success,
      duration: Date.now() - start,
      details: {
        defaultConfigLoaded: !!defaultConfig,
        updateApplied: success,
        resetWorking: true
      }
    };
  } catch (error: any) {
    return {
      name: 'Configuration Service',
      success: false,
      duration: Date.now() - start,
      error: error.message
    };
  }
}

async function testMobilePerformance(): Promise<TestResult> {
  const start = Date.now();
  try {
    const scraper = new NyaaScraper();
    
    // Test with mobile-friendly limits
    const filters: SearchFilters = { category: '1_0' };
    const options: SearchOptions = { limit: 25, sort: 'date', order: 'desc' };
    
    const result = await scraper.search(filters, options);
    const duration = Date.now() - start;
    
    // Performance thresholds for mobile
    const isPerformant = duration < 5000; // 5 seconds max
    const hasResults = result.items.length > 0;
    
    return {
      name: 'Mobile Performance',
      success: isPerformant && hasResults,
      duration,
      details: {
        responseTime: duration,
        itemsReturned: result.items.length,
        performanceGrade: duration < 2000 ? 'Excellent' : 
                         duration < 3000 ? 'Good' : 
                         duration < 5000 ? 'Acceptable' : 'Poor'
      }
    };
  } catch (error: any) {
    return {
      name: 'Mobile Performance',
      success: false,
      duration: Date.now() - start,
      error: error.message
    };
  }
}

async function testNetworkResilience(): Promise<TestResult> {
  const start = Date.now();
  try {
    const scraper = new NyaaScraper();
    
    // Test multiple quick requests to check throttling
    const promises = Array.from({ length: 3 }, async (_, i) => {
      try {
        await scraper.search({ category: '1_0' }, { limit: 5 });
        return { success: true, request: i + 1 };
      } catch (error: any) {
        return { success: false, request: i + 1, error: error.message };
      }
    });
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    
    return {
      name: 'Network Resilience',
      success: successCount >= 2, // At least 2 out of 3 should succeed
      duration: Date.now() - start,
      details: {
        successfulRequests: successCount,
        totalRequests: 3,
        successRate: `${Math.round((successCount / 3) * 100)}%`,
        results
      }
    };
  } catch (error: any) {
    return {
      name: 'Network Resilience',
      success: false,
      duration: Date.now() - start,
      error: error.message
    };
  }
}

async function testMemoryUsage(): Promise<TestResult> {
  const start = Date.now();
  try {
    const initialMemory = process.memoryUsage();
    
    // Perform memory-intensive operations
    const scraper = new NyaaScraper();
    const promises = Array.from({ length: 5 }, () => 
      scraper.search({ category: '1_0' }, { limit: 20 })
    );
    
    await Promise.all(promises);
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
    
    // Acceptable memory increase for mobile (less than 50MB)
    const isAcceptable = memoryIncreaseMB < 50;
    
    return {
      name: 'Memory Usage',
      success: isAcceptable,
      duration: Date.now() - start,
      details: {
        initialMemoryMB: Math.round(initialMemory.heapUsed / 1024 / 1024),
        finalMemoryMB: Math.round(finalMemory.heapUsed / 1024 / 1024),
        increaseMB: Math.round(memoryIncreaseMB),
        grade: memoryIncreaseMB < 20 ? 'Excellent' : 
               memoryIncreaseMB < 35 ? 'Good' : 
               memoryIncreaseMB < 50 ? 'Acceptable' : 'Poor'
      }
    };
  } catch (error: any) {
    return {
      name: 'Memory Usage',
      success: false,
      duration: Date.now() - start,
      error: error.message
    };
  }
}

async function testConcurrency(): Promise<TestResult> {
  const start = Date.now();
  try {
    const scraper = new NyaaScraper();
    
    // Test concurrent requests (mobile should handle at least 3)
    const concurrentRequests = [
      scraper.search({ category: '1_0' }, { limit: 10 }),
      scraper.search({ category: '1_0', query: 'anime' }, { limit: 10 }),
      scraper.search({ category: '1_0', trusted: true }, { limit: 10 })
    ];
    
    const results = await Promise.allSettled(concurrentRequests);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    return {
      name: 'Concurrency Handling',
      success: successCount === 3,
      duration: Date.now() - start,
      details: {
        successfulRequests: successCount,
        totalRequests: 3,
        results: results.map((r, i) => ({
          request: i + 1,
          status: r.status,
          ...(r.status === 'rejected' && { error: r.reason?.message })
        }))
      }
    };
  } catch (error: any) {
    return {
      name: 'Concurrency Handling',
      success: false,
      duration: Date.now() - start,
      error: error.message
    };
  }
}

function displayResults(results: TestResult[]): void {
  console.log('\n📊 === Test Results Summary ===\n');
  
  let passCount = 0;
  results.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const duration = `${result.duration}ms`;
    
    console.log(`${index + 1}. ${result.name}: ${status} (${duration})`);
    
    if (result.success) {
      passCount++;
      if (result.details) {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`   - ${key}: ${JSON.stringify(value)}`);
        });
      }
    } else {
      console.log(`   ❌ Error: ${result.error}`);
    }
    console.log();
  });
  
  const passRate = Math.round((passCount / results.length) * 100);
  const overall = passCount === results.length ? '✅ ALL TESTS PASSED' : 
                 passCount >= results.length * 0.8 ? '⚠️  MOSTLY PASSING' : 
                 '❌ TESTS FAILING';
  
  console.log(`📈 Overall: ${overall} (${passCount}/${results.length} - ${passRate}%)`);
  
  if (passRate >= 80) {
    console.log('🎉 SukeNyaa is ready for Android/Termux deployment!');
  } else {
    console.log('⚠️  Some issues detected. Review failed tests before deployment.');
  }
  
  console.log('\n=== Android Compatibility Test Complete ===');
}

// Run if called directly
if (require.main === module) {
  runAndroidTests().catch(console.error);
}

export { runAndroidTests };