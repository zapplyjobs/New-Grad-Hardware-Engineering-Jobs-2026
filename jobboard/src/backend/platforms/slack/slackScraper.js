const Puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

function parseSlackDate(dateString) {
    try {
        if (!dateString) return new Date().toISOString();
        
        // Handle relative dates
        const relativeMatch = dateString.match(/(\d+)\s+(day|hour|week|month)s?\s+ago/i);
        if (relativeMatch) {
            const value = parseInt(relativeMatch[1]);
            const unit = relativeMatch[2].toLowerCase();
            const now = new Date();
            
            switch (unit) {
                case 'hour':
                    now.setHours(now.getHours() - value);
                    break;
                case 'day':
                    now.setDate(now.getDate() - value);
                    break;
                case 'week':
                    now.setDate(now.getDate() - (value * 7));
                    break;
                case 'month':
                    now.setMonth(now.getMonth() - value);
                    break;
            }
            return now.toISOString();
        }
        
        // Try parsing as regular date
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date.toISOString();
        }
        
        return new Date().toISOString();
    } catch (error) {
        console.warn('Slack date parsing failed:', error);
        return new Date().toISOString();
    }
}

async function scrapeSlackJobs() {
    console.log('🔍 Starting Slack job scraping...');
    
    const browser = await Puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Navigate to Slack careers page (now part of Salesforce)
        await page.goto('https://salesforce.wd12.myworkdayjobs.com/Slack', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // Wait for job listings to load
        await page.waitForSelector('[data-automation-id="jobTitle"]', { timeout: 15000 });
        
        // Extract job data
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('[data-automation-id="jobTitle"]');
            const jobList = [];
            
            jobElements.forEach(jobElement => {
                try {
                    const titleLink = jobElement.querySelector('a');
                    if (titleLink) {
                        const title = titleLink.textContent.trim();
                        const link = titleLink.href;
                        
                        // Filter for engineering roles
                        if (title.toLowerCase().includes('engineer') || 
                            title.toLowerCase().includes('developer') ||
                            title.toLowerCase().includes('software')) {
                            
                            // Find location from parent container
                            const parentRow = jobElement.closest('[data-automation-id="compositeContainer"]');
                            const locationElement = parentRow ? parentRow.querySelector('[data-automation-id="locations"]') : null;
                            const location = locationElement ? locationElement.textContent.trim() : 'San Francisco, CA';
                            
                            const [city, state] = location.split(',').map(s => s.trim());
                            
                            jobList.push({
                                job_title: title,
                                employer_name: 'Slack',
                                job_city: city || 'San Francisco',
                                job_state: state || 'CA',
                                job_description: `Join Slack to make work life simpler, more pleasant, and more productive. ${title} position available in ${location}.`,
                                job_apply_link: link.startsWith('http') ? link : `https://salesforce.wd12.myworkdayjobs.com${link}`,
                                job_posted_at_datetime_utc: new Date().toISOString(),
                                job_employment_type: 'FULLTIME'
                            });
                        }
                    }
                } catch (error) {
                    console.warn('Error processing Slack job:', error);
                }
            });
            
            return jobList;
        });
        
        console.log(`✅ Found ${jobs.length} Slack engineering jobs`);
        
        // Save to JSON file
        const outputPath = path.join(__dirname, 'slackjobs.json');
        fs.writeFileSync(outputPath, JSON.stringify(jobs, null, 2));
        
        return jobs;
        
    } catch (error) {
        console.error('❌ Error scraping Slack jobs:', error);
        return [];
    } finally {
        await browser.close();
    }
}

module.exports = scrapeSlackJobs;