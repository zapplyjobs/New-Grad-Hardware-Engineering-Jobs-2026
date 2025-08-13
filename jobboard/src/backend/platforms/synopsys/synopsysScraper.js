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

  const cleanedLocation = locationText
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "")
    .trim();

  if (!cleanedLocation || cleanedLocation.toLowerCase().includes("offsite")) {
    return { city: "Remote", state: "Remote" };
  }

  const locationParts = cleanedLocation.split(",").map((part) => part.trim());

  if (locationParts.length >= 2) {
    return { city: locationParts[0], state: locationParts[1] };
  } else if (locationParts.length === 1 && locationParts[0]) {
    const location = cleanedLocation.trim();
    return { city: location, state: location };
  } else {
    return { city: "Remote", state: "Remote" };
  }
}

// Helper function to convert date to relative format
function convertDateToRelative(dateString) {
  if (!dateString) return "Recently";
  
  try {
    let cleanDate = dateString.replace(/<[^>]+>/g, '').replace(/Posted:\s*/, '').trim();
    
    const dateParts = cleanDate.split('/');
    if (dateParts.length !== 3) return "Recently";
    
    const month = parseInt(dateParts[0]);
    const day = parseInt(dateParts[1]);
    const year = parseInt(dateParts[2]);
    
    const jobDate = new Date(year, month - 1, day);
    const currentDate = new Date();
    
    const diffTime = currentDate - jobDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return "Recently";
    } else if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "1 day ago";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 14) {
      return "1 week ago";
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} weeks ago`;
    } else if (diffDays < 60) {
      return "1 month ago";
    } else {
      const months = Math.floor(diffDays / 30);
      return `${months} months ago`;
    }
  } catch (error) {
    console.log(`Error parsing date: ${dateString}`, error);
    return "Recently";
  }
}

async function synopsysScraper(searchQuery, maxPages = 10) {
  const browser = await puppeteer.launch({
    headless: "new", // Use "new" headless mode which is more stable
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--disable-extensions",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
      "--window-size=1920,1080"
    ],
  });

  const page = await browser.newPage();
  
  // More comprehensive browser setup for headless mode
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1920, height: 1080 });

  // Set extra headers to mimic real browser
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  });

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
  const baseUrl = "https://careers.synopsys.com/search-jobs";
  let currentPage = 1;

  try {
    console.log(`=== Starting to scrape up to ${maxPages} pages for: "${searchQuery}" ===`);

    // Construct the initial search URL
    const searchUrl = `${baseUrl}/${encodeURIComponent(searchQuery)}/United%20States/44408/1/2/6252001/39x76/-98x5/50/2`;
    console.log(`Navigating to: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: ["networkidle2", "domcontentloaded"],
      timeout: 60000,
    });

    while (currentPage <= maxPages) {
      console.log(`\n--- Scraping Page ${currentPage} ---`);

      // Scroll to the bottom to ensure all content loads
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait for content to stabilize after scrolling
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Wait for job results
      try {
        await page.waitForSelector("li.search-results-list__list-item", { timeout: 15000 });
      } catch (error) {
        console.log(`No jobs found on page ${currentPage}, stopping...`);
        break;
      }

      // Get all job items
      const jobItems = await page.$$("li.search-results-list__list-item");
      
      console.log(`Found ${jobItems.length} job items on page ${currentPage}`);

      // If no jobs found, stop
      if (jobItems.length === 0) {
        console.log(`No jobs on page ${currentPage}, stopping...`);
        break;
      }

      // Extract job data
      for (let i = 0; i < jobItems.length; i++) {
        try {
          const jobData = await jobItems[i].evaluate((itemElement) => {
            const titleElement = itemElement.querySelector("h2");
            const title = titleElement ? titleElement.textContent.trim() : "";
            const apply = itemElement.querySelector('a');
            const applyLink = apply ? apply.getAttribute("href") : "";
            let location = "";
            const locationElement = itemElement.querySelector("span.job-location");
            if (locationElement) {
              location = locationElement.textContent.trim();
            }
            let postedDate = "";
            const postedElement = itemElement.querySelector("span.job-date-posted");
            if (postedElement) {
              postedDate = postedElement.textContent.trim();
            }
            return { title, applyLink, location, postedDate };
          });

          if (!jobData.title) {
            console.log(`⚠ Skipping item ${i + 1}: No title found`);
            continue;
          }

          const { city, state } = parseLocation(jobData.location);
          let fullApplyLink = jobData.applyLink;
          if (fullApplyLink && !fullApplyLink.startsWith("http")) {
            fullApplyLink = `https://careers.synopsys.com${jobData.applyLink}`;
          }

          const relativePostedDate = convertDateToRelative(jobData.postedDate);

          const formattedJob = {
            employer_name: "SYNOPSYS",
            job_title: cleanJobTitle(jobData.title),
            job_city: city,
            job_state: state,
            job_posted_at: relativePostedDate,
            job_description: `${searchQuery} job for the role ${jobData.title} at ${jobData.location}`,
            job_apply_link: fullApplyLink,
          };

          allJobs.push(formattedJob);
          console.log(`✓ Page ${currentPage} - Job ${i + 1}/${jobItems.length}: ${jobData.title} at ${city}, ${state} (${relativePostedDate})`);

        } catch (error) {
          console.error(`Error extracting job data from item ${i + 1} on page ${currentPage}:`, error);
          continue;
        }
      }

      console.log(`✅ Page ${currentPage} completed: ${jobItems.length} jobs scraped`);

      // Try multiple approaches to find and click the next button
      let navigated = false;
      
      // Approach 1: Try the original method first
      try {
        const nextButton = await page.$("a.next");
        if (nextButton && !(await page.evaluate(el => el.classList.contains('disabled'), nextButton))) {
          console.log(`Approach 1: Clicking "Next" button to load page ${currentPage + 1}...`);
          await nextButton.click();
          await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 45000 });
          navigated = true;
        }
      } catch (error) {
        console.log(`Approach 1 failed: ${error.message}`);
      }

     

      if (!navigated) {
        console.log(`All navigation approaches failed or no "Next" button found, stopping at page ${currentPage}...`);
        break;
      }

      // Additional wait for content to stabilize
      await new Promise(resolve => setTimeout(resolve, 3000));
      currentPage++;
    }

  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }

  console.log(`\n🎉 Multi-page scraping completed! Found ${allJobs.length} total jobs across ${currentPage} pages.`);
  return allJobs;
}

// Main execution function
async function main() {
  try {
    const args = process.argv.slice(2);
    let searchQuery = "";
    let maxPages = 10;

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
      console.log("Usage: node synopsysScraper.js hardware engineering");
      console.log("Usage: node synopsysScraper.js software engineer --max-pages 5");
      console.log('Usage: node synopsysScraper.js "machine learning" -m 3');
      return;
    }

    console.log(`=== Scraping Synopsys Jobs for: "${searchQuery}" (up to ${maxPages} pages) ===`);
    const jobs = await synopsysScraper(searchQuery, maxPages);
    
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

      console.log("\n🔧 JSON Format (first 2 jobs):");
      console.log(JSON.stringify(jobs.slice(0, 2), null, 2));
    } else {
      console.log("❌ No jobs found for the search query.");
    }

  } catch (error) {
    console.error("Error in main:", error);
  }
}

module.exports = synopsysScraper;

if (require.main === module) {
  main();
}