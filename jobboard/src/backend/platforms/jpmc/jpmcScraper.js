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

// Helper function to parse location and filter US jobs - RELAXED VERSION
function parseLocation(locationText) {
  if (!locationText || locationText.toLowerCase().includes('multiple')) {
    return { city: 'Multiple', state: 'Locations', country: 'US', isUS: true };
  }
  
  // Clean up the location text
  locationText = locationText.replace(/\s+/g, ' ').trim();
  
  const parts = locationText.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    const city = parts[0];
    const stateOrCountry = parts[1];
    const country = parts[2] || '';
    
    // Check if it's a US location
    const usStates = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'MI', 'GA', 'NC', 'NJ', 'VA', 'WA', 'MA', 'IN', 'AZ', 'TN', 'MO', 'MD', 'WI', 'MN', 'CO', 'AL', 'SC', 'LA', 'KY', 'OR', 'OK', 'CT', 'IA', 'MS', 'AR', 'KS', 'UT', 'NV', 'NM', 'WV', 'NE', 'ID', 'HI', 'NH', 'ME', 'RI', 'MT', 'DE', 'SD', 'ND', 'AK', 'VT', 'WY', 'DC'];
    const usStateFull = ['California', 'New York', 'Texas', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio', 'Michigan', 'Georgia', 'North Carolina', 'New Jersey', 'Virginia', 'Washington', 'Massachusetts', 'Indiana', 'Arizona', 'Tennessee', 'Missouri', 'Maryland', 'Wisconsin', 'Minnesota', 'Colorado', 'Alabama', 'South Carolina', 'Louisiana', 'Kentucky', 'Oregon', 'Oklahoma', 'Connecticut', 'Iowa', 'Mississippi', 'Arkansas', 'Kansas', 'Utah', 'Nevada', 'New Mexico', 'West Virginia', 'Nebraska', 'Idaho', 'Hawaii', 'New Hampshire', 'Maine', 'Rhode Island', 'Montana', 'Delaware', 'South Dakota', 'North Dakota', 'Alaska', 'Vermont', 'Wyoming'];
    
    // Check if explicitly mentions US/USA/United States
    if (country.toLowerCase().includes('us') || country.toLowerCase().includes('usa') || 
        country.toLowerCase().includes('united states') ||
        stateOrCountry.toLowerCase().includes('us') || stateOrCountry.toLowerCase().includes('usa') ||
        stateOrCountry.toLowerCase().includes('united states')) {
      return { city, state: stateOrCountry, country: 'US', isUS: true };
    }
    
    // Check if state is a US state
    if (usStates.includes(stateOrCountry) || usStateFull.includes(stateOrCountry)) {
      return { city, state: stateOrCountry, country: 'US', isUS: true };
    }
    
    // Check for common US cities
    const usCities = ['New York', 'Chicago', 'Los Angeles', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis', 'Seattle', 'Denver', 'Washington', 'Boston', 'El Paso', 'Nashville', 'Detroit', 'Oklahoma City', 'Portland', 'Las Vegas', 'Memphis', 'Louisville', 'Baltimore', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Sacramento', 'Kansas City', 'Mesa', 'Atlanta', 'Colorado Springs', 'Omaha', 'Raleigh', 'Miami', 'Long Beach', 'Virginia Beach', 'Oakland', 'Minneapolis', 'Tampa', 'Tulsa', 'Arlington', 'Wichita'];
    
    if (usCities.some(usCity => city.toLowerCase().includes(usCity.toLowerCase()))) {
      return { city, state: stateOrCountry, country: 'US', isUS: true };
    }
  }
  
  // Check for US indicators in the location text
  const locationLower = locationText.toLowerCase();
  if (locationLower.includes('usa') || locationLower.includes('united states') || 
      locationLower.includes('us,') || locationLower.includes('remote - us') ||
      locationLower.includes('remote us') || locationLower.includes('united states of america') ||
      locationLower.includes('remote') || locationLower.includes('nationwide')) {
    return { city: locationText, state: 'US', country: 'US', isUS: true };
  }
  
  // VERY RELAXED: Since URL already filters for US, assume most jobs are US unless clearly international
  if (!locationLower.includes('india') && !locationLower.includes('uk') && 
      !locationLower.includes('canada') && !locationLower.includes('singapore') &&
      !locationLower.includes('hong kong') && !locationLower.includes('japan') &&
      !locationLower.includes('brazil') && !locationLower.includes('mexico') &&
      !locationLower.includes('mumbai') && !locationLower.includes('bangalore') &&
      !locationLower.includes('london') && !locationLower.includes('toronto')) {
    return { city: locationText || 'US Location', state: 'US', country: 'US', isUS: true };
  }
  
  return { city: locationText, state: 'International', country: 'Other', isUS: false };
}

