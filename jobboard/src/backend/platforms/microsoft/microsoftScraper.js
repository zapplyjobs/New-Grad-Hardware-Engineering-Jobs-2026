const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = "https://jobs.careers.microsoft.com/global/en/search?q=software%20engineering&lc=United%20States&exp=Students%20and%20graduates&l=en_us&pg=1&pgSz=20&o=Relevance&flt=true&ulcs=false&ref=cms";
const MAX_PAGES = 50;
const DELAYS = {
  BETWEEN_JOBS: 2000,      // Increased for headless
  BETWEEN_PAGES: 5000,     // Increased for headless
  AFTER_CLICK: 3000,       // Increased for headless
  WAIT_FOR_DETAILS: 8000,  // Increased for headless
  PAGE_LOAD: 5000          // New delay for page loading
};

const SELECTORS = {
  jobListings: 'div.ms-List-cell',
  seeDetailsButton: [
    'button.ms-Link.seeDetailsLink-549',
    'button[aria-label*="details"]',
    'button[aria-label*="See details"]',
    '.seeDetailsLink',
    'button.ms-Link'
  ],
  jobTitle: [
    'div.ms-DocumentCard.SearchJobDetailsCard h1',
    'div[role="group"] h1',
    'h1[style*="font-weight: 700"]',
    'h1[style*="font-size: 26px"]',
    'h1'
  ],
  location: 'p',
  postedDate: [
    '#job-search-app > div > div.ms-Stack.SearchAppWrapper.css-412 > div > div > div > div:nth-child(5) > div:nth-child(1) > div > div:nth-child(2)',
    '.posted-date',
    '[data-testid="posted-date"]'
  ],
  modal: [
    'div[role="dialog"]',
    '.ms-Modal',
    '.ms-DocumentCard.SearchJobDetailsCard'
  ]
};

// Utilities
function buildPageUrl(pageNumber) {
  return `${BASE_URL}&pg=${pageNumber}`;
}

function parseLocation(locationString) {
  if (!locationString || locationString === 'N/A') return { city: null, state: null };
  const parts = locationString.split(',').map(p => p.trim());
  return parts.length >= 2 ? { city: parts[0], state: parts[1] } : { city: parts[0], state: null };
}

function cleanJobTitle(title) {
  if (!title) return 'N/A';
  if (title.includes(' - ')) return title.split(' - ')[1].split(',')[0].trim();
  return title.split(',')[0].trim();
}

function extractCategory(title) {
  if (!title) return 'Software Engineering';
  if (title.includes(' - ')) return title.split(' - ')[0].trim();
  return 'Software Engineering';
}

function transformJobData(scrapedJob) {
  const { city, state } = parseLocation(scrapedJob.location);
  const fullTitle = scrapedJob.category && scrapedJob.role
    ? `${scrapedJob.category} - ${scrapedJob.role}`
    : (scrapedJob.role || scrapedJob.category || 'N/A');

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

async function findElement(context, selectors, timeout = 5000) {
  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
  for (const selector of selectorArray) {
    try {
      const element = await context.waitForSelector(selector, { timeout, visible: true });
      if (element) return element;
    } catch (_) { continue; }
  }
  return null;
}

// Enhanced function to wait for modal with multiple strategies
async function waitForModalContent(page, maxAttempts = 10) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`    🔍 Waiting for modal content (attempt ${attempt}/${maxAttempts})`);

      // Wait for modal to be present and visible
      const modalPresent = await page.evaluate(() => {
        const modals = document.querySelectorAll('div[role="dialog"], .ms-Modal, .ms-DocumentCard.SearchJobDetailsCard');
        return Array.from(modals).some(modal => {
          const rect = modal.getBoundingClientRect();
          const style = window.getComputedStyle(modal);
          return rect.height > 100 && style.display !== 'none' && style.visibility !== 'hidden';
        });
      });

      if (modalPresent) {
        // Additional wait for content to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if title is available
        const titleAvailable = await page.evaluate(() => {
          const titleSelectors = [
            'div.ms-DocumentCard.SearchJobDetailsCard h1',
            'div[role="group"] h1',
            'h1[style*="font-weight: 700"]',
            'h1[style*="font-size: 26px"]',
            'h1'
          ];

          return titleSelectors.some(selector => {
            const el = document.querySelector(selector);
            return el && el.textContent.trim() && el.offsetParent !== null;
          });
        });

        if (titleAvailable) {
          console.log(`    ✅ Modal content loaded successfully`);
          return true;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`    ⚠️ Modal wait attempt ${attempt} failed:`, error.message);
    }
  }

  console.log(`    ❌ Modal content failed to load after ${maxAttempts} attempts`);
  return false;
}

