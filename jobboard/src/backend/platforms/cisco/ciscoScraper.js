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
  if (!locationText || locationText === 'Not specified') {
    return { city: 'Remote', state: 'Remote' };
  }
  
  // Handle format like "Holmdel, New Jersey, US"
  const parts = locationText.split(',').map(part => part.trim());
  
  let city = 'Remote';
  let state = 'Remote';
  
  if (parts.length >= 2) {
    city = parts[0];
    state = parts[1];
  } else if (parts.length === 1) {
    city = parts[0];
    state = 'Remote';
  }
  
  return { city, state };
}

async function ciscoScraper(searchQuery, maxPages = 10) {
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
  const baseUrl = "https://jobs.cisco.com/jobs/SearchJobs/";

  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`Scraping page ${pageNum}...`);

      // Calculate projectOffset based on page number
      // Page 1: 0, Page 2: 25, Page 3: 50, etc.
      const projectOffset = (pageNum - 1) * 25;

      // Construct the full URL with search query and pagination
      const searchUrl = `${baseUrl}${searchQuery}?21178=%5B169482%5D&21178_format=6020&21180=%5B165%2C164%2C166%2C163%5D&21180_format=6022&listFilterMode=1&projectOffset=${projectOffset}`;

      console.log(`Searching for: "${searchQuery}"`);
      console.log(`Navigating to: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });

      // Wait for job table rows to load
      try {
        await page.waitForSelector("tr", { timeout: 10000 });
      } catch (error) {
        console.log(`No jobs found on page ${pageNum}, stopping...`);
        break;
      }

      // Get all table rows
      const jobRows = await page.$$("tr");

      if (jobRows.length === 0) {
        console.log(`No job rows found on page ${pageNum}, stopping...`);
        break;
      }

      console.log(`Found ${jobRows.length} table rows on page ${pageNum}`);

      let jobsOnThisPage = 0;

      // Extract job data from each row
      for (const row of jobRows) {
        try {
          const jobData = await row.evaluate((rowElement) => {
            // Check if this row contains job data (has a link)
            const jobLink = rowElement.querySelector('a[href*="/jobs/ProjectDetail/"]');
            
            if (!jobLink) return null;

            // Extract job title from the link text
            const title = jobLink.textContent.trim();

            // Extract apply link (href attribute)
            const relativeApplyLink = jobLink.getAttribute('href');
            const applyLink = relativeApplyLink;

            // Extract location from the location cell
            const locationCell = rowElement.querySelector('td[data-th="Location"]');
            const location = locationCell ? locationCell.textContent.trim() : 'Not specified';

            return {
              title,
              applyLink,
              location,
            };
          });

          // Skip if no job data found in this row
          if (!jobData) continue;

          // Parse location
          const { city, state } = parseLocation(jobData.location);

          // Format the job data
          const formattedJob = {
            employer_name: "CISCO",
            job_title: cleanJobTitle(jobData.title),
            job_city: city,
            job_state: state,
            job_posted_at: "Recently", // Cisco doesn't show posting date on listing page
            job_description: `Posted: Recently. Full Title: ${jobData.title}. Location: ${jobData.location}`,
            job_apply_link: jobData.applyLink,
          };

          allJobs.push(formattedJob);
          jobsOnThisPage++;
          console.log(`✓ Scraped: ${jobData.title} at ${jobData.location}`);
        } catch (error) {
          console.error("Error extracting job data from row:", error);
          continue;
        }
      }

      console.log(`Page ${pageNum}: Found ${jobsOnThisPage} jobs`);

      // If no jobs found on this page, break the loop
      if (jobsOnThisPage === 0) {
        console.log(`No more jobs found. Stopping at page ${pageNum}`);
        break;
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

// Export the scraper function
module.exports = ciscoScraper;
