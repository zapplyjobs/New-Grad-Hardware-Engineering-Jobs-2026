const puppeteer = require("puppeteer");

// Helper function to clean job titles
function cleanJobTitle(title) {
  if (!title) return title;

  // Remove common prefixes and suffixes
  return title
    .replace(/\s+(I|II|III|IV|V|\d+)$/, "")
    .replace(/\s*-\s*(Remote|Hybrid|On-site).*$/i, "")
    .trim();
}

// Helper function to parse location
function parseLocation(locationText) {
  if (!locationText) {
    return { city: 'Remote', state: 'Remote' };
  }
  
  // Parse location string like "Bratislava, Bratislavsky kraj, Slovakia"
  const locationParts = locationText.split(',').map(part => part.trim());
  
  if (locationParts.length >= 2) {
    // Use first part as city and last part as state/country
    const city = locationParts[0];
    const state = locationParts[locationParts.length - 1];
    return { city, state };
  } else {
    // If only one part, use it as both city and state
    const location = locationText.trim();
    return { city: location, state: location };
  }
}

async function siemensScraper(searchQuery, maxPages = 10) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox", 
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--disable-extensions",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-web-security",
      "--disable-features=TranslateUI",
      "--disable-ipc-flooding-protection"
    ],
  });

  const page = await browser.newPage();

  // Enhanced page setup for headless mode
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  
  // Set larger viewport for better compatibility
