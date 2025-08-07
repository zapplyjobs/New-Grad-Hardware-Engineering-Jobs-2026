const puppeteer = require("puppeteer");

// Helper function to clean job titles
function cleanJobTitle(title) {
  if (!title) return title;

  // Remove common prefixes and suffixes
  return title
    .replace(/^(Senior|Staff|Principal|Lead|Jr|Junior)\s+/i, "")
    .replace(/\s+(I|II|III|IV|V|\d+)$/, "")
    .replace(/\s*-\s*(Remote|Hybrid|On-site).*$/i, "")
    .trim();
}

// Helper function to parse location
function parseLocation(locationText) {
  if (!locationText) {
    return { city: 'Unknown', state: 'US' };
  }
  
  // Clean up the location text and parse "US, CA, Santa Clara" format
  const cleanLocation = locationText.replace(/\s+/g, ' ').trim();
  const parts = cleanLocation.split(',').map(p => p.trim());
  
  if (parts.length >= 3) {
    // Format: US, CA, Santa Clara
    return { city: parts[2], state: parts[1] };
  } else if (parts.length === 2) {
    // Format: CA, Santa Clara
    return { city: parts[1], state: parts[0] };
  } else {
    // Single location
    return { city: parts[0], state: 'US' };
  }
}

async function aijobsScraper(searchQuery, maxPages = 10) {
  const browser = await puppeteer.launch({
    headless: true, // Set to true for production
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Set user agent to avoid blocking
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );

  const allJobs = [];
  const baseUrl = "https://www.aijobs.com";

  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`Scraping page ${pageNum}...`);

      // Construct URL with search query and page number
      const searchUrl = `${baseUrl}/jobs?q=${encodeURIComponent(
        searchQuery
      )}&posted_at=last-7-days&location=United%20States&location_id=168681&order=relevance&page=${pageNum}`;

      console.log(`Searching for: "${searchQuery}"`);
      console.log(`Navigating to: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });

      // Wait for job cards to load
      try {
        await page.waitForSelector(".job-listings-item.jb-pt-lg.jb-pr-lg.jb-pb-lg.jb-pl-lg.jb-rounded-2xl.jb-border-top-sm.jb-border-top-solid.jb-border-top-color-E2E8F0FF.jb-border-right-sm.jb-border-right-solid.jb-border-right-color-E2E8F0FF.jb-border-bottom-sm.jb-border-bottom-solid.jb-border-bottom-color-E2E8F0FF.jb-border-left-sm.jb-border-left-solid.jb-border-left-color-E2E8F0FF.jb-background-ffffffff.jb-mb-xs.jb-background-f9fcffff--hover", { timeout: 10000 });
      } catch (error) {
        console.log(`No jobs found on page ${pageNum}, stopping...`);
        break;
      }

      // Get all job cards
      const jobCards = await page.$$(
        ".job-listings-item.jb-pt-lg.jb-pr-lg.jb-pb-lg.jb-pl-lg.jb-rounded-2xl.jb-border-top-sm.jb-border-top-solid.jb-border-top-color-E2E8F0FF.jb-border-right-sm.jb-border-right-solid.jb-border-right-color-E2E8F0FF.jb-border-bottom-sm.jb-border-bottom-solid.jb-border-bottom-color-E2E8F0FF.jb-border-left-sm.jb-border-left-solid.jb-border-left-color-E2E8F0FF.jb-background-ffffffff.jb-mb-xs.jb-background-f9fcffff--hover"
      );

      if (jobCards.length === 0) {
        console.log(`No job cards found on page ${pageNum}, stopping...`);
        break;
      }

      console.log(`Found ${jobCards.length} jobs on page ${pageNum}`);

      // Extract job data from each card
      for (const jobCard of jobCards) {
        try {
          const jobData = await jobCard.evaluate((card) => {
            // Extract apply link
            const linkElement = card.querySelector("a.job-details-link");
            const applyLink = linkElement ? linkElement.href : "";

            // Extract title
            const titleElement = card.querySelector(
              "h3.jb-color-0f172aff.jb-text-size-lg.jb-font-default-for-headings.jb-font-weight-normal.jb-line-height-normal.jb-letter-spacing-normal.jb-pb-7xs"
            );
            const title = titleElement ? titleElement.textContent.trim() : "";

            // Extract location
            
            const locationElement = card.querySelector(
  'a.job-info-link-item[href^="/jobs/"][href$="-united-states"]'
);
            const location = locationElement
              ? locationElement.textContent.trim()
              : "";

            // Extract posted date
            const postedElement = card.querySelector(
              "span.d-md-inline.d-lg-none.jb-color-475569ff.jb-text-size-sm.jb-font-default-for-texts.jb-font-weight-default-for-texts.jb-line-height-normal.jb-letter-spacing-normal.jb-rounded-none.jb-pl-none.jb-pr-none.jb-pt-none.jb-pb-none"
            );
            const posted = postedElement
              ? postedElement.textContent.trim()
              : "";

            return {
              title,
              applyLink,
              location,
              posted,
            };
          });

          // Skip if no title found
          if (!jobData.title) continue;

          // Parse location
          const { city, state } = parseLocation(jobData.location);

          // Use the full apply link directly
          const applyLink = jobData.applyLink || "";

          // Format the job data
          const formattedJob = {
            employer_name: "AiJobs",
            job_title: cleanJobTitle(jobData.title),
            job_city: city,
            job_state: state,
            job_posted_at: jobData.posted || "Recently",
            job_description: `Posted: ${jobData.posted}. Full Title: ${jobData.title}. Location: ${jobData.location}`,
            job_apply_link: applyLink,
          };

          allJobs.push(formattedJob);
          console.log(`✓ Scraped: ${jobData.title} at ${jobData.location}`);
        } catch (error) {
          console.error("Error extracting job data from card:", error);
          continue;
        }
      }

      // Add delay between pages to be respectful
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }

  console.log(`\nScraping completed! Found ${allJobs.length} total jobs.`);
  return allJobs;
}

// Example usage
async function main() {
  try {
    // Get search query from command line arguments
    // If multiple arguments, join them with spaces
    const searchQuery = process.argv.slice(2).join(" ");

    if (!searchQuery) {
      console.log("Please provide a search query!");
      console.log("Usage: node aijobsScraper.js data science");
      console.log("Usage: node aijobsScraper.js hardware engineering");
      console.log("Usage: node aijobsScraper.js software");
      console.log('Or with quotes: node aijobsScraper.js "machine learning"');
      return;
    }

    console.log(`=== Scraping AI Jobs for: "${searchQuery}" ===`);
    const jobs = await aijobsScraper(searchQuery, 3);
    console.log(
      `\n🎉 Scraping completed! Found ${jobs.length} jobs for "${searchQuery}"`
    );

    // Display all scraped jobs
    if (jobs.length > 0) {
      console.log("\n📋 All Scraped Jobs:");
      console.log("=".repeat(80));

      jobs.forEach((job, index) => {
        console.log(`\n${index + 1}. ${job.job_title}`);
        console.log(`   Company: ${job.employer_name}`);
        console.log(`   Location: ${job.job_city}, ${job.job_state}`);
        console.log(`   Posted: ${job.job_posted_at}`);
        console.log(`   Apply: ${job.job_apply_link}`);
        console.log(
          `   Description: ${job.job_description.substring(0, 100)}...`
        );
      });

      console.log("\n" + "=".repeat(80));
      console.log(`📊 Summary: ${jobs.length} jobs found`);

      // Also show JSON format for first 2 jobs
      console.log("\n🔧 JSON Format (first 2 jobs):");
      console.log(JSON.stringify(jobs.slice(0, 2), null, 2));
    } else {
      console.log("❌ No jobs found for the search query.");
    }
  } catch (error) {
    console.error("Error in main:", error);
  }
}

// Export the scraper function
module.exports = aijobsScraper ;

// Run if this file is executed directly
if (require.main === module) {
  main();
}
