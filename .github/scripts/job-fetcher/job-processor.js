const fs = require('fs');
const path = require('path');
const { fetchAllRealJobs } = require('../real-career-scraper');
const { 
    companies, 
    ALL_COMPANIES, 
    COMPANY_BY_NAME, 
    normalizeCompanyName, 
    getCompanyEmoji, 
    getCompanyCareerUrl,
    formatTimeAgo,
    isJobOlderThanWeek,
    isUSOnlyJob,
    getExperienceLevel,
    getJobCategory,
    formatLocation,
    delay 
} = require('./utils');

// Configuration
const JSEARCH_API_KEY = process.env.JSEARCH_API_KEY || '315e3cea2bmshd51ab0ee7309328p18cecfjsna0f6b8e72f39';
const JSEARCH_BASE_URL = 'https://jsearch.p.rapidapi.com/search';

// Job search queries - much more comprehensive
const SEARCH_QUERIES = [
    // Core engineering roles
    'software engineer',
    'software developer', 
    'full stack developer',
    'frontend developer',
    'backend developer',
    'mobile developer',
    'ios developer',
    'android developer',
    
    // Specialized tech roles
    'machine learning engineer',
    'data scientist', 
    'data engineer',
    'devops engineer',
    'cloud engineer',
    'security engineer',
    'site reliability engineer',
    'platform engineer',
    
    // Product & Design
    'product manager',
    'product designer',
    'ux designer',
    'ui designer',
    
    // New grad specific
    'new grad software engineer',
    'entry level developer',
    'junior developer',
    'graduate software engineer',
    
    // High-value roles
    'staff engineer',
    'senior software engineer',
    'principal engineer',
    'engineering manager'
];

// Enhanced API search with better error handling
async function searchJobs(query, location = '') {
    try {
        const url = new URL(JSEARCH_BASE_URL);
        url.searchParams.append('query', query);
        if (location) url.searchParams.append('location', location);
        url.searchParams.append('page', '1');
        url.searchParams.append('num_pages', '1');
        url.searchParams.append('date_posted', 'month');
        url.searchParams.append('employment_types', 'FULLTIME');
        url.searchParams.append('job_requirements', 'under_3_years_experience,more_than_3_years_experience,no_experience');
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': JSEARCH_API_KEY,
                'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
            }
        });
        
        if (!response.ok) {
            console.error(`API request failed for "${query}": ${response.status}`);
            return [];
        }
        
        const data = await response.json();
        const jobs = data.data || [];
        console.log(`Query "${query}" returned ${jobs.length} jobs`);
        return jobs;
    } catch (error) {
        console.error(`Error searching for "${query}":`, error.message);
        return [];
    }
}

// Advanced job fetching with location targeting
async function fetchAllJobs() {
    console.log('🔍 Starting comprehensive job search...');
    
    const allJobs = [];
    const locations = ['San Francisco', 'New York', 'Seattle', 'Austin', 'Remote'];
    
    // Search core queries across multiple locations
    const coreQueries = [
        'software engineer',
        'frontend developer', 
        'backend developer',
        'data scientist',
        'machine learning engineer'
    ];
    
    for (const query of coreQueries) {
        // Search without location first
        const jobs = await searchJobs(query);
        allJobs.push(...jobs);
        await delay(1200); // Respect rate limits
        
        // Then search specific locations for higher-quality results
        for (const location of locations.slice(0, 2)) { // Limit to 2 locations to conserve API calls
            const locationJobs = await searchJobs(query, location);
            allJobs.push(...locationJobs);
            await delay(1200);
        }
    }
    
    // Search new grad specific terms
    const newGradQueries = ['new grad software engineer', 'entry level developer', 'graduate engineer'];
    for (const query of newGradQueries) {
        const jobs = await searchJobs(query);
        allJobs.push(...jobs);
        await delay(1200);
    }
    
    console.log(`📊 Total jobs fetched: ${allJobs.length}`);
    return allJobs;
}

// Enhanced filtering with better company matching
function filterTargetCompanyJobs(jobs) {
    console.log('🎯 Filtering for target companies...');
    
    const targetJobs = jobs.filter(job => {
        const companyName = (job.employer_name || '').toLowerCase();
        
        // Check against our comprehensive company list
        const isTargetCompany = COMPANY_BY_NAME[companyName] !== undefined;
        
        if (isTargetCompany) {
            // Normalize company name for consistency
            job.employer_name = normalizeCompanyName(job.employer_name);
            return true;
        }
        
        // Additional fuzzy matching for variations
        for (const company of ALL_COMPANIES) {
            for (const apiName of company.api_names) {
                if (companyName.includes(apiName.toLowerCase()) && apiName.length > 3) {
                    job.employer_name = company.name;
                    return true;
                }
            }
        }
        
        return false;
    });
    
    console.log(`✨ Filtered to ${targetJobs.length} target company jobs`);
    console.log('🏢 Companies found:', [...new Set(targetJobs.map(j => j.employer_name))]);
    
    // Remove duplicates more intelligently
    const uniqueJobs = targetJobs.filter((job, index, self) => {
        return index === self.findIndex(j => 
            j.job_title === job.job_title && 
            j.employer_name === job.employer_name &&
            j.job_city === job.job_city
        );
    });
    
    console.log(`🧹 After deduplication: ${uniqueJobs.length} unique jobs`);
    
    // Sort by company tier and recency
    uniqueJobs.sort((a, b) => {
        // Prioritize FAANG+ companies
        const aIsFAANG = companies.faang_plus.some(c => c.name === a.employer_name);
        const bIsFAANG = companies.faang_plus.some(c => c.name === b.employer_name);
        
        if (aIsFAANG && !bIsFAANG) return -1;
        if (!aIsFAANG && bIsFAANG) return 1;
        
        // Then by recency
        const aDate = new Date(a.job_posted_at_datetime_utc || 0);
        const bDate = new Date(b.job_posted_at_datetime_utc || 0);
        return bDate - aDate;
    });
    
    return uniqueJobs.slice(0, 50); // Top 50 jobs
}

