const puppeteer = require('puppeteer');

// Helper function to clean job titles
function cleanJobTitle(title) {
  if (!title) return title;
  return title
    .replace(/^(Senior|Staff|Principal|Lead|Jr|Junior)\s+/i, '')
    .replace(/\s+(I|II|III|IV|V|\d+)$/, '')
    .replace(/\s*-\s*(Remote|Hybrid|On-site).*$/i, '')
    .trim();
}

// Helper function to parse location
function parseLocation(locationText) {
  if (!locationText || locationText.toLowerCase().includes('multiple')) {
    return { city: 'Multiple', state: 'Locations', country: 'US' };
  }
  
  // Clean up the location text
  locationText = locationText.replace(/\s+/g, ' ').trim();
  
  const parts = locationText.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    const city = parts[0];
    const stateOrCountry = parts[1];
    
    // Check if it's a US state or city, state format
    const usStates = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'MI', 'GA', 'NC', 'NJ', 'VA', 'WA', 'MA', 'IN', 'AZ', 'TN', 'MO', 'MD', 'WI', 'MN', 'CO', 'AL', 'SC', 'LA', 'KY', 'OR', 'OK', 'CT', 'IA', 'MS', 'AR', 'KS', 'UT', 'NV', 'NM', 'WV', 'NE', 'ID', 'HI', 'NH', 'ME', 'RI', 'MT', 'DE', 'SD', 'ND', 'AK', 'VT', 'WY', 'DC'];
    const usStateFull = ['California', 'New York', 'Texas', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio', 'Michigan', 'Georgia', 'North Carolina', 'New Jersey', 'Virginia', 'Washington', 'Massachusetts', 'Indiana', 'Arizona', 'Tennessee', 'Missouri', 'Maryland', 'Wisconsin', 'Minnesota', 'Colorado', 'Alabama', 'South Carolina', 'Louisiana', 'Kentucky', 'Oregon', 'Oklahoma', 'Connecticut', 'Iowa', 'Mississippi', 'Arkansas', 'Kansas', 'Utah', 'Nevada', 'New Mexico', 'West Virginia', 'Nebraska', 'Idaho', 'Hawaii', 'New Hampshire', 'Maine', 'Rhode Island', 'Montana', 'Delaware', 'South Dakota', 'North Dakota', 'Alaska', 'Vermont', 'Wyoming'];
    
    if (usStates.includes(stateOrCountry) || usStateFull.includes(stateOrCountry) || 
        stateOrCountry.toLowerCase().includes('us') || stateOrCountry.toLowerCase().includes('usa') ||
        stateOrCountry.toLowerCase().includes('united states')) {
      return { city, state: stateOrCountry, country: 'US' };
    }
    
    // Check for common US cities
    const usCities = ['Austin', 'San Francisco', 'New York', 'Chicago', 'Boston', 'Seattle', 'Denver', 'Atlanta', 'Miami', 'Los Angeles', 'Washington'];
    if (usCities.some(usCity => city.toLowerCase().includes(usCity.toLowerCase()))) {
      return { city, state: stateOrCountry, country: 'US' };
    }
  }
  
  // If single location, check if it's US
  if (parts.length === 1) {
    const location = parts[0].toLowerCase();
    if (location.includes('remote') || location.includes('us') || location.includes('usa') || 
        location.includes('united states') || location.includes('austin') || 
        location.includes('san francisco') || location.includes('new york') ||
        location.includes('chicago') || location.includes('boston') || location.includes('seattle') ||
        location.includes('denver') || location.includes('atlanta') || location.includes('miami') ||
        location.includes('los angeles') || location.includes('washington')) {
      return { city: parts[0], state: 'US', country: 'US' };
    }
  }
  
  return { city: locationText, state: 'Unknown', country: 'Unknown' };
}

// Function to get job details from individual job page
async function getJobDetails(page, jobUrl) {
  try {
    await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const jobDetails = await page.evaluate(() => {
      // Look for location information on the job page
      const locationSelectors = [
        '.location',
        '.job-location',
        '[data-mapped="location"]',
        'h4:contains("Location") + p',
        'strong:contains("Location") + span',
        '.content h4'
      ];
      
      let location = '';
      let department = '';
      
      // Try to find location
      for (const selector of locationSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          location = el.textContent.trim();
          break;
        }
      }
      
      // Look for location in text content
      if (!location) {
        const text = document.body.textContent;
        const locationMatch = text.match(/Location[:\s]+([^,\n]+(?:,\s*[^,\n]+)?)/i);
        if (locationMatch) {
          location = locationMatch[1].trim();
        }
      }
      
      // Look for department
      const deptSelectors = ['.department', '[data-mapped="department"]', 'h4:contains("Department") + p'];
      for (const selector of deptSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          department = el.textContent.trim();
          break;
        }
      }
      
      return { location, department };
    });
    
    return jobDetails;
  } catch (err) {
    console.error(`Error fetching job details from ${jobUrl}:`, err.message);
    return { location: '', department: '' };
  }
}

