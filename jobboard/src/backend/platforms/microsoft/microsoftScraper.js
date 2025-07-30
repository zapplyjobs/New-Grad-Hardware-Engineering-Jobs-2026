const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = "https://jobs.careers.microsoft.com/global/en/search?q=software%20engineering&lc=United%20States&exp=Students%20and%20graduates&l=en_us&pg=1&pgSz=20&o=Relevance&flt=true&ulcs=false&ref=cms";
const MAX_PAGES = 50;
const DELAYS = {
  BETWEEN_JOBS: 1000,
  BETWEEN_PAGES: 3000,
  AFTER_CLICK: 2000,
  WAIT_FOR_DETAILS: 5000
};

// Selectors - more flexible approach
const SELECTORS = {
  jobListings: 'div.ms-List-cell',
  seeDetailsButton: [
    'button.ms-Link.seeDetailsLink-549',
    'button[aria-label*="details"]',
    'button:contains("See details")',
    '.seeDetailsLink'
  ],
  jobTitle: [
    'div.ms-DocumentCard.SearchJobDetailsCard h1',
    'div[role="group"] h1',
    'h1[style*="font-weight: 700"]',
    'h1[style*="font-size: 26px"]',
    'h1'
  ],
  location: 'p',
  postedDate: '#job-search-app > div > div.ms-Stack.SearchAppWrapper.css-412 > div > div > div > div:nth-child(5) > div:nth-child(1) > div > div:nth-child(2)',
  backButton: [
    'span#id_123.ms-Button-label.label-353',
    'button[aria-label*="Back"]',
    'button:contains("Back")'
  ]
};

// Utility functions
function buildPageUrl(pageNumber) {
  return `${BASE_URL}&pg=${pageNumber}`;
}

function parseLocation(locationString) {
  if (!locationString || locationString === 'N/A') {
    return { city: null, state: null };
  }

  const parts = locationString.split(',').map(part => part.trim());
  return parts.length >= 2
    ? { city: parts[0], state: parts[1] }
    : { city: parts[0], state: null };
}

function cleanJobTitle(title) {
  if (!title) return 'N/A';

  if (title.includes(' - ')) {
    return title.split(' - ')[1].split(',')[0].trim();
  }

  return title.split(',')[0].trim();
}

function extractCategory(title) {
  if (!title) return 'Software Engineering';

  if (title.includes(' - ')) {
    return title.split(' - ')[0].trim();
  }

  return 'Software Engineering';
}

function transformJobData(scrapedJob) {
  const { city, state } = parseLocation(scrapedJob.location);
  const fullTitle = scrapedJob.category && scrapedJob.role ?
    `${scrapedJob.category} - ${scrapedJob.role}` :
    (scrapedJob.role || scrapedJob.category || 'N/A');

  return {
    employer_name: "Microsoft",
    job_title: cleanJobTitle(fullTitle),
    job_city: city,
    job_state: state,
    job_posted_at: scrapedJob.posted,
    job_description: `Category: ${extractCategory(fullTitle)}. Level: ${scrapedJob.level}. Posted: ${scrapedJob.posted}. Full Title: ${fullTitle}`,
    job_apply_link: scrapedJob.apply
  };
}

// Enhanced element finding with multiple selectors
async function findElement(page, selectors, timeout = 5000) {
  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

  for (const selector of selectorArray) {
    try {
      const element = await page.waitForSelector(selector, { timeout });
      if (element) return element;
    } catch (error) {
      continue; // Try next selector
    }
  }

  return null;
}

// Enhanced job detail scraping
async function scrapeJobDetails(page, jobDiv, jobIndex) {
  try {
    console.log(`Processing job ${jobIndex}`);

    // Find see details button with multiple selector options
    const seeDetailsButton = await findElement(jobDiv, SELECTORS.seeDetailsButton, 3000);

    if (!seeDetailsButton) {
      console.log(`⚠️ No see details button found for job ${jobIndex} - skipping`);
      return null;
    }

    // Click the see details button
    await seeDetailsButton.click();
    console.log(`✅ Clicked see details for job ${jobIndex}`);

    // Wait for details page to load
    await new Promise(resolve => setTimeout(resolve, DELAYS.WAIT_FOR_DETAILS));

    // Extract job details
    const jobData = await page.evaluate(() => {
      const job = {
        role: 'N/A',
        location: 'N/A',
        posted: 'Recently',
        level: 'Students and graduates',
        category: 'N/A',
        apply: window.location.href
      };

      // Get title using multiple selector strategy
      const titleSelectors = [
        'div.ms-DocumentCard.SearchJobDetailsCard h1',
        'div[role="group"] h1',
        'h1[style*="font-weight: 700"]',
        'h1[style*="font-size: 26px"]',
        'h1'
      ];

      let titleElement = null;
      for (const selector of titleSelectors) {
        titleElement = document.querySelector(selector);
        if (titleElement && titleElement.textContent.trim()) break;
      }

      if (titleElement) {
        const fullTitle = titleElement.textContent.trim();
        if (fullTitle) {
          const parts = fullTitle.split(' - ');
          if (parts.length >= 2) {
            job.category = parts[0].trim();
            job.role = parts[1].split(',')[0].trim();
          } else {
            job.role = fullTitle;
          }
        }
      }

      // Get location
      const locationElement = document.querySelector('p');
      if (locationElement) {
        job.location = locationElement.textContent.trim();
      }

      // Get posted date
      const dateSelectors = [
        '#job-search-app > div > div.ms-Stack.SearchAppWrapper.css-412 > div > div > div > div:nth-child(5) > div:nth-child(1) > div > div:nth-child(2)',
        '.posted-date',
        '[data-testid="posted-date"]'
      ];

      for (const selector of dateSelectors) {
        const dateElement = document.querySelector(selector);
        if (dateElement && dateElement.textContent.trim()) {
          job.posted = dateElement.textContent.trim();
          break;
        }
      }

      return job;
    });

    // Navigate back to job list
    await navigateBack(page, jobIndex);

    // Wait before processing next job
    await new Promise(resolve => setTimeout(resolve, DELAYS.AFTER_CLICK));

    if (jobData.role === 'N/A') {
      console.log(`⚠️ No valid job data extracted for job ${jobIndex}`);
      return null;
    }

    console.log(`✅ Successfully extracted: ${jobData.category} - ${jobData.role}`);
    return jobData;

  } catch (error) {
    console.log(`❌ Error processing job ${jobIndex}:`, error.message);
    return null;
  }
}

