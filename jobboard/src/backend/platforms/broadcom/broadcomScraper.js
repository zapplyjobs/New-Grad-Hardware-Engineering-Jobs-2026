const puppeteer = require('puppeteer');

// Helper function to clean job titles
function cleanJobTitle(title) {
  if (!title) return title;
  
  // Remove common prefixes and suffixes
  return title
    .replace(/^(Senior|Staff|Principal|Lead|Jr|Junior)\s+/i, '')
    .replace(/\s+(I|II|III|IV|V|\d+)$/, '')
    .replace(/\s*-\s*(Remote|Hybrid|On-site).*$/i, '')
    .trim();
}

// Helper function to parse location
function parseLocation(locationText) {
  if (!locationText) {
    return { city: 'Unknown', state: 'US' };
  }
  
  // Clean up the location text and parse different formats
  const cleanLocation = locationText.replace(/,?\s*United States$/i, '').trim();
  
  if (!cleanLocation) {
    return { city: '', state: 'United States' };
  }
  
  // Split by comma and trim
  const parts = cleanLocation.split(',').map(part => part.trim());
  
  if (parts.length >= 2) {
    // Format: "Westborough, MA" or "City, State"
    return {
      city: parts[0],
      state: parts[1]
    };
  } else if (parts.length === 1) {
    // Could be just a state or just a city
    const singlePart = parts[0];
    
    // Common US state abbreviations
    const stateAbbreviations = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    ];
    
    if (stateAbbreviations.includes(singlePart.toUpperCase())) {
      return { city: '', state: singlePart.toUpperCase() };
    } else {
      return { city: singlePart, state: '' };
    }
  }
  
  return { city: '', state: '' };
}const location = '036f545a07811067fb610630a895b9d1' +
  '&locations=4a762b79ba9901fbfe4aa39dee017989' +
  '&locations=877d747df7191002136680bc73dd0000' +
  '&locations=036f545a07811067fe54543fbf78bf0b' +
  '&locations=4a762b79ba9901dd1c968d9dee013d89' +
  '&locations=036f545a07811067fe3102fad18abe98' +
  '&locations=877d747df71910021366662e2df00000' +
  '&locations=0dd627624e2e013c1b0b00dadcd9d20c' +
  '&locations=4d92fd6213b61072a7417474224cdf6f' +
  '&locations=036f545a07811067f1de98b90bc6a926' +
  '&locations=0dd627624e2e01ef94cee9d9dcd9be0c' +
  '&locations=036f545a07811067fe218885c2cfbe7b' +
  '&locations=4b92da390b9b10b7bbda11b85613cb77' +
  '&locations=29320def7b02106689d3b1774d23aec8' +
  '&locations=12a17a8024ab0188b084e8699205dedc' +
  '&locations=184c736cf3ea101ebb66e6d76e01745d' +
  '&locations=036f545a07811067fe06ebd34c95be15' +
  '&locations=0dd627624e2e01adaab9d4d9dcd9aa0c' +
  '&locations=bc7b9b9faae610013552e580e0050000' +
  '&locations=036f545a07811067fdde3f0aaa04bddc' +
  '&locations=036f545a07811067f02d8e8d652ca59a' +
  '&locations=684d61d26ae81001e56a71a3ea7f0000' +
  '&locations=092b5fae35ea103936b2cf96c8937ee4' +
  '&locations=036f545a07811067fdd04465a219bdca' +
  '&locations=036f545a07811067fdaef047ea16bd84' +
  '&locations=036f545a07811067fd922a750736bd46' +
  '&locations=036f545a07811067fd81d424f6f7bd34' +
  '&locations=bc7b9b9faae6100135a5028075d30000' +
  '&locations=036f545a07811067f0a87f246cdca66f' +
  '&locations=9c718cedc47410720f2bf064829fb76b' +
  '&locations=3fe9c5fb131001012dd089fc94a00000' +
  '&locations=036f545a07811067fb9e5a23b23bba74' +
  '&locations=34a3eda408dd1000f53fee68ed950000' +
  '&locations=0dd627624e2e0140aadb9fd9dcd9780c' +
  '&locations=036f545a07811067fb8008d4ab6db9fa' +
  '&locations=877d747df71910021365fa3b7dd40000' +
  '&locations=036f545a07811067fb6fcb79192fb9db' +
  '&locations=4a762b79ba990193859f8b9dee013889' +
  '&locations=0dd627624e2e01ade01e8cd9dcd9640c' +
  '&locations=288fd69044a1013faf91cae80d12033d' +
  '&locations=b8b934041f1710a36c7d5f74cb2b8324' +
  '&locations=4b92da390b9b10b7bb847e8f1b75cac8' +
  '&locations=f1900192220f010e8b06cc0dfeb6f74e' +
  '&locations=036f545a07811067ec96c1512ad3a036' +
  '&locations=036f545a07811067fb4d9a7c1d47b9b8' +
  '&locations=ac281c4e5ca401ac22de4737f50155b5' +
  '&locations=3752a56f61f71001315aa3c6ecd50000' +
  '&locations=44b3a7caf8e6480795125e010f577053' +
  '&locations=288fd69044a1015bc80b7fb60d12d53c' +
  '&locations=036f545a07811067f088b65977bba653' +
  '&locations=092b5fae35ea103935df5e4c2e637d4f' +
  '&locations=877d747df71910021361ce875ee20000' +
  '&locations=877d747df71910021363ae79396c0000' +
  '&locations=877d747df719100213626ffcfae00000' +
  '&locations=877d747df71910021361d95ffda70000' +
  '&locations=877d747df71910021363291521ae0000' +
  '&locations=877d747df719100213623cd467ed0000' +
  '&locations=877d747df719100213635c7f40d30000' +
  '&locations=2a204116f85f013c9e832787796b52c8' +
  '&locations=2a204116f85f0193baeeb7e2796b85c8' +
  '&locations=3d9f1a0214ac01439ca04708d2465801' +
  '&locations=877d747df71910021365c0592d6f0000' +
  '&locations=092b5fae35ea103937177f80adeb7f1f' +
  '&locations=092b5fae35ea1039363a0cdcb5837e8b' +
  '&locations=df820e04c9924c84b5214f4d68b50fa9' +
  '&locations=036f545a07811067ed3afb5b6f6ca09f' +
  '&locations=877d747df7191002136629d4bc1f0000' +
  '&locations=bc19fd96cebf1069285cfef83d445107' +
  '&locations=877d747df719100213665b4fa1470000' +
  '&locations=877d747df719100213668b996bb60000';