async function cloudflareScraper(searchQuery, maxPages = 10, usOnly = true) {
  const browser = await puppeteer.launch({
    headless: true, // Set to true for production
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  const allJobs = [];

  try {
    console.log(`Scraping Cloudflare careers for: "${searchQuery}"`);
    if (usOnly) {
      console.log('Filtering for US jobs only');
    }
    
    // Go to careers page
    const baseUrl = 'https://www.cloudflare.com/en-gb/careers/jobs/';
    console.log(`Navigating to: ${baseUrl}`);
    
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Page loaded, looking for job listings...');

    // Get job links that match search criteria
    const jobLinks = await page.evaluate((searchTerm) => {
      const jobs = [];
      const allLinks = document.querySelectorAll('a');
      
      allLinks.forEach(link => {
        const text = link.textContent.trim();
        const href = link.href;
        
        // Check if this looks like a job posting
        if (text && href && 
            (text.toLowerCase().includes(searchTerm.toLowerCase()) ||
             searchTerm.toLowerCase().split(' ').some(term => text.toLowerCase().includes(term))) &&
            href.includes('greenhouse.io')) {
          
          jobs.push({
            title: text,
            href: href
          });
        }
      });
      
      return jobs;
    }, searchQuery);

    console.log(`Found ${jobLinks.length} potential job links`);

    // Process each job link to get detailed information
    for (let i = 0; i < jobLinks.length; i++) {
      const job = jobLinks[i];
      console.log(`Processing job ${i + 1}/${jobLinks.length}: ${job.title}`);
      
      try {
        // Get detailed job information
        const jobDetails = await getJobDetails(page, job.href);
        
        let location = jobDetails.location;
        let department = jobDetails.department;
        
        // If no location found from job page, try to extract from title or use fallback
        if (!location || location.length < 3) {
          // Check if location is in the title
          const titleParts = job.title.split('-').map(p => p.trim());
          const possibleLocation = titleParts[titleParts.length - 1];
          if (possibleLocation && possibleLocation.length < 50) {
            location = possibleLocation;
          } else {
            location = 'Remote/Multiple Locations';
          }
        }
        
        const { city, state, country } = parseLocation(location);
        
        // Filter for US jobs only if requested
        if (usOnly && country !== 'US') {
          console.log(`  Skipping non-US job: ${job.title} (${location})`);
          continue;
        }
        
        const jobData = {
          employer_name: "Cloudflare",
          job_title: cleanJobTitle(job.title),
          job_city: city,
          job_state: state,
          job_posted_at: 'Recently',
          job_description: `${searchQuery} position at Cloudflare in ${department || 'various'} department`,
          job_apply_link: job.href
        };
        
        allJobs.push(jobData);
        console.log(`  ✓ Added: ${job.title} - ${city}, ${state}`);
        
      } catch (err) {
        console.error(`Error processing job: ${job.title}`, err.message);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (err) {
    console.error('Error during scraping:', err);
  } finally {
    await browser.close();
  }

  console.log(`\nScraping completed! Found ${allJobs.length} ${usOnly ? 'US ' : ''}jobs.`);
  return allJobs;
}

// Example usage
async function main() {
  const args = process.argv.slice(2);
  const searchQuery = args.filter(arg => !arg.startsWith('--')).join(' ') || 'Data Scientist';
  const usOnly = !args.includes('--all-locations'); // Default to US only unless --all-locations is specified
  
  console.log(`=== Scraping Cloudflare careers for: "${searchQuery}" ===`);
  const jobs = await cloudflareScraper(searchQuery, 1, usOnly);
  
  console.log(`\nFinal result: Found ${jobs.length} ${usOnly ? 'US ' : ''}jobs for "${searchQuery}"`);
  
  if (jobs.length > 0) {
    console.log('\nJobs found:');
    jobs.forEach((job, index) => {
      console.log(`\n${index + 1}. ${job.job_title}`);
      console.log(`   Location: ${job.job_city}, ${job.job_state}`);
      console.log(`   Link: ${job.job_apply_link}`);
    });
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total jobs: ${jobs.length}`);
    const locations = [...new Set(jobs.map(job => `${job.job_city}, ${job.job_state}`))];
    console.log(`Unique locations: ${locations.join(', ')}`);
    
    console.log('\nFull JSON output:');
    console.log(JSON.stringify(jobs, null, 2));
  } else {
    console.log(`\nNo ${usOnly ? 'US ' : ''}jobs found for "${searchQuery}".`);
    console.log('\nTips:');
    console.log('- Try a broader search term like "Data" instead of "Data Scientist"');
    if (usOnly) {
      console.log('- Use --all-locations flag to include international jobs');
    }
  }
}

module.exports = cloudflareScraper;

if (require.main === module) {
  main();
}