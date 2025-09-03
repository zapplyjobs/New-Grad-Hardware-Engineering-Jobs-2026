const { navigateToPage, preparePageForExtraction, waitForJobSelector } = require('./navigationService.js');
const { buildApplyLink, convertToDescriptionLink } = require('../utils/urlBuilder.js');
const { EXTRACTION_CONSTANTS } = require('../utils/constants.js');

/**
 * Extract job data for a single page with integrated description extraction
 * @param {Object} page - Puppeteer page instance
 * @param {Object} selector - Selector configuration
 * @param {Object} company - Company configuration
 * @param {number} pageNum - Current page number
 * @returns {Array} Array of job objects
 */
async function extractJobData(page, selector, company, pageNum) {
  const jobs = [];

  try {
    await waitForJobSelector(page, selector.jobSelector);
    await preparePageForExtraction(page);

    let jobElements = await page.$$(selector.jobSelector);

    if (selector.name === 'Applied Materials') {
      jobElements = jobElements.slice(-EXTRACTION_CONSTANTS.APPLIED_MATERIALS_LIMIT);
    }

    console.log(`Found ${jobElements.length} job elements for ${company.name} on page ${pageNum}`);

    if (jobElements.length === 0) {
      console.log(`No job elements for ${company.name} on page ${pageNum}, stopping...`);
      return jobs;
    }

    // Check description type and extract accordingly
    const descriptionType = selector.descriptionType || 'same-page';
    const currentUrl = page.url();

    if (descriptionType === 'next-page') {
      // Extract basic data first, then navigate to each job page
      for (let i = 0; i < jobElements.length; i++) {
        // Re-fetch job elements to avoid stale references after navigation
        jobElements = await page.$$(selector.jobSelector);
        if (selector.name === 'Applied Materials') {
          jobElements = jobElements.slice(-EXTRACTION_CONSTANTS.APPLIED_MATERIALS_LIMIT);
        }
        
        if (i >= jobElements.length) {
          console.warn(`Job element ${i} no longer exists, skipping...`);
          continue;
        }

        const jobData = await extractSingleJobData(page, jobElements[i], selector, company, i, pageNum);
        
        if (jobData.title || jobData.applyLink) {
          // Extract description by navigating to job page
          if (selector.descriptionSelector && jobData.applyLink) {
            jobData.description = await extractDescriptionNextPage(page, jobData.applyLink, selector, currentUrl, i + 1);
          }
          jobs.push(jobData);
        }
      }
      
    } else {
      // Same-page extraction
      for (let i = 0; i < jobElements.length; i++) {
        const jobData = await extractSingleJobData(page, jobElements[i], selector, company, i, pageNum);
        
        if (jobData.title || jobData.applyLink) {
          // Extract description on same page if selector exists
          if (selector.descriptionSelector) {
            jobData.description = await extractDescriptionSamePage(page, jobElements[i], selector, i + 1);
          }
          jobs.push(jobData);
        }
      }
    }

  } catch (error) {
    console.error(`Error scraping ${company.name} page ${pageNum}: ${error.message}`);
  }

  return jobs;
}

/**
 * Extract job data from a single job element
 * @param {Object} page - Puppeteer page instance
 * @param {Object} jobElement - Puppeteer element handle
 * @param {Object} selector - Selector configuration
 * @param {Object} company - Company configuration
 * @param {number} index - Job element index
 * @param {number} pageNum - Current page number
 * @returns {Object} Job data object
 */
