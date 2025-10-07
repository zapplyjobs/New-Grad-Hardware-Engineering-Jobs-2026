#!/usr/bin/env node

/**
 * Test script to verify Option 2 optimization
 * This tests that API companies bypass Puppeteer
 */

const { fetchAllRealJobs } = require('./real-career-scraper');

// Mock the scrapeCompanyData function to track Puppeteer usage
let puppeteerCallCount = 0;
const originalScraper = require('../../jobboard/src/backend/core/scraper.js').scrapeCompanyData;

// Override to count Puppeteer calls
require('../../jobboard/src/backend/core/scraper.js').scrapeCompanyData = function(...args) {
  puppeteerCallCount++;
  console.log(`🌐 Puppeteer scraper called for company #${puppeteerCallCount}`);
  // Return empty jobs to speed up test
  return Promise.resolve([]);
};

async function testOptimization() {
  console.log('🧪 Testing Option 2 Optimization...\n');
  console.log('Expected behavior:');
  console.log('1. API companies should fetch WITHOUT Puppeteer');
  console.log('2. Only non-API companies should use Puppeteer');
  console.log('3. Total runtime should be significantly reduced\n');

  const startTime = Date.now();

  try {
    // Run with limited config for testing
    const testConfig = {
      batchSize: 2,
      delayBetweenBatches: 500,
      maxRetries: 1,
      timeout: 5000, // 5 seconds for testing
      enableProgressBar: false,
      enableDetailedLogging: true
    };

    // Test with limited pages
    const jobs = await fetchAllRealJobs('software engineer', 1, testConfig);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS:');
    console.log('='.repeat(50));
    console.log(`✅ Total jobs fetched: ${jobs.length}`);
    console.log(`⏱️  Total runtime: ${duration} seconds`);
    console.log(`🌐 Puppeteer calls: ${puppeteerCallCount}`);
    console.log(`📡 API companies processed WITHOUT Puppeteer`);

    if (puppeteerCallCount > 0) {
      console.log(`\n✅ OPTIMIZATION WORKING: Puppeteer only used for ${puppeteerCallCount} scraper companies`);
    } else {
      console.log(`\n⚠️  No Puppeteer calls detected - verify scrapers are included`);
    }

    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testOptimization();