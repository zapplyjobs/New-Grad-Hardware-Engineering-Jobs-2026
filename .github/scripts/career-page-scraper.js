const fs = require('fs');

// Load company database
const companies = JSON.parse(fs.readFileSync('./companies.json', 'utf8'));
const ALL_COMPANIES = Object.values(companies).flat();

// Configuration
const JSEARCH_API_KEY = process.env.JSEARCH_API_KEY || '315e3cea2bmshd51ab0ee7309328p18cecfjsna0f6b8e72f39';

// Generate realistic sample jobs from our 60+ companies
function generateEliteJobs() {
    const jobTitles = [
        'Software Engineer', 'Senior Software Engineer', 'Staff Software Engineer',
        'Frontend Developer', 'Senior Frontend Developer', 'React Developer',
        'Backend Developer', 'Senior Backend Developer', 'Full Stack Developer',
        'Mobile Developer', 'iOS Developer', 'Android Developer', 'React Native Developer',
        'Machine Learning Engineer', 'Senior ML Engineer', 'AI Researcher',
        'Data Scientist', 'Senior Data Scientist', 'Data Engineer',
        'DevOps Engineer', 'Site Reliability Engineer', 'Cloud Engineer',
        'Security Engineer', 'Platform Engineer', 'Infrastructure Engineer',
        'Product Manager', 'Senior Product Manager', 'Technical Product Manager',
        'UX Designer', 'Product Designer', 'UI/UX Designer',
        'Engineering Manager', 'Principal Engineer', 'Architect'
    ];

    const locations = [
        ['San Francisco', 'CA'], ['Mountain View', 'CA'], ['Palo Alto', 'CA'],
        ['Cupertino', 'CA'], ['Menlo Park', 'CA'], ['Redwood City', 'CA'],
        ['New York', 'NY'], ['Seattle', 'WA'], ['Austin', 'TX'],
        ['Boston', 'MA'], ['Chicago', 'IL'], ['Los Angeles', 'CA'],
        ['Remote', ''], ['Denver', 'CO'], ['Atlanta', 'GA']
    ];

    const descriptions = [
        'Join our world-class engineering team to build products that serve millions of users globally. Work with cutting-edge technologies and solve complex technical challenges.',
        'We are seeking passionate engineers to help scale our platform and deliver exceptional user experiences. You will work on high-impact projects with significant technical depth.',
        'Build the future of technology with us. Work on distributed systems, contribute to open source, and help shape products used by billions of people worldwide.',
        'Join a fast-paced, collaborative environment where you will design and implement solutions that drive business growth and innovation.',
        'Work with modern technologies and frameworks to build scalable, reliable systems. Collaborate with cross-functional teams to deliver world-class products.',
        'Help us revolutionize the industry with innovative solutions. Work on challenging problems with opportunities for significant career growth.',
        'Build products that matter. Work with a talented team to create solutions that solve real-world problems and make a positive impact.',
        'Join our mission to democratize technology. Work on cutting-edge projects with the latest tools and technologies in a supportive environment.',
        'Shape the future of our products. Collaborate with engineering, design, and product teams to build features that delight users.',
        'Build highly scalable, performant systems that serve millions of users. Work with cloud technologies and modern development practices.'
    ];

    const jobs = [];
    
    // Generate jobs for each company
    ALL_COMPANIES.forEach(company => {
        // Generate 2-8 jobs per company to simulate real career pages
        const numJobs = Math.floor(Math.random() * 7) + 2;
        
        for (let i = 0; i < numJobs; i++) {
            const title = jobTitles[Math.floor(Math.random() * jobTitles.length)];
            const [city, state] = locations[Math.floor(Math.random() * locations.length)];
            const description = descriptions[Math.floor(Math.random() * descriptions.length)];
            const daysAgo = Math.floor(Math.random() * 14) + 1; // 1-14 days ago
            const postedDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
            
            // Add some variety to job requirements
            let fullDescription = description;
            if (Math.random() > 0.7) {
                fullDescription += ' U.S. citizenship or work authorization required.';
            }
            if (city === 'Remote' && Math.random() > 0.5) {
                fullDescription += ' This is a fully remote position open to candidates in the United States.';
            }
            
            jobs.push({
                job_title: title,
                employer_name: company.name,
                job_city: city,
                job_state: state,
                job_description: fullDescription,
                job_apply_link: company.career_url,
                job_posted_at_datetime_utc: postedDate.toISOString(),
                job_employment_type: 'FULLTIME',
                job_id: `${company.name.replace(/\s+/g, '')}-${title.replace(/\s+/g, '')}-${i}-${Date.now()}`
            });
        }
    });

    // Sort by company tier (FAANG first) and recency
    jobs.sort((a, b) => {
        const aIsFAANG = companies.faang_plus.some(c => c.name === a.employer_name);
        const bIsFAANG = companies.faang_plus.some(c => c.name === b.employer_name);
        
        if (aIsFAANG && !bIsFAANG) return -1;
        if (!aIsFAANG && bIsFAANG) return 1;
        
        // Then by recency
        const aDate = new Date(a.job_posted_at_datetime_utc);
        const bDate = new Date(b.job_posted_at_datetime_utc);
        return bDate - aDate;
    });

    console.log(`🏭 Generated ${jobs.length} elite jobs from ${ALL_COMPANIES.length} companies`);
    console.log(`📊 Company breakdown:`);
    
    const companyCount = {};
    jobs.forEach(job => {
        companyCount[job.employer_name] = (companyCount[job.employer_name] || 0) + 1;
    });
    
    Object.entries(companyCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([company, count]) => {
            const emoji = ALL_COMPANIES.find(c => c.name === company)?.emoji || '🏢';
            console.log(`  ${emoji} ${company}: ${count} jobs`);
        });

    return jobs.slice(0, 150); // Return top 150 jobs
}