await page.setViewport({ width: 1366, height: 768 });  
  // Disable images and CSS to speed up loading in headless mode
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (resourceType == 'stylesheet' || resourceType == 'image') {
      req.abort();
    } else {
      req.continue();
    }
  });

  const allJobs = [];
  const baseUrl = "https://jobs.siemens.com/careers";

  try {
    // Construct the search URL
    const searchUrl = `${baseUrl}?query=${encodeURIComponent(searchQuery)}&location=USA&pid=563156126459716&domain=siemens.com&sort_by=relevance&triggerGoButton=false&utm_source=j_c_us`;

    console.log(`Searching for: "${searchQuery}"`);
    console.log(`Navigating to: ${searchUrl}`);
    
    await page.goto(searchUrl, { 
      waitUntil: ["networkidle2", "domcontentloaded"], 
      timeout: 60000 
    });

    // Wait for initial content to load
       await new Promise((resolve) => setTimeout(resolve, 3000));

    // PHASE 1: Load all content by clicking "Show More" button
    console.log(`\n=== PHASE 1: Loading all jobs (clicking Show More ${maxPages} times) ===`);
    
    for (let clickCount = 1; clickCount <= maxPages; clickCount++) {
      console.log(`Click attempt ${clickCount}/${maxPages}...`);

      // Wait for job cards to load first
      try {
        await page.waitForSelector("div.job-card-container.list", { timeout: 10000 });
      } catch (error) {
        console.log(`No jobs found on page, stopping...`);
        break;
      }

      // Count current jobs before attempting to load more
      const currentJobCount = await page.$$eval("div.job-card-container.list", cards => cards.length);
      console.log(`Current job count: ${currentJobCount}`);

      // Enhanced scrolling with multiple attempts
      console.log("Scrolling to find Show More button...");
      await page.evaluate(() => {
        // Scroll to bottom of page
        window.scrollTo(0, document.body.scrollHeight);
        
        // Also try to scroll specific containers
        const containers = document.querySelectorAll([
          'div.inline-block.position-cards-container',
          'div.search-results-main-container',
          'div.flexbox'
        ].join(','));
        
        containers.forEach(container => {
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        });
      });
      
      // Wait for scroll to complete and content to load
         await new Promise((resolve) => setTimeout(resolve, 3000));

      // Try multiple selectors for the Show More button
      const showMoreSelectors = [
        "button.btn.btn-sm.btn-secondary.show-more-positions",
        "button[class*='show-more']",
        "button:contains('Show More')",
        ".show-more-positions",
        "[data-automation-id*='show-more']"
      ];

      let showMoreClicked = false;

      for (const selector of showMoreSelectors) {
        try {
          // Wait for the button to be present
          const showMoreButton = await page.$(selector);
          
          if (showMoreButton) {
            // Check if button is visible and enabled
            const buttonInfo = await page.evaluate(button => {
              const rect = button.getBoundingClientRect();
              const styles = window.getComputedStyle(button);
              return {
                isVisible: rect.width > 0 && rect.height > 0,
                isDisplayed: styles.display !== 'none',
                isDisabled: button.disabled || button.hasAttribute('disabled'),
                text: button.textContent.trim(),
                top: rect.top,
                bottom: rect.bottom
              };
            }, showMoreButton);

            // console.log(`Button info:`, buttonInfo);

            if (buttonInfo.isVisible && buttonInfo.isDisplayed && !buttonInfo.isDisabled) {
              // console.log(`✓ Found clickable Show More button with selector: ${selector}`);
              
              // Scroll button into view with more aggressive scrolling
              await page.evaluate(button => {
                button.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center',
                  inline: 'center'
                });
              }, showMoreButton);
              
                 await new Promise((resolve) => setTimeout(resolve, 2000));

              // Try clicking with different methods
              try {
                // Method 1: Regular click
                await showMoreButton.click();
              } catch (clickError) {
                try {
                  // Method 2: Click with force
                  await page.evaluate(button => button.click(), showMoreButton);
                } catch (forceClickError) {
                  // Method 3: Dispatch click event
                  await page.evaluate(button => {
                    const event = new MouseEvent('click', {
                      view: window,
                      bubbles: true,
                      cancelable: true
                    });
                    button.dispatchEvent(event);
                  }, showMoreButton);
                }
              }

              console.log(`✓ Clicked Show More button (${clickCount}/${maxPages})`);
              
              // Wait for new content to load
                 await new Promise((resolve) => setTimeout(resolve, 4000));
              
              // Wait for network activity to settle
              await page.waitForLoadState?.('networkidle') ||    await new Promise((resolve) => setTimeout(resolve, 2000));
              
              // Verify that new jobs were loaded
              const newJobCount = await page.$$eval("div.job-card-container.list", cards => cards.length);
              console.log(`Job count after click: ${newJobCount} (was ${currentJobCount})`);
              
              if (newJobCount > currentJobCount) {
                console.log(`✓ Successfully loaded ${newJobCount - currentJobCount} more jobs`);
                showMoreClicked = true;
                break;
              } else {
                console.log(`⚠ Job count didn't increase, button might not have worked`);
              }
            } else {
              console.log(`Button found but not clickable: visible=${buttonInfo.isVisible}, displayed=${buttonInfo.isDisplayed}, disabled=${buttonInfo.isDisabled}`);
            }
          }
        } catch (error) {
          console.log(`Selector ${selector} failed:`, error.message);
          continue;
        }
      }

      if (!showMoreClicked) {
        console.log("No clickable Show More button found with any selector, stopping...");
        break;
      }

      // Respectful delay between clicks
         await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // PHASE 2: Scrape all jobs at once after everything is loaded
    console.log(`\n=== PHASE 2: Scraping all loaded jobs ===`);
    
    // Final wait to ensure all content is loaded
       await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Wait for all job cards to be present
    try {
      await page.waitForSelector("div.job-card-container.list", { timeout: 10000 });
    } catch (error) {
      console.log(`No jobs found for scraping, exiting...`);
      return allJobs;
    }

    // Get all job cards currently visible
    const jobCards = await page.$$("div.job-card-container.list");
    console.log(`Found ${jobCards.length} total job cards to scrape`);

    // Extract job data from all cards in batches to avoid memory issues
    const batchSize = 10;
    for (let i = 0; i < jobCards.length; i += batchSize) {
      const batch = jobCards.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(jobCards.length/batchSize)}`);
      
      for (let j = 0; j < batch.length; j++) {
        const card = batch[j];
        const globalIndex = i + j;
        
        try {
          const jobData = await card.evaluate((cardElement) => {
            // Extract job title
            const titleElement = cardElement.querySelector('h3.job-card-title');
            const title = titleElement ? titleElement.textContent.trim() : '';

            const location_And_CodeElements = cardElement.querySelectorAll('p.field-label');
            const location = location_And_CodeElements[0]?.textContent.trim() || '';

            return {
              title,
              location
            };
          });

          // Skip if no title found
          if (!jobData.title) {
            console.log(`⚠ Skipping card ${globalIndex + 1}: No title found`);
            continue;
          }

          // Parse location
          const { city, state } = parseLocation(jobData.location);

          // Use the search URL as apply link since there's no specific apply link
          const applyLink = searchUrl;

          // Format the job data
          const formattedJob = {
            employer_name: "SIEMENS",
            job_title: cleanJobTitle(jobData.title),
            job_city: city,
            job_state: state,
            job_posted_at: "Recently", // Siemens shows "Recently" as posting date
            job_description: `Posted: Recently. Full Title: ${jobData.title}. Location: ${jobData.location}`,
            job_apply_link: applyLink
          };

          allJobs.push(formattedJob);
          console.log(`✓ Scraped (${globalIndex + 1}/${jobCards.length}): ${jobData.title} at ${jobData.location}`);
          
        } catch (error) {
          console.error(`Error extracting job data from card ${globalIndex + 1}:`, error);
          continue;
        }
      }
    }

  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }

  console.log(`\n🎉 Scraping completed! Found ${allJobs.length} total jobs.`);
  return allJobs;
}

// Export the scraper function
module.exports = siemensScraper;

// Run if this file is executed directly
