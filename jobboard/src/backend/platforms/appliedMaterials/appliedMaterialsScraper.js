const puppeteer = require("puppeteer");

// Helper function to clean job titles
function cleanJobTitle(title) {
  if (!title) return title;
  return title
    .replace(/\s+(I|II|III|IV|V|\d+)$/, "")
    .replace(/\s*-\s*(Remote|Hybrid|On-site).*$/i, "")
    .trim();
}

// Helper function to parse location
function parseLocation(locationText) {
  if (!locationText) {
    return { city: "Remote", state: "Remote" };
  }

  // Clean the location text
  const cleanedLocation = locationText
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "")
    .trim();

  // Parse location string like "Mountain View, California" or "Santa Clara, CA"
  const locationParts = cleanedLocation.split(",").map((part) => part.trim());

  if (locationParts.length >= 2) {
    return { city: locationParts[0], state: locationParts[1] };
  } else {
    // If only one part, use it as both city and state
    const location = cleanedLocation.trim();
    return { city: location, state: location };
  }
}

async function appliedMaterialsScraper(searchQuery, maxPages = 10) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--disable-extensions",
    ],
  });

  const page = await browser.newPage();
  
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1920, height: 1080 });

  // Disable images and CSS for faster loading
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const resourceType = req.resourceType();
    if (resourceType === "stylesheet" || resourceType === "image") {
      req.abort();
    } else {
      req.continue();
    }
  });

  const allJobs = [];
  const baseUrl = "https://careers.appliedmaterials.com/careers";
  const jobsPerPage = 10;

  try {
    console.log(`=== Starting to scrape up to ${maxPages} pages for: "${searchQuery}" ===`);

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
      console.log(`\n--- Scraping Page ${pageNumber} ---`);

      // Calculate start parameter (0 for page 1, 10 for page 2, etc.)
      const startParam = (pageNumber - 1) * jobsPerPage;

      // Construct the search URL
      const searchUrl = `${baseUrl}?domain=appliedmaterials.com&triggerGoButton=false&query=${encodeURIComponent(searchQuery)}&start=${startParam}&location=united+states&pid=790304383258&sort_by=solr&filter_include_remote=1&filter_country=United+States+of+America`;
      
      console.log(`Navigating to: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: ["networkidle2", "domcontentloaded"],
        timeout: 60000,
      });

      // Wait for initial content to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Wait for job results
      try {
        await page.waitForSelector("div[class*='cardContainer']", { timeout: 15000 });
      } catch (error) {
        console.log(`No jobs found on page ${pageNumber}, stopping...`);
        break;
      }

      // Get all job items
      const jobs = await page.$$("div[class*='cardContainer']");
      const jobItems= jobs.slice(-10)
      
      console.log(`Found ${jobItems.length} job items on page ${pageNumber}`);

      // If no jobs found on this page, stop scraping
      if (jobItems.length === 0) {
        console.log(`No jobs on page ${pageNumber}, stopping...`);
        break;
      }

      // Extract job data
      for (let i = 0; i < jobItems.length; i++) {
        try {
          const jobData = await jobItems[i].evaluate((itemElement, index) => {
            // Extract job title from div.title-1aNJK
            const titleElement = itemElement.querySelector("div[class*='title']");
            const title = titleElement ? titleElement.textContent.trim() : "";

            // Extract apply link from a tag
            const linkElement = itemElement.querySelector("a");
            const applyLink = linkElement ? linkElement.getAttribute("href") : "";

            // Extract location from div.fieldValue-3kEar
            let location = "";
            const locationElement = itemElement.querySelector("div[class*='fieldValue']");
            if (locationElement) {
              location = locationElement.textContent.trim();
            }

            // Extract posted date from div.subData-13Lm1
            let postedDate = "Recently";
            const postedElement = itemElement.querySelector("div[class*='subData']");
            if (postedElement) {
              postedDate = postedElement.textContent.trim();
            }

            return { title, applyLink, location, postedDate };
          }, i);

          if (!jobData.title) {
            console.log(`⚠ Skipping item ${i + 1}: No title found`);
            continue;
          }

          const { city, state } = parseLocation(jobData.location);

          // Construct full apply link if it's relative
          let fullApplyLink = jobData.applyLink;
          if (fullApplyLink && !fullApplyLink.startsWith("http")) {
            fullApplyLink = `https://careers.appliedmaterials.com${jobData.applyLink}`;
          }

          const formattedJob = {
            employer_name: "APPLIED MATERIALS",
            job_title: cleanJobTitle(jobData.title),
            job_city: city,
            job_state: state,
            job_posted_at: jobData.postedDate || "Recently",
            job_description: `${searchQuery} job for the role ${jobData.title} at ${jobData.location}`,
            job_apply_link: fullApplyLink || searchUrl,
          };

          allJobs.push(formattedJob);
          console.log(`✓ Page ${pageNumber} - Job ${i + 1}/${jobItems.length}: ${jobData.title} at ${city}, ${state}`);

        } catch (error) {
          console.error(`Error extracting job data from item ${i + 1} on page ${pageNumber}:`, error);
          continue;
        }
      }

      console.log(`✅ Page ${pageNumber} completed: ${jobItems.length} jobs scraped`);
      
      // Add a small delay between pages to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }

  console.log(`\n🎉 Multi-page scraping completed! Found ${allJobs.length} total jobs across all pages.`);
  return allJobs;
}

// Main execution function
async function main() {
  try {
    const args = process.argv.slice(2);
    let searchQuery = "";
    let maxPages = 10;

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--max-pages" || args[i] === "-m") {
        maxPages = parseInt(args[i + 1]) || 10;
        i++;
      } else {
        searchQuery += (searchQuery ? " " : "") + args[i];
      }
    }

    if (!searchQuery) {
      searchQuery = "hardware engineering";
    }

    if (!searchQuery) {
      console.log("Please provide a search query!");
      console.log("Usage: node appliedMaterialsScraper.js hardware engineering");
      console.log("Usage: node appliedMaterialsScraper.js software engineer --max-pages 5");
      console.log('Usage: node appliedMaterialsScraper.js "machine learning" -m 3');
      return;
    }

    console.log(`=== Scraping Applied Materials Jobs for: "${searchQuery}" (up to ${maxPages} pages) ===`);
    const jobs = await appliedMaterialsScraper(searchQuery, maxPages);
    
    console.log(`\n🎉 Multi-page scraping completed! Found ${jobs.length} jobs for "${searchQuery}"`);

    if (jobs.length > 0) {
      console.log("\n📋 All Scraped Jobs:");
      console.log("=".repeat(80));

      jobs.forEach((job, index) => {
        console.log(`\n${index + 1}. ${job.job_title}`);
        console.log(`   Company: ${job.employer_name}`);
        console.log(`   Location: ${job.job_city}, ${job.job_state}`);
        console.log(`   Posted: ${job.job_posted_at}`);
        console.log(`   Apply: ${job.job_apply_link}`);
      });

      console.log("\n" + "=".repeat(80));
      console.log(`📊 Summary: ${jobs.length} jobs found across all pages`);

      // Show page breakdown
      console.log(`📄 Scraped up to page ${Math.min(maxPages, Math.ceil(jobs.length / 10))}`);

      // JSON format for first 2 jobs
      console.log("\n🔧 JSON Format (first 2 jobs):");
      console.log(JSON.stringify(jobs.slice(0, 2), null, 2));
    } else {
      console.log("❌ No jobs found for the search query.");
    }

  } catch (error) {
    console.error("Error in main:", error);
  }
}

module.exports = appliedMaterialsScraper;

if (require.main === module) {
  main();
}