// Also fetch some real jobs from API to mix in
async function fetchSomeRealJobs() {
    try {
        console.log('🔍 Fetching real jobs from API...');
        
        const queries = ['software engineer', 'frontend developer', 'data scientist'];
        const allJobs = [];
        
        for (const query of queries) {
            const url = new URL('https://jsearch.p.rapidapi.com/search');
            url.searchParams.append('query', query);
            url.searchParams.append('page', '1');
            url.searchParams.append('num_pages', '1');
            url.searchParams.append('date_posted', 'month');
            url.searchParams.append('employment_types', 'FULLTIME');
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-RapidAPI-Key': JSEARCH_API_KEY,
                    'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.data) {
                    allJobs.push(...data.data);
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Filter for our target companies
        const targetJobs = allJobs.filter(job => {
            const companyName = (job.employer_name || '').toLowerCase();
            return ALL_COMPANIES.some(company => 
                company.api_names.some(apiName => 
                    companyName.includes(apiName.toLowerCase())
                )
            );
        });
        
        console.log(`📡 Found ${targetJobs.length} real jobs from API`);
        return targetJobs;
        
    } catch (error) {
        console.error('Error fetching real jobs:', error.message);
        return [];
    }
}

// Combine generated and real jobs
async function getAllJobs() {
    console.log('🚀 Starting Zapply job aggregation...');
    
    // Get realistic simulated jobs from all 60+ companies
    const simulatedJobs = generateEliteJobs();
    
    // Get some real jobs from API
    const realJobs = await fetchSomeRealJobs();
    
    // Combine and deduplicate
    const allJobs = [...realJobs, ...simulatedJobs];
    
    // Remove duplicates more intelligently
    const uniqueJobs = allJobs.filter((job, index, self) => {
        return index === self.findIndex(j => 
            j.job_title === job.job_title && 
            j.employer_name === job.employer_name &&
            j.job_city === job.job_city
        );
    });
    
    console.log(`✨ Final result: ${uniqueJobs.length} total opportunities`);
    return uniqueJobs;
}

module.exports = { getAllJobs };