// Enhanced function to close modal with multiple strategies
async function closeModal(page) {
  try {
    console.log(`    🔄 Closing modal...`);

    // Strategy 1: Try Escape key first (most reliable)
    await page.keyboard.press('Escape');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if modal is closed
    const modalClosed = await page.evaluate(() => {
      const modals = document.querySelectorAll('div[role="dialog"], .ms-Modal, .ms-DocumentCard.SearchJobDetailsCard');
      return !Array.from(modals).some(modal => {
        const rect = modal.getBoundingClientRect();
        const style = window.getComputedStyle(modal);
        return rect.height > 100 && style.display !== 'none' && style.visibility !== 'hidden';
      });
    });

    if (modalClosed) {
      console.log(`    ✅ Modal closed successfully`);
      return true;
    }

    // Strategy 2: Click close button if available
    const closeButton = await page.$('button[aria-label="Close"], button[aria-label*="close"], .ms-Modal-scrollableContent button').catch(() => null);
    if (closeButton) {
      await closeButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Strategy 3: Click outside modal area
    await page.click('body', { offset: { x: 10, y: 10 } });
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`    ✅ Modal close attempted`);
    return true;

  } catch (error) {
    console.log(`    ⚠️ Error closing modal:`, error.message);
    return false;
  }
}