// Function to parse location IDs into an array
function parseLocationIds(locationString) {
  return locationString.split('&locations=').filter(id => id);
}

// Example usage
const locationIds = parseLocationIds(location);

// Helper function to convert date to relative forma

async function broadcomScraper(searchQuery, maxPages = 10) {
  // Parse the location IDs from the predefined location string
  const locationIds = parseLocationIds(location);
  
  const browser = await puppeteer.launch({
    headless: true, // Set to true for production
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-images', // Disable images for optimization
      '--disable-javascript', // Keep JS enabled for interactions
      '--disable-plugins',
      '--disable-extensions',
       
      
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
    ]
  });

  const page = await browser.newPage();
  
  // Disable CSS and images for optimization
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (resourceType === 'stylesheet' || resourceType === 'image' || resourceType === 'font') {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  // Set user agent to avoid blocking
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  
  const allJobs = [];
  const baseUrl = 'https://broadcom.wd1.myworkdayjobs.com';
  
  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`Scraping page ${pageNum}...`);
      const locationParam = locationIds.map(id => `locations=${id}`).join('&');
      // Construct URL with search query
      const searchUrl = `${baseUrl}/External_Career?q=${encodeURIComponent(searchQuery)}&${locationParam}`;
      
      if (pageNum === 1) {
        console.log(`Searching for: "${searchQuery}"`);
        console.log(`Navigating to: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      }
      
      // Wait for job listings to load
      try {
        await page.waitForSelector('li.css-1q2dra3', { timeout: 100000 });
      } catch (error) {
        console.log(`No jobs found on page ${pageNum}, stopping...`);
        break;
      }
      
      // Scroll to bottom to load all jobs on current page
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get all job list items
      const jobItems = await page.$$('li.css-1q2dra3');
      
      if (jobItems.length === 0) {
        console.log(`No job items found on page ${pageNum}, stopping...`);
        break;
      }
      
      console.log(`Found ${jobItems.length} potential job items on page ${pageNum}`);
      
      // Extract job data from each list item
      for (const jobItem of jobItems) {
        try {
          const jobData = await jobItem.evaluate((item) => {
            // Extract title from h3
            const titleElement = item.querySelector('h3');
            const title = titleElement ? titleElement.textContent.trim() : '';
            
            // Extract apply link from a tag
            const linkElement = item.querySelector('a');
            const applyLink = linkElement ? linkElement.getAttribute('href') : '';
            
            // Extract location and posted date from dd.css-129m7dg elements
            const ddElements = item.querySelectorAll('dd.css-129m7dg');
            let location = '';
            let posted = '';
            
            if (ddElements.length >= 2) {
              location = ddElements[0] ? ddElements[0].textContent.trim() : '';
              posted = ddElements[1] ? ddElements[1].textContent.trim() : '';
            } else if (ddElements.length === 1) {
              location = ddElements[0] ? ddElements[0].textContent.trim() : '';
            }
            
            return {
              title,
              applyLink,
              location,
              posted
            };
          });
          
          // Skip if no job data found
          if (!jobData || !jobData.title) continue;
          
          // Parse location
          const { city, state } = parseLocation(jobData.location);
          
          // Construct full apply link
          const applyLink = jobData.applyLink ? 
            (jobData.applyLink.startsWith('http') ? jobData.applyLink : `${baseUrl}${jobData.applyLink}`) 
            : '';
          
          // Format the job data
          const formattedJob = {
            employer_name: "Broadcom",
            job_title: cleanJobTitle(jobData.title),
            job_city: city,
            job_state: state,
            job_posted_at:jobData.posted,
            job_description:`${searchQuery} job for the role ${jobData.title} at ${jobData.location}`,
            job_apply_link: applyLink
          };
          
          allJobs.push(formattedJob);
          console.log(`✓ Scraped: ${jobData.title} at ${jobData.location}`);
          
        } catch (error) {
          console.error('Error extracting job data from item:', error);
          continue;
        }
      }
      
      // Check if we've reached the last page or need to navigate to next page
      if (pageNum < maxPages) {
        console.log(`Looking for next page button...`);
        
        // Look for the next page button (chevron right)
        try {
          const nextButton = await page.$('svg.wd-icon-chevron-right-small.wd-icon');
          
          if (nextButton) {
            // Check if the button is clickable (not disabled)
            const isClickable = await page.evaluate((button) => {
              const parentButton = button.closest('button');
              return parentButton && !parentButton.disabled && !parentButton.getAttribute('aria-disabled');
            }, nextButton);
            
            if (isClickable) {
              console.log(`Clicking next page button for page ${pageNum + 1}...`);
              await nextButton.click();
              
              // Wait for new page to load
              await new Promise(resolve => setTimeout(resolve, 3000));
              await page.waitForSelector('li.css-1q2dra3', { timeout: 10000 });
            } else {
              console.log('Next page button is disabled, reached last page');
              break;
            }
          } else {
            console.log('No next page button found, reached last page');
            break;
          }
        } catch (error) {
          console.log('Error navigating to next page:', error.message);
          break;
        }
      }
      
      // Add delay between pages to be respectful
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }
  
  console.log(`\n Broadcom Scraping completed! Found ${allJobs.length} total jobs.`);
  return allJobs;
}

// Example usage
async function main() {
  try {
    // Get search query from command line arguments
    // If multiple arguments, join them with spaces
    const searchQuery = process.argv.slice(2).join(' ');
    
    if (!searchQuery) {
      console.log('Please provide a search query!');
      console.log('Usage: node broadcomScraper.js hardware engineering');
      console.log('Usage: node broadcomScraper.js software');
      console.log('Usage: node broadcomScraper.js "data science"');
      console.log('Or with quotes: node broadcomScraper.js "machine learning"');
      console.log('Note: maxPages parameter controls number of pages to scrape');
      return;
    }
    
    console.log(`=== Scraping Broadcom Careers for: "${searchQuery}" (10 pages max) ===`);
    const jobs = await broadcomScraper(searchQuery, 10);
    console.log(`\n🎉 Scraping completed! Found ${jobs.length} jobs for "${searchQuery}"`);
    
    // Display all scraped jobs
    if (jobs.length > 0) {
      console.log('\n📋 All Scraped Jobs:');
      console.log('='.repeat(80));
      
      jobs.forEach((job, index) => {
        console.log(`\n${index + 1}. ${job.job_title}`);
        console.log(`   Company: ${job.employer_name}`);
        console.log(`   Location: ${job.job_city}, ${job.job_state}`);
        console.log(`   Posted: ${job.job_posted_at}`);
        console.log(`   Apply: ${job.job_apply_link}`);
        console.log(`   Description: ${job.job_description.substring(0, 100)}...`);
      });
      
      console.log('\n' + '='.repeat(80));
      console.log(`📊 Summary: ${jobs.length} jobs found`);
      
      // Also show JSON format for first 2 jobs
      console.log('\n🔧 JSON Format (first 2 jobs):');
      console.log(JSON.stringify(jobs.slice(0, 2), null, 2));
    } else {
      console.log('❌ No jobs found for the search query.');
    }
    
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Export the scraper function
module.exports = broadcomScraper;

// Run if this file is executed directly
if (require.main === module) {
  main();
}

//both