async function extractSingleJobData(page, jobElement, selector, company, index, pageNum) {
  const rawJobData = await jobElement.evaluate(
    (el, sel, jobIndex) => {
      // Helper functions
      const getText = (selector) => {
        const elem = selector ? el.querySelector(selector) : null;
        return elem ? elem.textContent.trim() : '';
      };

      const getAttr = (selector, attr) => {
        const elem = selector ? el.querySelector(selector) : null;
        return elem ? elem.getAttribute(attr) : '';
      };

      // Extract title
      let title = '';
      if (sel.titleAttribute) {
        title = getAttr(sel.titleSelector, sel.titleAttribute);
      } else {
        title = getText(sel.titleSelector);
      }

      // Extract raw apply link
      let applyLink = '';
      if (sel.applyLinkSelector) {
        applyLink = getAttr(sel.applyLinkSelector.replace(/\${index}/g, jobIndex), sel.linkAttribute);
      } else if (sel.linkSelector) {
        applyLink = getAttr(sel.linkSelector, sel.linkAttribute);
      } else if (sel.jobLinkSelector && sel.linkAttribute) {
        applyLink = el.getAttribute(sel.linkAttribute) || '';
      }

      // Extract location with special handling
      let location = '';
      if (['Honeywell', 'JPMorgan Chase', 'Texas Instruments'].includes(sel.name)) {
        const locationSpans = el.querySelectorAll('span:not(.job-tile__title)');
        for (const span of locationSpans) {
          const text = span.textContent.trim();
          if (
            text.includes(',') ||
            text.toLowerCase().includes('united states') ||
            text.match(/[A-Z]{2}/) ||
            text.includes('TX') ||
            text.includes('Dallas')
          ) {
            location = text;
            break;
          }
        }
      } else {
        location = getText(sel.locationSelector);
      }

      // Extract posted date
      let posted = sel.postedSelector ? getText(sel.postedSelector) : 'Recently';

      // Special handling for 10x Genomics
      if (sel.name === '10x Genomics' && sel.postedSelector) {
        const dateElements = el.querySelectorAll(sel.postedSelector);
        posted = 'Recently';
        for (const div of dateElements) {
          const text = div.textContent.trim();
          if (
            text.toLowerCase().includes('posted') ||
            text.includes('ago') ||
            text.includes('month') ||
            text.includes('day') ||
            text.includes('week')
          ) {
            posted = text;
            break;
          }
        }
      }

      return { title, applyLink, location, posted };
    },
    selector,
    index
  );

  // Build full apply link
  let finalApplyLink = buildApplyLink(rawJobData.applyLink, company.baseUrl || '');
  if (!finalApplyLink && company.baseUrl) {
    finalApplyLink = company.baseUrl;
  }

  // Build job object
  const job = {
    company: selector.name,
    title: rawJobData.title,
    applyLink: finalApplyLink,
    location: rawJobData.location,
    posted: rawJobData.posted,
  };

  // Add optional fields
  if (selector.reqIdSelector) {
    job.reqId = await jobElement.evaluate((el, sel) => {
      const elem = el.querySelector(sel.reqIdSelector);
      return elem ? elem.textContent.trim() : '';
    }, selector);
  }
  
  if (selector.categorySelector) {
    job.category = await jobElement.evaluate((el, sel) => {
      const elem = el.querySelector(sel.categorySelector);
      return elem ? elem.textContent.trim() : '';
    }, selector);
  }

  return job;
}

/**
 * Extract description on same page by clicking job element
 * @param {Object} page - Puppeteer page instance
 * @param {Object} jobElement - Job element handle
 * @param {Object} selector - Selector configuration
 * @param {number} jobNumber - Job number for logging
 * @returns {string} Job description
 */
async function extractDescriptionSamePage(page, jobElement, selector, jobNumber) {
  try {
    console.log(`[${jobNumber}] Same-page description extraction...`);
    
    const titleElement = await jobElement.$(selector.titleSelector);
    if (!titleElement) {
      return 'Title element not found';
    }

    // Click to load description
    await titleElement.click();
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Wait for and extract description
    await page.waitForSelector(selector.descriptionSelector, { timeout: 6000 });
    const description = await extractAndFormatDescription(page, selector.descriptionSelector);
    
    console.log(`[${jobNumber}] Same-page description extracted (${description.length} chars)`);
    return description;
    
  } catch (error) {
    console.error(`[${jobNumber}] Same-page extraction failed: ${error.message}`);
    return 'Same-page description extraction failed';
  }
}

/**
 * Extract description by navigating to job details page
 * @param {Object} page - Puppeteer page instance
 * @param {string} applyLink - URL to job details page
 * @param {Object} selector - Selector configuration
 * @param {string} originalUrl - Original listing page URL to return to
 * @param {number} jobNumber - Job number for logging
 * @returns {string} Job description
 */