async function scrapePage(page, pageNumber) {
  const url = buildPageUrl(pageNumber);
  console.log(`\n🔗 Scraping Page ${pageNumber}: ${url}`);

  try {
    // Navigate with longer timeout and wait for network idle
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });

    // Additional wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, DELAYS.PAGE_LOAD));

    // Wait for job listings with retry logic
    let jobListingsFound = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await page.waitForSelector(SELECTORS.jobListings, { timeout: 15000, visible: true });
        jobListingsFound = true;
        break;
      } catch (error) {
        console.log(`  ⚠️ Job listings not found (attempt ${attempt}/3)`);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          await page.reload({ waitUntil: 'networkidle0' });
        }
      }
    }

    if (!jobListingsFound) {
      console.log(`❌ No job listings found on page ${pageNumber} after retries`);
      return [];
    }

    // Get job count with multiple attempts
    let jobCount = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      jobCount = await page.$$eval(SELECTORS.jobListings, divs => divs.length);
      if (jobCount > 0) break;
      console.log(`  ⚠️ No jobs detected (attempt ${attempt}/3)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (jobCount === 0) {
      console.log(`❌ No job listings found on page ${pageNumber}`);
      return [];
    }

    console.log(`📋 Found ${jobCount} job listings`);

    const jobs = [];
    for (let i = 0; i < jobCount; i++) {
      try {
        console.log(`  🔍 Processing job ${i + 1}/${jobCount}`);

        // Get fresh reference to job elements each time
        const jobDivs = await page.$$(SELECTORS.jobListings);
        if (i >= jobDivs.length) {
          console.log(`    ⚠️ Job ${i + 1} no longer available`);
          continue;
        }

        const jobDiv = jobDivs[i];

        // Scroll to job and ensure it's visible
        await page.evaluate(el => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, jobDiv);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find see details button with enhanced search
        const seeDetailsButton = await findElement(jobDiv, SELECTORS.seeDetailsButton, 5000);
        if (!seeDetailsButton) {
          console.log(`    ⚠️ No "See details" button for job ${i + 1}`);
          continue;
        }

        // Click button with enhanced error handling
        try {
          // Ensure button is clickable
          await page.evaluate(btn => {
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, seeDetailsButton);
          await new Promise(resolve => setTimeout(resolve, 500));

          await seeDetailsButton.click();
          console.log(`    ✅ Clicked details button for job ${i + 1}`);
        } catch (clickError) {
          console.log(`    ❌ Failed to click job ${i + 1}:`, clickError.message);

          // Try alternative click method
          try {
            await page.evaluate(btn => btn.click(), seeDetailsButton);
            console.log(`    ✅ Alternative click succeeded for job ${i + 1}`);
          } catch (altClickError) {
            console.log(`    ❌ Alternative click also failed for job ${i + 1}`);
            continue;
          }
        }

        // Wait for modal content to load
        const modalLoaded = await waitForModalContent(page);
        if (!modalLoaded) {
          console.log(`    ❌ Modal failed to load for job ${i + 1}`);
          await closeModal(page);
          continue;
        }

        // Extract job data with enhanced error handling
        const jobData = await page.evaluate(() => {
          const job = {
            role: 'N/A',
            location: 'N/A',
            posted: 'Recently',
            level: 'Students and graduates',
            category: 'N/A',
            apply: window.location.href
          };

          // Enhanced title extraction with visibility check
          const titleSelectors = [
            'div.ms-DocumentCard.SearchJobDetailsCard h1',
            'div[role="group"] h1',
            'h1[style*="font-weight: 700"]',
            'h1[style*="font-size: 26px"]',
            'h1'
          ];

          for (const selector of titleSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent.trim() && el.offsetParent !== null) {
              const fullTitle = el.textContent.trim();
              const parts = fullTitle.split(' - ');
              if (parts.length >= 2) {
                job.category = parts[0].trim();
                job.role = parts[1].split(',')[0].trim();
              } else {
                job.role = fullTitle;
              }
              break;
            }
          }

          // Enhanced location extraction
          const locationElements = document.querySelectorAll('p');
          for (const locationEl of locationElements) {
            if (locationEl && locationEl.textContent.trim() && locationEl.offsetParent !== null) {
              const text = locationEl.textContent.trim();
              // Check if it looks like a location (contains comma or state abbreviation)
              if (text.includes(',') || text.match(/\b[A-Z]{2}\b/) || text.includes('United States')) {
                job.location = text;
                break;
              }
            }
          }

          // Enhanced date extraction
          const dateSelectors = [
            '#job-search-app > div > div.ms-Stack.SearchAppWrapper.css-412 > div > div > div > div:nth-child(5) > div:nth-child(1) > div > div:nth-child(2)',
            '.posted-date',
            '[data-testid="posted-date"]'
          ];
          for (const selector of dateSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent.trim() && el.offsetParent !== null) {
              job.posted = el.textContent.trim();
              break;
            }
          }

          return job;
        });

        if (jobData.role !== 'N/A') {
          console.log(`    ✅ Scraped: ${jobData.category} - ${jobData.role} (${jobData.location})`);
          jobs.push(jobData);
        } else {
          console.log(`    ⚠️ Incomplete job data for job ${i + 1}`);
        }

        // Close modal and wait
        await closeModal(page);
        await new Promise(resolve => setTimeout(resolve, DELAYS.BETWEEN_JOBS));

      } catch (error) {
        console.log(`    ❌ Error processing job ${i + 1}:`, error.message);
        await closeModal(page);
        await new Promise(resolve => setTimeout(resolve, DELAYS.BETWEEN_JOBS));
        continue;
      }
    }

    console.log(`✅ Page ${pageNumber} completed: ${jobs.length}/${jobCount} jobs scraped`);
    return jobs;

  } catch (error) {
    console.error(`❌ Failed to scrape page ${pageNumber}:`, error.message);
    return [];
  }
}

async function microsoftScraper() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1920, height: 1080 }, // Set explicit viewport
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--window-size=1920,1080', // Ensure consistent window size
      '--disable-blink-features=AutomationControlled', // Hide automation
      '--disable-extensions-file-access-check',
      '--disable-extensions-http-throttling'
    ]
  });

  try {
    const page = await browser.newPage();

    // Enhanced browser stealth configuration
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    // Remove webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    const allJobs = [];
    let currentPage = 1;
    let consecutiveEmptyPages = 0;

    while (currentPage <= MAX_PAGES && consecutiveEmptyPages < 2) {
      console.log(`\n📄 Processing page ${currentPage}/${MAX_PAGES}`);

      const pageJobs = await scrapePage(page, currentPage);

      if (pageJobs.length === 0) {
        consecutiveEmptyPages++;
        console.log(`⚠️ Empty page ${currentPage} (${consecutiveEmptyPages}/2 consecutive)`);
      } else {
        consecutiveEmptyPages = 0;
        allJobs.push(...pageJobs);
      }

      // Break if we got fewer jobs than expected (likely last page)
      if (pageJobs.length < 10) {
        console.log(`🏁 Reached end of results (${pageJobs.length} jobs on page ${currentPage})`);
        break;
      }

      currentPage++;

      if (currentPage <= MAX_PAGES) {
        console.log(`⏳ Waiting ${DELAYS.BETWEEN_PAGES}ms before next page...`);
        await new Promise(resolve => setTimeout(resolve, DELAYS.BETWEEN_PAGES));
      }
    }

    const transformed = allJobs.map(transformJobData).filter(job => job.job_title !== 'N/A');

    // Remove duplicates
    const uniqueJobs = transformed.filter((job, index, self) =>
      index === self.findIndex(j => j.job_title === job.job_title && j.job_city === job.job_city)
    );

    const filePath = path.join(__dirname, 'microsoftScraping.json');
    fs.writeFileSync(filePath, JSON.stringify(uniqueJobs, null, 2));

    console.log(`\n🎉 Scraping completed!`);
    console.log(`📊 Raw jobs scraped: ${allJobs.length}`);
    console.log(`✅ Valid jobs after processing: ${transformed.length}`);
    console.log(`🔄 Unique jobs saved: ${uniqueJobs.length}`);
    console.log(`📁 Saved to: ${filePath}`);

    return uniqueJobs;

  } catch (error) {
    console.error(`❌ Scraping failed:`, error.message);
    return [];
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  microsoftScraper().then(data => {
    console.log(`\n✅ Scraping finished. Final job count: ${data.length}`);
  }).catch(console.error);
}

module.exports = { microsoftScraper };