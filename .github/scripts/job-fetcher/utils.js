const fs = require('fs');
const path = require('path');

// Load company database
const companies = JSON.parse(fs.readFileSync(path.join(__dirname, 'companies.json'), 'utf8'));

// Flatten all companies for easy access
const ALL_COMPANIES = Object.values(companies).flat();
const COMPANY_BY_NAME = {};
ALL_COMPANIES.forEach(company => {
    COMPANY_BY_NAME[company.name.toLowerCase()] = company;
    company.api_names.forEach(name => {
        COMPANY_BY_NAME[name.toLowerCase()] = company;
    });
});

/**
 * Utility functions for job processing
 */

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeCompanyName(companyName) {
    const company = COMPANY_BY_NAME[companyName.toLowerCase()];
    return company ? company.name : companyName;
}

function getCompanyEmoji(companyName) {
    const company = COMPANY_BY_NAME[companyName.toLowerCase()];
    return company ? company.emoji : '🏢';
}

function getCompanyCareerUrl(companyName) {
    const company = COMPANY_BY_NAME[companyName.toLowerCase()];
    return company ? company.career_url : '#';
}

function formatTimeAgo(dateString) {
    if (!dateString) return 'Recently';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
        return `${diffInHours}h ago`;
    } else {
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays === 1) return '1d ago';
        if (diffInDays < 7) return `${diffInDays}d ago`;
        if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
        return `${Math.floor(diffInDays / 30)}mo ago`;
    }
}

function isJobOlderThanWeek(dateString) {
    if (!dateString) return false;
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    return diffInDays >= 7;
}

function isUSOnlyJob(job) {
    const country = (job.job_country || '').toLowerCase().trim();
    const state = (job.job_state || '').toLowerCase().trim();
    const city = (job.job_city || '').toLowerCase().trim();
    
    // Exclude jobs explicitly in non-US countries
    const nonUSCountries = [
        'estonia', 'canada', 'uk', 'united kingdom', 'germany', 'france', 'netherlands', 
        'sweden', 'norway', 'denmark', 'finland', 'australia', 'india', 'singapore',
        'japan', 'south korea', 'brazil', 'mexico', 'spain', 'italy', 'poland',
        'ireland', 'israel', 'switzerland', 'austria', 'belgium', 'czech republic'
    ];
    
    // If country is explicitly non-US, exclude
    if (nonUSCountries.includes(country)) {
        return false;
    }
    
    // Exclude jobs with non-US cities/locations
    const nonUSCities = [
        'toronto', 'vancouver', 'montreal', 'london', 'berlin', 'amsterdam', 'stockholm',
        'copenhagen', 'helsinki', 'oslo', 'sydney', 'melbourne', 'bangalore', 'mumbai',
        'delhi', 'hyderabad', 'pune', 'singapore', 'tokyo', 'seoul', 'tel aviv',
        'zurich', 'geneva', 'dublin', 'tallinn', 'riga', 'vilnius', 'prague', 'budapest'
    ];
    
    if (nonUSCities.includes(city)) {
        return false;
    }
    
    // Include if country is US/USA/United States or empty (assume US)
    if (country === 'us' || country === 'usa' || country === 'united states' || country === '') {
        return true;
    }
    
    // Include if it has US state codes
    const usStates = [
        'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id', 'il', 'in', 'ia', 
        'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 
        'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 
        'va', 'wa', 'wv', 'wi', 'wy', 'dc'
    ];
    
    if (usStates.includes(state)) {
        return true;
    }
    
    // Include remote jobs (assume US remote unless stated otherwise)
    if (city.includes('remote') || state.includes('remote')) {
        return true;
    }
    
    // Default to include (better to include than exclude)
    return true;
}

function getExperienceLevel(title, description = '') {
    const text = `${title} ${description}`.toLowerCase();
    
    // Senior level indicators
    if (text.includes('senior') || text.includes('sr.') || text.includes('lead') || 
        text.includes('principal') || text.includes('staff') || text.includes('architect')) {
        return 'Senior';
    }
    
    // Entry level indicators  
    if (text.includes('entry') || text.includes('junior') || text.includes('jr.') || 
        text.includes('new grad') || text.includes('graduate') || text.includes('university grad') ||
        text.includes('college grad') || text.includes(' grad ') || text.includes('recent grad') ||
        text.includes('intern') || text.includes('associate') || text.includes('level 1') || 
        text.includes('l1') || text.includes('campus') || text.includes('student') ||
        text.includes('early career') || text.includes('0-2 years')) {
        return 'Entry-Level';
    }
    
    return 'Mid-Level';
}