async function jpmcScraper(searchQuery, maxPages = 10, usOnly = true) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  const allJobs = [];

  try {
    console.log(`Scraping JPMorgan Chase careers for: "${searchQuery}"`);
    console.log('Using working JPMorgan URL format with location filtering...');
    if (usOnly) {
      console.log('Filtering for US jobs only');
    }

    // Use the exact URL format from the working JPMorgan page
    const baseUrl = 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs';
    
    // Use the exact URL structure that works
    const searchUrls = [
      // Primary URL with exact format from working example
      `${baseUrl}?keyword=${encodeURIComponent(searchQuery.replace(/ /g, '+'))}&location=United+States&locationId=300000000289738&locationLevel=country&mode=location`,
      // Backup URLs with slight variations
      `${baseUrl}?keyword=${encodeURIComponent(searchQuery)}&location=United+States&locationId=300000000289738&locationLevel=country&mode=location`,
      `${baseUrl}?keyword=${encodeURIComponent(searchQuery.replace(/ /g, '+'))}&location=United%20States&locationId=300000000289738&locationLevel=country&mode=location`,
      // Fallback without location filters (if US filter is too restrictive)
      `${baseUrl}?keyword=${encodeURIComponent(searchQuery.replace(/ /g, '+'))}`,
      `${baseUrl}?keyword=${encodeURIComponent(searchQuery)}`
    ];

    let foundJobs = false;
    let maxJobsFound = 0;
    
    for (let urlIndex = 0; urlIndex < searchUrls.length && !foundJobs; urlIndex++) {
      const searchUrl = searchUrls[urlIndex];
      console.log(`\n=== Trying URL pattern ${urlIndex + 1}/${searchUrls.length}: ===`);
      console.log(`URL: ${searchUrl}`);
      if (urlIndex === 0) {
        console.log('^ Using EXACT working URL format from JPMorgan website');
      }
      
      try {
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait longer for dynamic content - Oracle HCM can be slow
        console.log('Waiting for page to load...');
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Try to wait for specific elements that indicate the page has loaded
        try {
          await page.waitForSelector('body', { timeout: 5000 });
          await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });
        } catch (e) {
          console.log('Standard wait selectors failed, continuing...');
        }

        // Check if we're on the right page
        const pageInfo = await page.evaluate(() => {
          const text = document.body.textContent;
          const html = document.body.innerHTML;
          return {
            hasJobsText: text.includes('OPEN JOBS') || text.includes('jobs found') || text.includes('Job Search') || text.includes('Search Results'),
            hasDataText: text.toLowerCase().includes('data'),
            jobCount: text.match(/(\d+)\s+(?:OPEN\s+)?JOBS?/i)?.[1] || '0',
            title: document.title,
            url: window.location.href,
            hasJobCards: document.querySelectorAll('[data-automation-id="jobTitle"], .job-tile, .job-card, .job-item').length > 0,
            totalElements: document.querySelectorAll('*').length,
            bodyLength: text.length,
            hasDataAutomationIds: document.querySelectorAll('[data-automation-id]').length,
            hasJobKeywords: text.toLowerCase().includes('scientist') || text.toLowerCase().includes('analyst') || text.toLowerCase().includes('engineer')
          };
        });

        console.log('Page Analysis:');
        console.log(`- Title: ${pageInfo.title}`);
        console.log(`- Has job-related text: ${pageInfo.hasJobsText}`);
        console.log(`- Has data-related text: ${pageInfo.hasDataText}`);
        console.log(`- Job count found: ${pageInfo.jobCount}`);
        console.log(`- Has job cards: ${pageInfo.hasJobCards}`);
        console.log(`- Total DOM elements: ${pageInfo.totalElements}`);
        console.log(`- Page text length: ${pageInfo.bodyLength}`);
        console.log(`- Has Oracle automation IDs: ${pageInfo.hasDataAutomationIds}`);
        console.log(`- Has job keywords: ${pageInfo.hasJobKeywords}`);

        // More relaxed conditions for detecting a job page - since we're using the correct URL format, 
        // we should be on the right page
        if (pageInfo.totalElements > 50 && pageInfo.bodyLength > 500) {
          console.log(`Processing page (${pageInfo.totalElements} elements, ${pageInfo.bodyLength} chars)`);
          
          // Try many different selectors - cast a wide net
          const possibleSelectors = [
            // Oracle HCM specific selectors
            '[data-automation-id="jobTitle"]',
            '[data-automation-id*="job"]',
            '[data-automation-id*="title"]',
            
            // Common job board selectors
            '.job-tile',
            '.job-card',
            '.job-item',
            '.job-listing',
            '.position',
            '.opening',
            '.career-item',
            '.search-result',
            '.result-item',
            
            // Generic content selectors
            'article',
            'div[role="listitem"]',
            'li[data-automation-id]',
            'li[data-testid]',
            '[data-testid*="job"]',
            '[class*="job"]',
            '[class*="position"]',
            '[class*="search"]',
            '[class*="result"]',
            
            // Link-based selectors
            'a[href*="job"]',
            'a[href*="position"]',
            'a[href*="career"]',
            'h1 a, h2 a, h3 a, h4 a',
            
            // Very generic selectors (last resort)
            'div',
            'span',
            'p'
          ];

          let jobElements = [];
          let workingSelector = null;
          let maxElementsFound = 0;

          for (const selector of possibleSelectors) {
            try {
              const elements = await page.$$(selector);
              if (elements.length > maxElementsFound) {
                console.log(`Found ${elements.length} elements with selector: ${selector}`);
                
                // Test if these elements contain job-like content
                let relevantElements = 0;
                for (let i = 0; i < Math.min(elements.length, 5); i++) {
                  try {
                    const sampleContent = await elements[i].evaluate(el => el.textContent.toLowerCase());
                    if (sampleContent.includes('data') || sampleContent.includes('scientist') || 
                        sampleContent.includes('engineer') || sampleContent.includes('analyst') ||
                        sampleContent.includes('developer') || sampleContent.includes('associate') ||
                        sampleContent.includes('vice president') || sampleContent.includes('director') ||
                        sampleContent.includes('manager') || sampleContent.includes('coordinator')) {
                      relevantElements++;
                    }
                  } catch (e) {
                    // Skip this element
                  }
                }
                
                if (relevantElements > 0) {
                  jobElements = elements;
                  workingSelector = selector;
                  maxElementsFound = elements.length;
                  console.log(`*** Best selector so far: ${selector} (${relevantElements}/${Math.min(elements.length, 5)} relevant)`);
                }
              }
            } catch (err) {
              // Continue to next selector
            }
          }

          // If we found any potentially relevant elements, process them
          if (jobElements.length > 0) {
            foundJobs = true;
            console.log(`\n*** Processing ${jobElements.length} elements using selector: ${workingSelector} ***`);

            // Process job elements
            for (let i = 0; i < Math.min(jobElements.length, 100); i++) {
              try {
                // Extract job data from DOM element
                const jobData = await jobElements[i].evaluate(el => {
                  const text = el.textContent?.trim() || '';
                  
                  // Skip if text is too short or too long
                  if (text.length < 10 || text.length > 500) {
                    return null;
                  }
                  
                  // Check if this looks like a job title
                  const lowerText = text.toLowerCase();
                  const hasJobKeywords = lowerText.includes('data') || lowerText.includes('scientist') || 
                                        lowerText.includes('engineer') || lowerText.includes('analyst') ||
                                        lowerText.includes('developer') || lowerText.includes('associate') ||
                                        lowerText.includes('vice president') || lowerText.includes('director') ||
                                        lowerText.includes('manager') || lowerText.includes('coordinator');
                  
                  if (!hasJobKeywords) {
                    return null;
                  }
                  
                  // Try to find job title and link
                  let title = '';
                  let href = '';
                  let location = '';
                  let department = '';
                  
                  // Look for title in various ways
                  const titleSelectors = ['a', 'h1', 'h2', 'h3', 'h4', 'h5', '[data-automation-id="jobTitle"]'];
                  for (const selector of titleSelectors) {
                    const titleEl = el.querySelector(selector);
                    if (titleEl && titleEl.textContent.trim()) {
                      title = titleEl.textContent.trim();
                      href = titleEl.href || titleEl.closest('a')?.href || '';
                      break;
                    }
                  }
                  
                  if (!title) {
                    // Use the element's text as title if it looks like a job title
                    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
                    title = lines[0] || text;
                  }
                  
                  // Look for link
                  if (!href) {
                    const link = el.querySelector('a') || el.closest('a');
                    href = link?.href || '';
                  }
                  
                  // Look for location in the element or nearby
                  const fullText = el.parentElement?.textContent || text;
                  const locationMatch = fullText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
                  if (locationMatch) {
                    location = locationMatch[0];
                  } else if (fullText.includes('India') || fullText.includes('USA') || 
                           fullText.includes('United States') || fullText.includes('New York') ||
                           fullText.includes('Chicago') || fullText.includes('Mumbai') ||
                           fullText.includes('Remote') || fullText.includes('Nationwide')) {
                    const lines = fullText.split('\n').filter(l => l.trim());
                    location = lines.find(l => 
                      l.includes('India') || l.includes('USA') || l.includes('United States') ||
                      l.includes('New York') || l.includes('Chicago') || l.includes('Mumbai') ||
                      l.includes('Remote') || l.includes('Nationwide') || l.includes(',')
                    ) || '';
                  }
                  
                  return { title, href, location, department };
                });

                if (!jobData || !jobData.title || jobData.title.length < 5) continue;

                // Filter by search query
                const titleLower = jobData.title.toLowerCase();
                const queryLower = searchQuery.toLowerCase();
                const queryWords = queryLower.split(' ');
                
                const matchesQuery = titleLower.includes(queryLower) || 
                                   queryWords.some(word => titleLower.includes(word));
                
                if (!matchesQuery) {
                  continue;
                }

                // Parse location and check if it's US
                let location = jobData.location || 'Location not specified';
                const { city, state, country, isUS } = parseLocation(location);

                // Filter for US jobs if requested
                if (usOnly && !isUS) {
                  console.log(`  Skipping non-US job: ${jobData.title} (${location})`);
                  continue;
                }

                const finalJobData = {
                  employer_name: "JPMorgan Chase",
                  job_title: cleanJobTitle(jobData.title),
                  job_city: city,
                  job_state: state,
                  job_posted_at: 'Recently',
                  job_description: `${searchQuery} position at JPMorgan Chase - ${jobData.title}`,
                  job_apply_link: jobData.href.startsWith('http') ? jobData.href : 
                                  jobData.href ? `https://jpmc.fa.oraclecloud.com${jobData.href}` : ''
                };

                allJobs.push(finalJobData);
                console.log(`  ✓ Added: ${jobData.title} - ${city}, ${state}`);

              } catch (err) {
                // Skip this element
              }
            }
            
            if (allJobs.length > maxJobsFound) {
              maxJobsFound = allJobs.length;
            }
          }
        }

      } catch (err) {
        console.error(`Error with URL pattern ${urlIndex + 1}:`, err.message);
        continue;
      }
      
      // If we found some jobs, we can stop trying other URLs
      if (allJobs.length > 0) {
        console.log(`Found ${allJobs.length} jobs with this URL pattern, stopping search.`);
        break;
      }
    }

    if (allJobs.length === 0) {
      console.log('\n=== DEBUGGING INFO ===');
      console.log('No jobs found. This could be due to:');
      console.log('1. Website structure changed');
      console.log('2. Different URL parameters needed');
      console.log('3. Page requires login or different access method');
      console.log('4. Content is loaded via AJAX/JavaScript after initial page load');
      console.log('5. Search query is too specific');
      
      // Try to get more info about the final page
      const finalPageInfo = await page.evaluate(() => {
        const text = document.body.textContent;
        return {
          url: window.location.href,
          title: document.title,
          bodyTextSample: text.substring(0, 1000),
          hasDataText: text.toLowerCase().includes('data'),
          allDataText: text.toLowerCase().split('\n').filter(line => 
            line.includes('data') && line.length < 200
          ).slice(0, 10)
        };
      });
      
      console.log('\nFinal page info:');
      console.log(`URL: ${finalPageInfo.url}`);
      console.log(`Title: ${finalPageInfo.title}`);
      console.log(`Has "data" text: ${finalPageInfo.hasDataText}`);
      console.log('Sample page text:', finalPageInfo.bodyTextSample.substring(0, 300));
      if (finalPageInfo.allDataText.length > 0) {
        console.log('Lines containing "data":', finalPageInfo.allDataText);
      }
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
  const searchQuery = args.filter(arg => !arg.startsWith('--')).join(' ') || 'Data Science';
  const usOnly = !args.includes('--all-locations'); // Default to US only
  
  console.log(`=== Scraping JPMorgan Chase careers for: "${searchQuery}" ===`);
  const jobs = await jpmcScraper(searchQuery, 10, usOnly);
  
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
    console.log(`Locations: ${locations.join(', ')}`);
    
    console.log('\nFull JSON output:');
    console.log(JSON.stringify(jobs, null, 2));
  } else {
    console.log(`\nNo ${usOnly ? 'US ' : ''}jobs found for "${searchQuery}".`);
    console.log('\nDebugging suggestions:');
    console.log('1. Try a broader search term like "Data" instead of "Data Science"');
    console.log('2. The website might require login or have changed its structure');
    console.log('3. Try running with --all-locations to see if location filtering is too strict');
    console.log('4. The jobs might be loaded dynamically - website structure may have changed');
  }
}

module.exports = jpmcScraper;

if (require.main === module) {
  main();
}