async function extractDescriptionNextPage(page, applyLink, selector, originalUrl, jobNumber) {
  let retries = 2;
  
  while (retries > 0) {
    try {
      console.log(`[${jobNumber}] Next-page extraction (attempt ${3 - retries})...`);
      
      // Convert apply link to description link and navigate
      const descriptionLink = convertToDescriptionLink(applyLink, selector.name);
      console.log(`[${jobNumber}] Converting ${applyLink} to ${descriptionLink}`);
      
      await page.goto(descriptionLink, { 
        waitUntil: 'domcontentloaded', 
        timeout: 20000 
      });
      
      // Extract description
      await page.waitForSelector(selector.descriptionSelector, { timeout: 10000 });
      const description = await extractAndFormatDescription(page, selector.descriptionSelector);
      
      console.log(`[${jobNumber}] Next-page description extracted (${description.length} chars)`);
      
      // Navigate back to the original listing page
      try {
        await page.goto(originalUrl, { 
          waitUntil: 'domcontentloaded', 
          timeout: 15000 
        });
        await waitForJobSelector(page, selector.jobSelector);
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for page stability
        console.log(`[${jobNumber}] Successfully returned to listing page`);
      } catch (backNavError) {
        console.error(`[${jobNumber}] Failed to navigate back to listing: ${backNavError.message}`);
        // Still return the description even if navigation back fails
      }
      
      return description;
      
    } catch (error) {
      retries--;
      console.warn(`[${jobNumber}] Next-page attempt failed: ${error.message}${retries > 0 ? ' - Retrying...' : ''}`);
      
      if (retries > 0) {
        // Try to go back to original URL before retrying
        try {
          await page.goto(originalUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await waitForJobSelector(page, selector.jobSelector);
        } catch (retryNavError) {
          console.error(`Failed to navigate back for retry: ${retryNavError.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // If all retries failed, make sure we're back on the listing page
  try {
    await page.goto(originalUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForJobSelector(page, selector.jobSelector);
  } catch (finalNavError) {
    console.error(`[${jobNumber}] Failed final navigation back to listing: ${finalNavError.message}`);
  }
  
  return 'Next-page description extraction failed after retries';
}

/**
 * Optimized description text extraction and formatting
 * @param {Object} page - Puppeteer page instance
 * @param {string} descriptionSelector - CSS selector for description
 * @returns {string} Formatted job description
 */
async function extractAndFormatDescription(page, descriptionSelector) {
  return await page.evaluate((descSelector) => {
    const descElements = document.querySelectorAll(descSelector);
    
    if (descElements.length === 0) return 'No description found';
    
    // Keywords for relevant content
    const relevantKeywords = [
      'degree', 'qualification', 'experience', 'bachelor', 'master', 'phd',
      'education', 'requirement', 'skill', 'years', 'minimum', 'preferred',
      'required', 'essential', 'must', 'should', 'knowledge', 'ability',
      'responsibilities', 'duties', 'role', 'position', 'candidate'
    ];
    
    let allText = '';
    
    // Collect relevant text
    Array.from(descElements).forEach(element => {
      const text = element.textContent.trim().toLowerCase();
      const isRelevant = relevantKeywords.some(keyword => text.includes(keyword));
      
      if (isRelevant && text.length > 10) {
        allText += element.textContent.trim() + ' ';
      }
    });
    
    if (!allText) {
      // Fallback: get all text if no keywords found
      allText = Array.from(descElements)
        .map(el => el.textContent.trim())
        .join(' ');
    }
    
    // Enhanced formatting with proper indentation and dots
    if (allText.length > 50) {
      const sentences = allText
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 15)
        .slice(0, 8);
      
      return sentences
        .map(sentence => {
          // Clean up the sentence
          let cleanSentence = sentence.trim();
          
          // Capitalize first letter
          cleanSentence = cleanSentence.charAt(0).toUpperCase() + cleanSentence.slice(1);
          
          // Ensure it ends with a dot
          if (!cleanSentence.endsWith('.') && !cleanSentence.endsWith('!') && !cleanSentence.endsWith('?')) {
            cleanSentence += '.';
          }
          
          // Add bullet point and proper indentation
          return `• ${cleanSentence}`;
        })
        .join('\n');
    }
    
    // For shorter descriptions, still format with bullet and dot
    if (allText.trim()) {
      let cleanText = allText.trim();
      cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
      
      if (!cleanText.endsWith('.') && !cleanText.endsWith('!') && !cleanText.endsWith('?')) {
        cleanText += '.';
      }
      
      return `• ${cleanText}`;
    }
    
    return 'Description content not available';
  }, descriptionSelector);
}

/**
 * Extract descriptions in batch for multiple jobs (alternative approach)
 * @param {Object} page - Puppeteer page instance
 * @param {Array} jobs - Array of job objects with apply links
 * @param {Object} selector - Selector configuration
 * @returns {Array} Updated jobs array with descriptions
 */
async function extractDescriptionsInBatch(page, jobs, selector) {
  console.log(`Batch description extraction for ${jobs.length} jobs...`);
  
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    
    if (!job.applyLink || !selector.descriptionSelector) {
      job.description = 'Description not available';
      continue;
    }

    try {
      console.log(`[${i + 1}/${jobs.length}] Batch extracting: ${job.title.substring(0, 40)}...`);
      
      await page.goto(job.applyLink, { 
        waitUntil: 'domcontentloaded', 
        timeout: 15000 
      });
      
      await page.waitForSelector(selector.descriptionSelector, { timeout: 8000 });
      job.description = await extractAndFormatDescription(page, selector.descriptionSelector);
      
      console.log(`Batch description extracted (${job.description.length} characters)`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Batch extraction failed for "${job.title}": ${error.message}`);
      job.description = 'Batch description extraction failed';
    }
  }
  
  return jobs;
}

module.exports = {
  extractJobData,
  extractSingleJobData,
  extractDescriptionsInBatch
};