// Generate company statistics with categories
function generateCompanyStats(jobs) {
    const stats = {
        byCategory: {},
        byLevel: { 'Entry-Level': 0, 'Mid-Level': 0, 'Senior': 0 },
        byLocation: {},
        totalByCompany: {}
    };
    
    jobs.forEach(job => {
        // Category stats
        const category = getJobCategory(job.job_title, job.job_description);
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
        
        // Level stats
        const level = getExperienceLevel(job.job_title, job.job_description);
        stats.byLevel[level]++;
        
        // Location stats
        const location = formatLocation(job.job_city, job.job_state);
        stats.byLocation[location] = (stats.byLocation[location] || 0) + 1;
        
        // Company stats
        stats.totalByCompany[job.employer_name] = (stats.totalByCompany[job.employer_name] || 0) + 1;
    });
    
    return stats;
}

// Write the new jobs JSON for Discord
function writeNewJobsJson(jobs) {
    const dataDir = path.join(process.cwd(), '.github', 'data');
    
    // Ensure data folder exists
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write the fresh jobs JSON
    const outPath = path.join(dataDir, 'new_jobs.json');
    fs.writeFileSync(outPath, JSON.stringify(jobs, null, 2), 'utf8');
    console.log(`✨ Wrote ${jobs.length} new jobs to ${outPath}`);
}

// Update seen jobs store
function updateSeenJobsStore(jobs, seenIds) {
    const dataDir = path.join(process.cwd(), '.github', 'data');
    
    // Mark them as seen
    jobs.forEach(job => seenIds.add(job.id));
    
    fs.writeFileSync(
        path.join(dataDir, 'seen_jobs.json'),
        JSON.stringify([...seenIds], null, 2),
        'utf8'
    );
}

// Load seen jobs for deduplication
function loadSeenJobsStore() {
    const dataDir = path.join(process.cwd(), '.github', 'data');
    const seenPath = path.join(dataDir, 'seen_jobs.json');
    
    return fs.existsSync(seenPath)
        ? new Set(JSON.parse(fs.readFileSync(seenPath, 'utf8')))
        : new Set();
}

// Main job processing function
async function processJobs() {
    console.log('🚀 Starting job processing...');
    
    try {
        // Load seen jobs for deduplication
        const seenIds = loadSeenJobsStore();
        
        // Fetch jobs from both API and real career pages
        const allJobs = await fetchAllRealJobs();
        const usJobs = allJobs.filter(isUSOnlyJob);
        const currentJobs = usJobs.filter(j => !isJobOlderThanWeek(j.job_posted_at_datetime_utc));
        
        // Add unique IDs for deduplication
        currentJobs.forEach(job => {
            job.id = `${job.employer_name}-${job.job_title}-${job.job_city}`.replace(/\s+/g, '-').toLowerCase();
        });
        
        // Filter for truly new jobs (not previously seen)
        const freshJobs = currentJobs.filter(job => !seenIds.has(job.id));
        
        if (freshJobs.length === 0) {
            console.log('ℹ️ No new jobs found - all current openings already processed');
        } else {
            console.log(`📬 Found ${freshJobs.length} new jobs to process`);
            // Write new jobs for Discord bot consumption
            writeNewJobsJson(freshJobs);
            // Update seen jobs store
            updateSeenJobsStore(freshJobs, seenIds);
        }
        
        // Calculate archived jobs
        const archivedJobs = usJobs.filter(j => isJobOlderThanWeek(j.job_posted_at_datetime_utc));
        
        console.log(`✅ Job processing complete - ${currentJobs.length} current, ${archivedJobs.length} archived`);
        
        return {
            currentJobs,
            archivedJobs,
            freshJobs,
            stats: generateCompanyStats(currentJobs)
        };
        
    } catch (error) {
        console.error('❌ Error in job processing:', error);
        throw error;
    }
}

module.exports = {
    searchJobs,
    fetchAllJobs,
    filterTargetCompanyJobs,
    generateCompanyStats,
    writeNewJobsJson,
    updateSeenJobsStore,
    loadSeenJobsStore,
    processJobs
};