function getJobCategory(title, description = '') {
    const text = `${title} ${description}`.toLowerCase();
    
    if (text.includes('ios') || text.includes('android') || text.includes('mobile') || text.includes('react native')) {
        return 'Mobile Development';
    }
    if (text.includes('frontend') || text.includes('front-end') || text.includes('react') || text.includes('vue') || text.includes('ui')) {
        return 'Frontend Development'; 
    }
    if (text.includes('backend') || text.includes('back-end') || text.includes('api') || text.includes('server')) {
        return 'Backend Development';
    }
    if (text.includes('machine learning') || text.includes('ml ') || text.includes('ai ') || text.includes('artificial intelligence') || text.includes('deep learning')) {
        return 'Machine Learning & AI';
    }
    if (text.includes('data scientist') || text.includes('data analyst') || text.includes('analytics') || text.includes('data engineer')) {
        return 'Data Science & Analytics';
    }
    if (text.includes('devops') || text.includes('infrastructure') || text.includes('cloud') || text.includes('platform')) {
        return 'DevOps & Infrastructure';
    }
    if (text.includes('security') || text.includes('cybersecurity') || text.includes('infosec')) {
        return 'Security Engineering';
    }
    if (text.includes('product manager') || text.includes('product owner') || text.includes('pm ')) {
        return 'Product Management';
    }
    if (text.includes('design') || text.includes('ux') || text.includes('ui')) {
        return 'Design';
    }
    if (text.includes('full stack') || text.includes('fullstack')) {
        return 'Full Stack Development';
    }
    
    return 'Software Engineering';
}

function formatLocation(city, state) {
    if (!city && !state) return 'Remote';
    if (!city) return state;
    if (!state) return city;
    if (city.toLowerCase() === 'remote') return 'Remote 🏠';
    return `${city}, ${state}`;
}

// Fetch internship data from popular sources
async function fetchInternshipData() {
    console.log('🎓 Fetching 2025/2026 internship opportunities...');
    
    const internships = [];
    
    // Popular internship tracking repositories and sources
    const internshipSources = [
        {
            name: 'AngelList Internships',
            url: 'https://angel.co/jobs#internships',
            type: 'Job Board',
            description: 'Startup internships and entry-level positions'
        },
        {
            name: 'LinkedIn Student Jobs',
            url: 'https://linkedin.com/jobs/student-jobs',
            type: 'Platform',
            description: 'Professional network for student opportunities'
        },
        {
            name: 'Indeed Internships',
            url: 'https://indeed.com/q-software-engineering-intern-jobs.html',
            type: 'Job Board',
            description: 'Comprehensive internship search engine'
        },
        {
            name: 'Glassdoor Internships',
            url: 'https://glassdoor.com/Job/software-engineer-intern-jobs-SRCH_KO0,23.htm',
            type: 'Job Board',
            description: 'Internships with company reviews and salary data'
        },
        {
            name: 'University Career Centers',
            url: 'https://nace.org',
            type: 'Resource',
            description: 'National Association of Colleges and Employers'
        }
    ];
    
    // Add company-specific internship programs
    const companyInternshipPrograms = [
        { company: 'Google', program: 'STEP Internship', url: 'https://careers.google.com/students/', deadline: 'Various' },
        { company: 'Microsoft', program: 'Software Engineering Internship', url: 'https://careers.microsoft.com/students', deadline: 'Various' },
        { company: 'Meta', program: 'Software Engineer Internship', url: 'https://careers.meta.com/students', deadline: 'Various' },
        { company: 'Amazon', program: 'SDE Internship', url: 'https://amazon.jobs/internships', deadline: 'Various' },
        { company: 'Apple', program: 'Software Engineering Internship', url: 'https://jobs.apple.com/students', deadline: 'Various' },
        { company: 'Netflix', program: 'Software Engineering Internship', url: 'https://jobs.netflix.com/students', deadline: 'Various' },
        { company: 'Tesla', program: 'Software Engineering Internship', url: 'https://careers.tesla.com/internships', deadline: 'Various' },
        { company: 'Nvidia', program: 'Software Engineering Internship', url: 'https://careers.nvidia.com/internships', deadline: 'Various' },
        { company: 'Stripe', program: 'Software Engineering Internship', url: 'https://stripe.com/jobs/internships', deadline: 'Various' },
        { company: 'Coinbase', program: 'Software Engineering Internship', url: 'https://coinbase.com/careers/students', deadline: 'Various' }
    ];
    
    return {
        sources: internshipSources,
        companyPrograms: companyInternshipPrograms,
        lastUpdated: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })
    };
}

module.exports = {
    companies,
    ALL_COMPANIES,
    COMPANY_BY_NAME,
    delay,
    normalizeCompanyName,
    getCompanyEmoji,
    getCompanyCareerUrl,
    formatTimeAgo,
    isJobOlderThanWeek,
    isUSOnlyJob,
    getExperienceLevel,
    getJobCategory,
    formatLocation,
    fetchInternshipData
};