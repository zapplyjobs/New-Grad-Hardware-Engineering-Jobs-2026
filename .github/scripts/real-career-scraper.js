const fs = require("fs");
const { generateJobId } = require("./job-fetcher/utils");
const { isUSOnlyJob } = require("./job-fetcher/utils");
const { filterJobsByLevel } = require("./job-fetcher/utils");
const { filterHardwareEngineeringJobs } = require("./job-fetcher/utils.js");
const { scrapeCompanyData } = require('../../jobboard/src/backend/core/scraper.js');
const { getCompanies } = require('../../jobboard/src/backend/config/companies.js');
const { transformJobs, convertDateToRelative } = require('../../jobboard/src/backend/output/jobTransformer.js');

// Load company database
const companies = JSON.parse(
  fs.readFileSync("./.github/scripts/job-fetcher/companies.json", "utf8")
);
const ALL_COMPANIES = Object.values(companies).flat();

const BATCH_CONFIG = {
  batchSize: 18,
  delayBetweenBatches: 2000,
  maxRetries: 1,
  timeout: 900000,
  enableProgressBar: true,
  enableDetailedLogging: true
};

function safeISOString(dateValue) {
    console.log("Input dateValue:", dateValue);
    if (!dateValue) return new Date().toISOString();
    
    try {
        const date = new Date(dateValue);
        console.log("Parsed date:", date);
        console.log("Is valid:", !isNaN(date.getTime()));
        if (isNaN(date.getTime())) {
            console.log("Invalid date, returning current date");
            return new Date().toISOString();
        }
        return date.toISOString();
    } catch (error) {
        console.log("Error:", error);
        return new Date().toISOString();
    }
}