// Enhanced back navigation
async function navigateBack(page, jobIndex) {
  try {
    const backButton = await findElement(page, SELECTORS.backButton, 3000);

    if (backButton) {
      await backButton.click();
      console.log(`✅ Clicked back button for job ${jobIndex}`);
    } else {
      await page.goBack();
      console.log(`✅ Used browser back for job ${jobIndex}`);
    }
  } catch (error) {
    console.log(`⚠️ Back navigation failed for job ${jobIndex}, using browser back`);
    await page.goBack();
  }
}

// Scrape jobs from a specific page
async function scrapePage(page, pageNumber) {
  const url = buildPageUrl(pageNumber);
  console.log(`\n🔗 Scraping Page ${pageNumber} - ${url}`);

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log(`⏳ Loading job listings on page ${pageNumber}...`);

    // Wait for job listings
    await page.waitForSelector(SELECTORS.jobListings, { timeout: 30000 });
    console.log('✅ Job listings loaded');

    // Get job divs
    const jobDivs = await page.$$(SELECTORS.jobListings);

    if (!jobDivs || jobDivs.length === 0) {
      console.log(`❌ No job listings found on page ${pageNumber}`);
      return [];
    }

    console.log(`📋 Found ${jobDivs.length} job listings on page ${pageNumber}`);

    const pageJobs = [];

    // Process each job
    for (let i = 0; i < jobDivs.length; i++) {
      const jobData = await scrapeJobDetails(page, jobDivs[i], i + 1);

      if (jobData && jobData.role !== 'N/A') {
        pageJobs.push(jobData);
      }

      // Wait between jobs
      await new Promise(resolve => setTimeout(resolve, DELAYS.BETWEEN_JOBS));
    }

    console.log(`✅ Successfully scraped ${pageJobs.length} jobs from page ${pageNumber}`);
    return pageJobs;

  } catch (error) {
    console.error(`❌ Error scraping page ${pageNumber}:`, error.message);
    return [];
  }
}

// Main scraping function
async function microsoftScraper() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Set user agent and headers
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    const allJobs = [];
    let currentPage = 1;
    let hasMorePages = true;

    // Scrape pages until no more jobs found
    while (hasMorePages && currentPage <= MAX_PAGES) {
      console.log(`\n📄 Processing page ${currentPage}...`);

      const pageJobs = await scrapePage(page, currentPage);

      if (pageJobs.length > 0) {
        allJobs.push(...pageJobs);
        console.log(`📊 Total jobs scraped: ${allJobs.length}`);

        // If current page has less than 20 jobs, it's likely the last page
        if (pageJobs.length < 20) {
          console.log(`📄 Page ${currentPage} has only ${pageJobs.length} jobs - this appears to be the last page`);
          hasMorePages = false;
        } else {
          currentPage++;
        }

        // Wait between pages
        if (hasMorePages) {
          console.log(`⏸ Waiting ${DELAYS.BETWEEN_PAGES}ms before next page...`);
          await new Promise(resolve => setTimeout(resolve, DELAYS.BETWEEN_PAGES));
        }

      } else {
        console.log(`📄 Page ${currentPage} has no jobs - stopping`);
        hasMorePages = false;
      }
    }

    console.log(`\n🎉 Scraping completed! Found ${allJobs.length} jobs across ${currentPage - 1} pages`);

    // Transform and filter jobs
    const transformedJobs = allJobs
      .map(transformJobData)
      .filter(job => job.job_title !== 'N/A');

    // Save results
    const filePath = path.join(__dirname, 'microsoftScraping.json');
    fs.writeFileSync(filePath, JSON.stringify(transformedJobs, null, 2));
    console.log(`📝 Saved ${transformedJobs.length} jobs to ${filePath}`);

    // Display summary
    console.log(`\n=== 📋 Scraping Summary ===`);
    console.log(`Total jobs found: ${allJobs.length}`);
    console.log(`Valid jobs saved: ${transformedJobs.length}`);
    console.log(`Pages processed: ${currentPage - 1}`);

    return transformedJobs;

  } catch (error) {
    console.error(`❌ Scraping failed:`, error.message);
    return [];
  } finally {
    await browser.close();
  }
}

// Execute if run directly
// if (require.main === module) 
//   const data = microsoftScraper().catch(console.error);
//   console.log("data received after scrap", data);
// }

module.exports = { microsoftScraper };