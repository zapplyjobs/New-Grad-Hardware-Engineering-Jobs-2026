const Puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

function parseUberDate(dateString) {
    try {
        if (!dateString) return new Date().toISOString();
        
        // Handle relative dates (e.g., "2 days ago", "1 week ago")
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
        
        // Fallback to current date
        return new Date().toISOString();
    } catch (error) {
        console.warn('Uber date parsing failed:', error);
        return new Date().toISOString();
    }
}

async function scrapeUberJobs() {
    console.log('🔍 Starting Uber job scraping...');
    
    const browser = await Puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Navigate to Uber careers page
        await page.goto('https://www.uber.com/us/en/careers/list/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // Wait for job listings to load
        await page.waitForSelector('[data-testid="job-card"]', { timeout: 15000 });
        
        // Extract job data
        const jobs = await page.evaluate(() => {
            const jobCards = document.querySelectorAll('[data-testid="job-card"]');
            const jobList = [];
            
            jobCards.forEach(card => {
                try {
                    const titleElement = card.querySelector('h3, [data-testid="job-title"]');
                    const locationElement = card.querySelector('[data-testid="job-location"], .location');
                    const linkElement = card.querySelector('a');
                    
                    if (titleElement && linkElement) {
                        const title = titleElement.textContent.trim();
                        const location = locationElement ? locationElement.textContent.trim() : 'San Francisco, CA';
                        const link = linkElement.href;
                        
                        // Filter for engineering roles
                        if (title.toLowerCase().includes('engineer') || 
                            title.toLowerCase().includes('developer') ||
                            title.toLowerCase().includes('software')) {
                            
                            const [city, state] = location.split(',').map(s => s.trim());
                            
                            jobList.push({
                                job_title: title,
                                employer_name: 'Uber',
                                job_city: city || 'San Francisco',
                                job_state: state || 'CA',
                                job_description: `Join Uber to move the world. ${title} position available in ${location}.`,
                                job_apply_link: link.startsWith('http') ? link : `https://www.uber.com${link}`,
                                job_posted_at_datetime_utc: new Date().toISOString(),
                                job_employment_type: 'FULLTIME'
                            });
                        }
                    }
                } catch (error) {
                    console.warn('Error processing Uber job card:', error);
                }
            });
            
            return jobList;
        });
        
        console.log(`✅ Found ${jobs.length} Uber engineering jobs`);
        
        // Save to JSON file
        const outputPath = path.join(__dirname, 'uberjobs.json');
        fs.writeFileSync(outputPath, JSON.stringify(jobs, null, 2));
        
        return jobs;
        
    } catch (error) {
        console.error('❌ Error scraping Uber jobs:', error);
        return [];
    } finally {
        await browser.close();
    }
}

module.exports = scrapeUberJobs;