function createBatchConfig(options = {}) {
  return {
    ...BATCH_CONFIG,
    ...options
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllRealJobs(searchQuery = 'hardware engineering', maxPages = 3, batchConfig = BATCH_CONFIG) {
  console.log("🚀 Starting REAL career page scraping...");

  let allJobs = [];
  const companies = getCompanies(searchQuery);
  const companyKeys = Object.keys(companies);

  const executionId = Date.now();
  console.log(`🔍 Execution ID: ${executionId}`);

  const scraperConfigs = companyKeys.map(companyKey => ({
    name: companies[companyKey].name,
    companyKey: companyKey,
    scraper: () => scrapeCompanyData(companyKey, searchQuery, maxPages),
    query: searchQuery,
    executionId
  }));

  async function processScrapersInBatches(configs, config = batchConfig) {
    const results = [];
    const totalBatches = Math.ceil(configs.length / config.batchSize);
    const processedCompanies = new Set();

    const overallProgress = {
      totalCompanies: configs.length,
      processedCompanies: 0,
      successfulCompanies: 0,
      failedCompanies: 0,
      skippedCompanies: 0,
      totalJobsCollected: 0,
      startTime: Date.now(),
      batchResults: []
    };

    const companiesStatus = {
      successful: [],
      failed: [],
      skipped: []
    };

    console.log(`🚀 Starting optimized batch processing:`);
    console.log(`   📊 Total scrapers: ${configs.length}`);
    console.log(`   📦 Batch size: ${config.batchSize} companies per batch`);
    console.log(`   ⏱️  Total batches: ${totalBatches}`);
    console.log(`   ⏳ Delay between batches: ${config.delayBetweenBatches}ms`);
    console.log(`   🔄 Max retries: ${config.maxRetries}`);
    console.log(`   🕐 Started at: ${new Date().toLocaleTimeString()}`);

    for (let i = 0; i < configs.length; i += config.batchSize) {
      const batch = configs.slice(i, i + config.batchSize);
      const batchNumber = Math.floor(i / config.batchSize) + 1;
      const batchStartTime = Date.now();

      console.log(`\n📦 Processing Batch ${batchNumber}/${totalBatches}: ${batch.map(c => c.name).join(', ')}`);

      const filteredBatch = batch.filter(scraperConfig => {
        if (processedCompanies.has(scraperConfig.companyKey)) {
          console.log(`⚠️ Skipping already processed company: ${scraperConfig.name}`);
          companiesStatus.skipped.push(scraperConfig.name);
          overallProgress.skippedCompanies++;
          return false;
        }
        processedCompanies.add(scraperConfig.companyKey);
        return true;
      });

      if (filteredBatch.length === 0) {
        console.log(`⏭️ Skipping batch ${batchNumber} - all companies already processed`);
        continue;
      }

      const batchProgress = {
        batchNumber,
        companies: filteredBatch.map(c => c.name),
        successful: [],
        failed: [],
        totalJobs: 0,
        duration: 0,
        startTime: batchStartTime
      };

      const batchPromises = filteredBatch.map(async (scraperConfig) => {
        let lastError = null;
        let startTime = Date.now();

        for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
          try {
            startTime = Date.now();

            let jobs;
            if (config.timeout > 0) {
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Scraper timeout')), config.timeout);
              });

              jobs = await Promise.race([
                scraperConfig.scraper(),
                timeoutPromise
              ]);
            } else {
              jobs = await scraperConfig.scraper();
            }

            const duration = Date.now() - startTime;
            overallProgress.processedCompanies++;
            overallProgress.successfulCompanies++;
            overallProgress.totalJobsCollected += jobs?.length || 0;

            const successInfo = {
              name: scraperConfig.name,
              jobs: jobs?.length || 0,
              duration,
              attempts: attempt
            };
            companiesStatus.successful.push(successInfo);
            batchProgress.successful.push(successInfo);
            batchProgress.totalJobs += jobs?.length || 0;

            if (config.enableDetailedLogging) {
              console.log(`✅ ${scraperConfig.name}: ${jobs?.length || 0} jobs in ${duration}ms (Attempt ${attempt})`);
            }

            return {
              name: scraperConfig.name,
              companyKey: scraperConfig.companyKey,
              jobs: jobs || [],
              duration,
              success: true,
              attempts: attempt,
              error: null
            };

          } catch (error) {
            lastError = error;
            if (config.enableDetailedLogging) {
              console.log(`⚠️  ${scraperConfig.name} attempt ${attempt} failed: ${error.message}`);
            }

            if (attempt === config.maxRetries) {
              const duration = Date.now() - startTime;
              overallProgress.processedCompanies++;
              overallProgress.failedCompanies++;

              const failInfo = {
                name: scraperConfig.name,
                error: error.message,
                duration,
                attempts: attempt
              };
              companiesStatus.failed.push(failInfo);
              batchProgress.failed.push(failInfo);

              console.error(`❌ ${scraperConfig.name} failed after ${config.maxRetries} attempts: ${error.message}. Skipping company.`);

              return {
                name: scraperConfig.name,
                companyKey: scraperConfig.companyKey,
                jobs: [],
                duration: duration,
                success: false,
                attempts: attempt,
                error: error.message
              };
            }

            const baseDelay = 2000 * Math.pow(2, attempt - 1);
            const jitter = Math.random() * 1000;
            const retryDelay = Math.min(baseDelay + jitter, 10000);
            if (config.enableDetailedLogging) {
              console.log(`⏳ Retrying ${scraperConfig.name} in ${retryDelay.toFixed(0)}ms...`);
            }
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      });

      let batchResults;
      try {
        batchResults = await Promise.all(batchPromises);
      } catch (batchError) {
        console.error(`❌ Batch ${batchNumber} had an unhandled error: ${batchError.message}. Continuing with available results.`);
        batchResults = [];
      }
      results.push(...batchResults.filter(result => result));

      batchProgress.duration = Date.now() - batchStartTime;
      overallProgress.batchResults.push(batchProgress);

      const progressPercent = ((overallProgress.processedCompanies / overallProgress.totalCompanies) * 100).toFixed(1);
      const elapsedTime = Date.now() - overallProgress.startTime;
      const avgTimePerCompany = overallProgress.processedCompanies > 0 ? elapsedTime / overallProgress.processedCompanies : 0;
      const estimatedTimeRemaining = avgTimePerCompany * (overallProgress.totalCompanies - overallProgress.processedCompanies);

      console.log(`\n🏁 Batch ${batchNumber}/${totalBatches} Completed in ${(batchProgress.duration/1000).toFixed(1)}s:`);
      console.log(`   ✅ Successful: ${batchProgress.successful.length} companies`);
      console.log(`   ❌ Failed: ${batchProgress.failed.length} companies`);
      console.log(`   📊 Jobs collected in this batch: ${batchProgress.totalJobs}`);

      if (batchProgress.successful.length > 0) {
        console.log(`   🎯 Successful companies: ${batchProgress.successful.map(s => `${s.name}(${s.jobs})`).join(', ')}`);
      }

      if (batchProgress.failed.length > 0) {
        console.log(`   💥 Failed companies: ${batchProgress.failed.map(f => `${f.name}(${f.error.substring(0, 30)}...)`).join(', ')}`);
      }

      console.log(`\n📈 Overall Progress: ${overallProgress.processedCompanies}/${overallProgress.totalCompanies} (${progressPercent}%)`);
      console.log(`   ✅ Total Successful: ${overallProgress.successfulCompanies}`);
      console.log(`   ❌ Total Failed: ${overallProgress.failedCompanies}`);
      console.log(`   ⏭️  Total Skipped: ${overallProgress.skippedCompanies}`);
      console.log(`   📊 Total Jobs Collected: ${overallProgress.totalJobsCollected}`);
      console.log(`   ⏱️  Elapsed Time: ${(elapsedTime/1000).toFixed(1)}s`);
      console.log(`   🔮 Estimated Time Remaining: ${(estimatedTimeRemaining/1000).toFixed(1)}s`);

      if (i + config.batchSize < configs.length) {
        console.log(`⏳ Waiting ${config.delayBetweenBatches}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, config.delayBetweenBatches));
      }
    }

    const totalDuration = Date.now() - overallProgress.startTime;
    console.log(`\n🏆 ===== BATCH PROCESSING COMPLETE =====`);
    console.log(`🕐 Total Duration: ${(totalDuration/1000).toFixed(1)}s (${(totalDuration/60000).toFixed(1)} minutes)`);
    console.log(`📊 Final Statistics:`);
    console.log(`   📈 Total Companies Processed: ${overallProgress.processedCompanies}/${overallProgress.totalCompanies}`);
    console.log(`   ✅ Successful Companies: ${overallProgress.successfulCompanies} (${((overallProgress.successfulCompanies/overallProgress.totalCompanies)*100).toFixed(1)}%)`);
    console.log(`   ❌ Failed Companies: ${overallProgress.failedCompanies} (${((overallProgress.failedCompanies/overallProgress.totalCompanies)*100).toFixed(1)}%)`);
    console.log(`   ⏭️  Skipped Companies: ${overallProgress.skippedCompanies} (${((overallProgress.skippedCompanies/overallProgress.totalCompanies)*100).toFixed(1)}%)`);
    console.log(`   📊 Total Jobs Collected: ${overallProgress.totalJobsCollected}`);
    console.log(`   ⚡ Average Jobs per Successful Company: ${overallProgress.successfulCompanies > 0 ? (overallProgress.totalJobsCollected/overallProgress.successfulCompanies).toFixed(1) : 0}`);

    console.log(`\n🎉 Successful Companies (${companiesStatus.successful.length}):`);
    companiesStatus.successful
      .sort((a, b) => b.jobs - a.jobs)
      .forEach((company, index) => {
        console.log(`   ${index + 1}. ${company.name}: ${company.jobs} jobs (${(company.duration/1000).toFixed(1)}s, ${company.attempts} attempts)`);
      });

    if (companiesStatus.failed.length > 0) {
      console.log(`\n💥 Failed Companies (${companiesStatus.failed.length}):`);
      companiesStatus.failed.forEach((company, index) => {
        console.log(`   ${index + 1}. ${company.name}: ${company.error} (${(company.duration/1000).toFixed(1)}s, ${company.attempts} attempts)`);
      });
    }

    if (companiesStatus.skipped.length > 0) {
      console.log(`\n⏭️ Skipped Companies (${companiesStatus.skipped.length}):`);
      companiesStatus.skipped.forEach((company, index) => {
        console.log(`   ${index + 1}. ${company}`);
      });
    }

    console.log(`🏁 Batch processing completed. Total results: ${results.length}`);
    return results;
  }

  const batchResults = await processScrapersInBatches(scraperConfigs, batchConfig);

  const processedJobIds = new Set();

  batchResults.forEach(result => {
    if (result.success && result.jobs && result.jobs.length > 0) {
      try {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔍 LOCATION DEBUGGING for ${result.name}`);
        console.log(`${'='.repeat(80)}`);
        console.log(`📊 Total raw jobs before transformation: ${result.jobs.length}`);
        
        // Log first 5 jobs with their raw location data
        const sampleSize = Math.min(5, result.jobs.length);
        console.log(`\n📍 Sample of raw location data (first ${sampleSize} jobs):`);
        
        result.jobs.slice(0, sampleSize).forEach((job, index) => {
          console.log(`\n   Job ${index + 1}:`);
          console.log(`   ├─ Company: ${job.company}`);
          console.log(`   ├─ Title: ${job.title}`);
          console.log(`   ├─ Raw Location: "${job.location}"`);
          console.log(`   ├─ Location Type: ${typeof job.location}`);
          console.log(`   ├─ Location Length: ${job.location ? job.location.length : 0}`);
          console.log(`   └─ Location (trimmed): "${job.location ? job.location.trim() : 'N/A'}"`);
        });
        
        console.log(`\n🔄 Now transforming ${result.jobs.length} jobs from ${result.name}...`);
        const transformedJobs = transformJobs(result.jobs, searchQuery);
        console.log(`✅ Transformation complete: ${transformedJobs.length} jobs processed`);
        
        // Log transformed location data for comparison
        console.log(`\n📍 Sample of TRANSFORMED location data (first ${sampleSize} jobs):`);
        
        transformedJobs.slice(0, sampleSize).forEach((job, index) => {
          const originalJob = result.jobs[index];
          console.log(`\n   Job ${index + 1}:`);
          console.log(`   ├─ Original Location: "${originalJob.location}"`);
          console.log(`   ├─ Transformed City: "${job.job_city}"`);
          console.log(`   ├─ Transformed State: "${job.job_state}"`);
          console.log(`   └─ Full Transformed: "${job.job_city}${job.job_state ? ', ' + job.job_state : ''}"`);
        });
        
        console.log(`\n${'='.repeat(80)}\n`);

        // Filter out already processed jobs
        const newJobs = transformedJobs.filter(job => {
          const jobId = generateJobId(job);
          if (processedJobIds.has(jobId)) {
            return false;
          }
          processedJobIds.add(jobId);
          return true;
        });

        if (newJobs.length > 0) {
          allJobs.push(...newJobs);
          console.log(`✅ Added ${newJobs.length} new jobs from ${result.name} (${transformedJobs.length - newJobs.length} duplicates filtered)`);
        } else {
          console.log(`⚠️ No new jobs from ${result.name} - all were duplicates`);
        }
      } catch (transformError) {
        console.error(`❌ Error transforming jobs from ${result.name}:`, transformError.message);
        console.error(`Stack trace:`, transformError.stack);
      }
    } else if (result.success) {
      console.log(`ℹ️ ${result.name} returned no jobs`);
    }
  });

  console.log(`📊 Total scraped jobs collected after transformation: ${allJobs.length}`);

  if (allJobs.length === 0) {
    console.log(`⚠️ No scraped jobs found. Will only collect API jobs.`);
  }

  // STEP 1: Filter by job title
  console.log('\n🎯 STEP 1: Filtering jobs by title (removing internships and non-software roles)...');
  let titleFilteredJobs = [];
  try {
    if (allJobs.length > 0) {
      titleFilteredJobs = filterHardwareEngineeringJobs(allJobs);
      console.log(`🎯 Title filtering: ${allJobs.length} -> ${titleFilteredJobs.length} jobs`);
    }
  } catch (titleFilterError) {
    console.error('❌ Error in title filtering:', titleFilterError.message);
    titleFilteredJobs = allJobs;
  }

  // STEP 2: Filter by experience level
  console.log('\n🎯 STEP 2: Filtering jobs by experience level...');
  let levelFilteredJobs = [];
  try {
    if (titleFilteredJobs.length > 0) {
      levelFilteredJobs = filterJobsByLevel(titleFilteredJobs);
      console.log(`🎯 Level filtering: ${titleFilteredJobs.length} -> ${levelFilteredJobs.length} jobs`);
    }
  } catch (filterError) {
    console.error('❌ Error in level filtering:', filterError.message);
    levelFilteredJobs = titleFilteredJobs;
  }

  // STEP 3: Filter by location (US only)
  console.log('\n🎯 STEP 3: Filtering jobs by location (US only)...');
  const removedJobs = [];
  const initialCount = levelFilteredJobs.length;

  try {
    if (levelFilteredJobs.length > 0) {
      levelFilteredJobs = levelFilteredJobs.filter(job => {
        const isUSJob = isUSOnlyJob(job);

        if (!isUSJob) {
          removedJobs.push(job);
          return false;
        }

        return true;
      });

      console.log(`🗺️ Location filtering: ${initialCount} -> ${levelFilteredJobs.length} jobs (removed ${removedJobs.length} non-US jobs)`);
    }
  } catch (locationError) {
    console.error('❌ Error in location filtering:', locationError.message);
  }

  // STEP 4: Final deduplication
  console.log('\n🎯 STEP 4: Final deduplication...');
  const uniqueJobs = levelFilteredJobs.filter((job, index, self) => {
    const jobId = generateJobId(job);
    return index === self.findIndex((j) => generateJobId(j) === jobId);
  });

  console.log(`🧹 Deduplication: ${levelFilteredJobs.length} -> ${uniqueJobs.length} jobs`);

  // STEP 5: Sort by posting date
  uniqueJobs.sort((a, b) => {
    const dateA = new Date(a.job_posted_at);
    const dateB = new Date(b.job_posted_at);
    return dateB - dateA;
  });

  const scrapedJobsCount = allJobs.length;
  const afterTitleFilter = titleFilteredJobs.length;
  const afterLevelFilter = levelFilteredJobs.length;
  const afterLocationFilter = uniqueJobs.length;

  console.log(`\n🎯 ===== FINAL FILTERING SUMMARY =====`);
  console.log(`📊 Initial scraped jobs: ${scrapedJobsCount}`);
  console.log(`   ⬇️  After title filtering (internships & non-SWE): ${afterTitleFilter} (${((afterTitleFilter/scrapedJobsCount)*100).toFixed(1)}%)`);
  console.log(`   ⬇️  After level filtering (senior roles): ${afterLevelFilter} (${((afterLevelFilter/scrapedJobsCount)*100).toFixed(1)}%)`);
  console.log(`   ⬇️  After location filtering (non-US): ${levelFilteredJobs.length} (${((levelFilteredJobs.length/scrapedJobsCount)*100).toFixed(1)}%)`);
  console.log(`   ⬇️  After deduplication: ${afterLocationFilter} (${((afterLocationFilter/scrapedJobsCount)*100).toFixed(1)}%)`);
  console.log(`\n✅ Final unique jobs: ${uniqueJobs.length}`);
  console.log(`\n📉 Removal breakdown:`);
  console.log(`   🚫 Internships & non-SWE roles: ${scrapedJobsCount - afterTitleFilter} jobs`);
  console.log(`   🚫 Senior-level positions: ${afterTitleFilter - afterLevelFilter} jobs`);
  console.log(`   🚫 Non-US locations: ${afterLevelFilter - levelFilteredJobs.length} jobs`);
  console.log(`   🚫 Duplicates: ${levelFilteredJobs.length - afterLocationFilter} jobs`);
  console.log(`\n✅ REAL SOFTWARE ENGINEERING JOBS ONLY - Entry/Mid-level, US locations!`);
  console.log(`${'='.repeat(50)}\n`);

  return uniqueJobs;
}

module.exports = { fetchAllRealJobs };