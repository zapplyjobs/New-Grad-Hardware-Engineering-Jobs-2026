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

/**
 * Generate a standardized job ID for consistent deduplication across systems
 * This ensures the same job gets the same ID in both the scraper and Discord posting
 */
function generateJobId(job) {
    const title = (job.job_title || '').toLowerCase().trim().replace(/\s+/g, '-');
    const company = (job.employer_name || '').toLowerCase().trim().replace(/\s+/g, '-');
    const city = (job.job_city || '').toLowerCase().trim().replace(/\s+/g, '-');
    
    // Remove special characters and normalize
    const normalize = (str) => str
        .replace(/[^\w-]/g, '-')  // Replace special chars with dashes
        .replace(/-+/g, '-')     // Collapse multiple dashes
        .replace(/^-|-$/g, '');  // Remove leading/trailing dashes
    
    return `${normalize(company)}-${normalize(title)}-${normalize(city)}`;
}

/**
 * Convert old job ID format to new standardized format
 * This helps with migration from the old inconsistent ID system
 */
function migrateOldJobId(oldId) {
    // Old format was: company-title-city with inconsistent normalization
    // We can't perfectly reverse it, but we can normalize what we have
    const normalized = oldId
        .replace(/[^\w-]/g, '-')  // Replace special chars with dashes
        .replace(/-+/g, '-')     // Collapse multiple dashes
        .replace(/^-|-$/g, '');  // Remove leading/trailing dashes
    
    return normalized;
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


// Job level filtering function for entry to mid-level positions
function filterJobsByLevel(jobs) {
  console.log(`🔍 Starting job level filtering for ${jobs.length} jobs...`);
  
  // Enhanced keywords that indicate senior/advanced level positions (to EXCLUDE)
  const seniorKeywords = [
    // Traditional senior titles
      'senior', 'sr.', 'sr ', 'lead', 'principal', 'staff', 'architect', 
    'director', 'manager', 'head of', 'chief', 'vp', 'vice president',
    
    // Expert level indicators
    'expert', 'specialist', 'consultant', 'advanced', 'executive',
    'tech lead', 'technical lead', 'team lead', 'team leader',
    
    // Management and leadership
    'supervisor', 'coordinator', 'program manager', 'project manager',
    'engineering manager',
    
    // Additional senior keywords
    'senior director', 'executive director', 'group leader', 'division head', 
    'department head', 'fellow', 'guru', 'master', 'senior specialist', 
    'principal consultant', 'distinguished engineer', 'senior architect', 
    'lead architect', 'chief architect', 'senior scientist', 'strategy', 
    'strategic', 'portfolio manager', 'senior advisor', 'principal advisor', 
    'veteran', 'seasoned', 'senior consultant', 'lead consultant', 'senior lead'
  ];
  
  // Enhanced keywords that indicate entry/junior level positions (to INCLUDE)
  const juniorKeywords = [
    // Traditional junior titles
    'junior', 'jr.', 'jr ', 'entry', 'entry-level', 'entry level',
    
    // Graduate programs
    'graduate', 'new grad', 'new graduate', 'recent graduate', 
    'college graduate', 'university graduate', 'fresh graduate',
    
    // Training and development programs
    'intern', 'internship', 'trainee', 'apprentice', 'rotational',
    'graduate program', 'training program', 'development program',
    
    // Early career indicators
    'associate', 'fresh', 'beginner', 'starting', 'early career',
    
    // Level indicators
    'level 1', 'level i', 'grade 1', 'tier 1', '0-2 years'
  ];
  
  // Enhanced keywords that indicate mid-level positions (to INCLUDE)
  const midLevelKeywords = [
    // Standard mid-level titles
    'mid-level', 'mid level', 'intermediate', 'regular',
    
    // Common role titles (without senior/junior prefix)
    'developer', 'engineer', 'programmer', 'analyst', 
    
    // Level indicators
    'level 2', 'level ii', 'level 3', 'level iii', 'grade 2', 'tier 2'
  ];
  
  // Enhanced experience patterns to check in descriptions
  const experiencePatterns = [
    // Standard patterns
    /(\d+)\s*[-+to]\s*(\d+)?\s*years?\s*(?:of\s*)?(?:experience|exp|work)/gi,
    /(?:minimum|min|at least|require[ds]?|need|must have)\s*(\d+)\s*years?\s*(?:of\s*)?(?:experience|exp)/gi,
    /(\d+)\s*\+\s*years?\s*(?:of\s*)?(?:experience|exp)/gi,
    /(\d+)\s*or\s*more\s*years?\s*(?:of\s*)?(?:experience|exp)/gi,
    
    // Additional patterns
    /(?:with|having)\s*(\d+)\s*years?\s*(?:of\s*)?(?:experience|exp)/gi,
    /(\d+)\s*years?\s*(?:of\s*)?(?:professional|relevant|related)\s*(?:experience|exp)/gi,
    /(?:minimum|at least)\s*(\d+)\s*years?\s*in/gi,
    /(\d+)\s*years?\s*(?:background|history)/gi
  ];
  
  // Education requirements that are acceptable (bachelor's degree is fine)
  const acceptableEducation = [
    'bachelor', 'bachelors', "bachelor's", 'bs', 'b.s.', 'undergraduate',
    'college degree', 'university degree', 'degree preferred', 'degree or equivalent',
    'related field', 'computer science', 'engineering degree', 'technical degree'
  ];
  
  // Enhanced education requirements that are too advanced (to EXCLUDE)
  const advancedEducation = [
    'phd', 'ph.d.', 'doctorate', 'doctoral', 'postgraduate required'
  ];

  // Pattern to detect search query formatted descriptions
  function isSearchQueryDescription(description) {
    if (!description) return false;
    
    // Check for patterns like "software engineer job for the role developer"
    const searchQueryPattern = /\b\w+\s+job\s+for\s+the\s+role\s+\w+/i;
    const isSearchQuery = searchQueryPattern.test(description);
    
    if (isSearchQuery) {
      console.log(`   🔍 Detected search query format description - will ignore for experience filtering`);
    }
    
    return isSearchQuery;
  }

  function extractYearsFromDescription(description) {
    if (!description) return [];
    
    // Skip extraction if this is a search query formatted description
    if (isSearchQueryDescription(description)) {
      console.log(`   ⚠️  Skipping experience extraction from search query format description`);
      return [];
    }
    
    const years = [];
    const lowerDesc = description.toLowerCase();
    
    experiencePatterns.forEach(pattern => {
      const matches = [...lowerDesc.matchAll(pattern)];
      matches.forEach(match => {
        const minYears = parseInt(match[1]);
        if (!isNaN(minYears)) {
          years.push(minYears);
        }
        
        if (match[2] && !isNaN(parseInt(match[2]))) {
          years.push(parseInt(match[2]));
        }
      });
    });
    
    return years;
  }

  function checkTitleLevel(title) {
    if (!title) return { level: 'unknown', matchedKeyword: '' };
    
    const lowerTitle = title.toLowerCase();
    
    // Check for senior-level indicators (EXCLUDE)
    for (const keyword of seniorKeywords) {
      if (lowerTitle.includes(keyword.toLowerCase())) {
        return { level: 'senior', matchedKeyword: keyword };
      }
    }
    
    // Check for junior-level indicators (INCLUDE)
    for (const keyword of juniorKeywords) {
      if (lowerTitle.includes(keyword.toLowerCase())) {
        return { level: 'junior', matchedKeyword: keyword };
      }
    }
    
    // Check for mid-level indicators (INCLUDE)
    for (const keyword of midLevelKeywords) {
      if (lowerTitle.includes(keyword.toLowerCase())) {
        return { level: 'mid', matchedKeyword: keyword };
      }
    }
    
    return { level: 'unclear', matchedKeyword: '' };
  }

  function checkEducationRequirements(description) {
    if (!description) return { level: 'acceptable', matchedRequirement: '' };
    
    // Skip education check for search query formatted descriptions
    if (isSearchQueryDescription(description)) {
      console.log(`   📚 Skipping education requirement check for search query format description`);
      return { level: 'acceptable', matchedRequirement: 'search_query_format' };
    }
    
    const lowerDesc = description.toLowerCase();
    
    // Check for advanced degree requirements (EXCLUDE)
    for (const edu of advancedEducation) {
      if (lowerDesc.includes(edu.toLowerCase())) {
        // Exception: if it says "master's preferred" or "nice to have", it's still acceptable
        if (lowerDesc.includes('preferred') || lowerDesc.includes('nice to have') || 
            lowerDesc.includes('plus') || lowerDesc.includes('bonus') || 
            lowerDesc.includes('optional') || lowerDesc.includes('desired')) {
          continue;
        }
        return { level: 'too_advanced', matchedRequirement: edu };
      }
    }
    
    return { level: 'acceptable', matchedRequirement: '' };
  }

  // Filter jobs with enhanced categorization
  const filteredJobs = [];
  const removedJobs = [];
  
  jobs.forEach((job, index) => {
    let shouldInclude = true;
    let reason = '';
    let category = '';
    
    const titleAnalysis = checkTitleLevel(job.job_title);
    const yearsRequired = extractYearsFromDescription(job.job_description);
    const educationAnalysis = checkEducationRequirements(job.job_description);
    const isSearchQueryFormat = isSearchQueryDescription(job.job_description);
    
    // Enhanced categorization with detailed reasoning
    console.log(`\n🔍 Job ${index + 1}/${jobs.length}: "${job.job_title}" at ${job.employer_name}`);
    
    // Special handling for search query formatted descriptions
    if (isSearchQueryFormat) {
      console.log(`   🎯 Search Query Format Detected - Using title-only filtering`);
    }
    
    // Rule 1: Exclude senior-level titles
    if (titleAnalysis.level === 'senior') {
      shouldInclude = false;
      reason = `Senior-level title detected`;
      category = `EXCLUDED - Title contains "${titleAnalysis.matchedKeyword}"`;
      console.log(`   ❌ ${category}`);
    }
    
    // Rule 2: Include junior-level titles (even if description might seem advanced)
    else if (titleAnalysis.level === 'junior') {
      shouldInclude = true;
      reason = `Junior-level title confirmed`;
      category = `INCLUDED - Entry-level title contains "${titleAnalysis.matchedKeyword}"`;
      console.log(`   ✅ ${category}`);
    }
    
    // Rule 3: Check experience requirements for unclear/mid-level titles
    else {
      if (yearsRequired.length > 0) {
        const maxYears = Math.max(...yearsRequired);
        console.log(`   📊 Experience required: ${yearsRequired.join(', ')} years (max: ${maxYears})`);
        
        if (maxYears >= 5) {
          shouldInclude = false;
          reason = `Requires ${maxYears}+ years experience`;
          category = `EXCLUDED - Too much experience required (${maxYears}+ years)`;
          console.log(`   ❌ ${category}`);
        } else {
          category = `INCLUDED - Acceptable experience requirement (${maxYears} years)`;
          console.log(`   ✅ ${category}`);
        }
      } else {
        // Rule 3a: No experience requirements mentioned - INCLUDE by default
        shouldInclude = true;
        if (isSearchQueryFormat) {
          category = `INCLUDED - Search query format description (no filtering applied)`;
          reason = `Search query generated description - entry-level friendly`;
        } else if (titleAnalysis.level === 'mid') {
          category = `INCLUDED - Mid-level title "${titleAnalysis.matchedKeyword}", no experience requirements specified`;
          reason = `Mid-level role with no specific experience mentioned`;
        } else if (titleAnalysis.level === 'unclear') {
          category = `INCLUDED - No experience requirements or level indicators found (assuming entry-friendly)`;
          reason = `No experience barriers identified`;
        } else {
          category = `INCLUDED - No specific experience requirements mentioned`;
          reason = `Open to all experience levels`;
        }
        console.log(`   ✅ ${category}`);
        if (!isSearchQueryFormat) {
          console.log(`   💡 No years mentioned = Entry-level friendly position`);
        }
      }
    }
    
    // Rule 4: Check education requirements (skip for search query formats)
    if (shouldInclude && educationAnalysis.level === 'too_advanced') {
      shouldInclude = false;
      reason = `Requires advanced degree (${educationAnalysis.matchedRequirement})`;
      category = `EXCLUDED - Advanced degree required: ${educationAnalysis.matchedRequirement}`;
      console.log(`   ❌ Education: ${category}`);
    }
    
    // Rule 5: Special handling for Google-specific roles
    if (shouldInclude && job.employer_name && job.employer_name.toLowerCase().includes('google')) {
      if (titleAnalysis.level === 'senior' || yearsRequired.some(years => years >= 8)) {
        shouldInclude = false;
        reason = `Google senior role or 8+ years required`;
        category = `EXCLUDED - Google senior position or 8+ years experience`;
        console.log(`   ❌ Google Special Rule: ${category}`);
      } else {
        console.log(`   🔍 Google Role: Passed special screening`);
      }
    }
    
    // Final decision logging
    if (shouldInclude) {
      console.log(`   ✅ FINAL DECISION: INCLUDED`);
      filteredJobs.push(job);
    } else {
      console.log(`   ❌ FINAL DECISION: EXCLUDED - ${reason}`);
      removedJobs.push({ ...job, removal_reason: reason, category: category });
    }
  });
  
  // Enhanced logging summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎯 JOB LEVEL FILTERING SUMMARY`);
  console.log(`${'='.repeat(50)}`);
  console.log(`📊 Original jobs: ${jobs.length}`);
  console.log(`✅ Suitable jobs (entry/mid-level): ${filteredJobs.length} (${((filteredJobs.length/jobs.length)*100).toFixed(1)}%)`);
  console.log(`❌ Removed jobs (senior/advanced): ${removedJobs.length} (${((removedJobs.length/jobs.length)*100).toFixed(1)}%)`);
  
  // Count search query formatted descriptions
  const searchQueryJobs = jobs.filter(job => isSearchQueryDescription(job.job_description));
  if (searchQueryJobs.length > 0) {
    console.log(`🎯 Search query format jobs found: ${searchQueryJobs.length} (protected from description-based filtering)`);
  }
  
  // Enhanced removal reasons breakdown
  const removalReasons = {};
  removedJobs.forEach(job => {
    const reason = job.removal_reason;
    removalReasons[reason] = (removalReasons[reason] || 0) + 1;
  });
  
  console.log(`\n📈 REMOVAL REASONS BREAKDOWN:`);
  Object.entries(removalReasons).forEach(([reason, count]) => {
    const percentage = ((count / removedJobs.length) * 100).toFixed(1);
    console.log(`   • ${reason}: ${count} jobs (${percentage}%)`);
  });
  
  // Enhanced examples with detailed categorization
  console.log(`\n✅ EXAMPLES OF KEPT JOBS:`);
  filteredJobs.slice(0, 5).forEach((job, index) => {
    const titleAnalysis = checkTitleLevel(job.job_title);
    const yearsRequired = extractYearsFromDescription(job.job_description);
    const isSearchQuery = isSearchQueryDescription(job.job_description);
    console.log(`   ${index + 1}. "${job.job_title}" at ${job.employer_name}`);
    console.log(`      → Title Level: ${titleAnalysis.level} | Years Required: ${yearsRequired.length ? yearsRequired.join(', ') : 'none specified'} | Search Query Format: ${isSearchQuery ? 'Yes' : 'No'}`);
  });
  
  if (removedJobs.length > 0) {
    console.log(`\n❌ EXAMPLES OF REMOVED JOBS:`);
    removedJobs.slice(0, 5).forEach((job, index) => {
      console.log(`   ${index + 1}. "${job.job_title}" at ${job.employer_name}`);
      console.log(`      → Reason: ${job.removal_reason}`);
    });
  }
  
  console.log(`\n${'='.repeat(50)}`);
  
  return filteredJobs;
}

function isUSOnlyJob(job) {
    // Note: There's no job_country field, but country info sometimes appears in job_state
    const state = (job.job_state || '').toLowerCase().trim();
    const city = (job.job_city || '').toLowerCase().trim();
    
    // Normalize location string by removing extra spaces and punctuation
    const cleanCity = city.replace(/[,\s]+/g, ' ').trim();
    const cleanState = state.replace(/[,\s]+/g, ' ').trim();
    
    // Expanded list of non-US countries (including variations)
    const nonUSCountries = [
        'estonia', 'canada', 'uk', 'united kingdom', 'great britain', 'britain',
        'germany', 'deutschland', 'france', 'netherlands', 'holland',
        'sweden', 'norway', 'denmark', 'finland', 'australia', 'india', 'singapore',
        'japan', 'south korea', 'korea', 'brazil', 'mexico', 'spain', 'italy', 'poland',
        'ireland', 'israel', 'switzerland', 'austria', 'belgium', 'czech republic',
        'russia', 'china', 'ukraine', 'serbia', 'romania', 'bulgaria', 'hungary',
        'portugal', 'greece', 'turkey', 'croatia', 'slovakia', 'slovenia', 'lithuania',
        'latvia', 'luxembourg', 'malta', 'cyprus', 'iceland', 'new zealand', 'thailand',
        'vietnam', 'philippines', 'indonesia', 'malaysia', 'taiwan', 'hong kong'
    ];
    
    // Check if state field contains non-US countries (this is the main filter since country appears in state)
    if (nonUSCountries.some(nonUSCountry => cleanState.includes(nonUSCountry))) {
        return false;
    }
    
    // Expanded non-US cities (including variations and major cities)
    const nonUSCities = [
        'toronto', 'vancouver', 'montreal', 'ottawa', 'calgary', 'edmonton',
        'london', 'manchester', 'birmingham', 'glasgow', 'liverpool', 'bristol',
        'berlin', 'munich', 'hamburg', 'cologne', 'frankfurt',
        'amsterdam', 'rotterdam', 'the hague',
        'stockholm', 'gothenburg', 'malmo',
        'copenhagen', 'aarhus', 'odense',
        'helsinki', 'espoo', 'tampere',
        'oslo', 'bergen', 'trondheim',
        'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide',
        'bangalore', 'bengaluru', 'mumbai', 'bombay', 'delhi', 'new delhi',
        'hyderabad', 'pune', 'chennai', 'madras', 'kolkata', 'calcutta',
        'ahmedabad', 'jaipur', 'surat', 'lucknow', 'kanpur', 'nagpur',
        'singapore', 'tokyo', 'osaka', 'kyoto', 'yokohama', 'nagoya',
        'seoul', 'busan', 'incheon', 'daegu', 'daejeon',
        'tel aviv', 'jerusalem', 'haifa', 'beer sheva',
        'zurich', 'geneva', 'basel', 'bern',
        'dublin', 'cork', 'galway', 'limerick',
        'tallinn', 'tartu', 'riga', 'vilnius', 'kaunas',
        'prague', 'brno', 'ostrava', 'budapest', 'debrecen',
        'paris', 'marseille', 'lyon', 'toulouse', 'nice',
        'madrid', 'barcelona', 'valencia', 'seville', 'bilbao',
        'rome', 'milan', 'naples', 'turin', 'palermo',
        'warsaw', 'krakow', 'gdansk', 'wroclaw', 'poznan',
        'moscow', 'st petersburg', 'novosibirsk', 'yekaterinburg',
        'beijing', 'shanghai', 'guangzhou', 'shenzhen', 'chengdu',
        'kyiv', 'kiev', 'kharkiv', 'odesa', 'dnipro',
        'belgrade', 'novi sad', 'nis'
    ];
    
    // Check if city contains any non-US cities
    if (nonUSCities.some(nonUSCity => cleanCity.includes(nonUSCity))) {
        return false;
    }
    
    // Handle "Remote - [Country]" patterns
    if (cleanCity.includes('remote') && nonUSCountries.some(country => cleanCity.includes(country))) {
        return false;
    }
    
    if (cleanState.includes('remote') && nonUSCountries.some(country => cleanState.includes(country))) {
        return false;
    }
    
    // US country indicators in state field (since country info appears in state)
    const usCountryIndicators = [
        'us', 'usa', 'united states', 'united states of america', 'america'
    ];
    
    // If state contains US indicators
    if (usCountryIndicators.some(indicator => cleanState.includes(indicator))) {
        return true;
    }
    
    // US state codes and full names
    const usStates = [
        // State codes
        'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id', 'il', 'in', 'ia',
        'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj',
        'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt',
        'va', 'wa', 'wv', 'wi', 'wy', 'dc',
        // Full state names
        'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
        'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
        'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
        'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire',
        'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
        'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
        'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia',
        'wisconsin', 'wyoming', 'district of columbia'
    ];
    
    // Check if state matches US states
    if (usStates.some(usState => cleanState === usState || cleanState.includes(usState))) {
        return true;
    }
    
    // Major US cities (to catch cases where state might be missing or incorrect)
    const majorUSCities = [
        'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
        'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
        'fort worth', 'columbus', 'charlotte', 'san francisco', 'indianapolis',
        'seattle', 'denver', 'washington', 'boston', 'el paso', 'detroit', 'nashville',
        'portland', 'memphis', 'oklahoma city', 'las vegas', 'louisville', 'baltimore',
        'milwaukee', 'albuquerque', 'tucson', 'fresno', 'sacramento', 'kansas city',
        'mesa', 'atlanta', 'colorado springs', 'raleigh', 'omaha', 'miami', 'oakland',
        'tulsa', 'cleveland', 'wichita', 'arlington', 'new orleans', 'bakersfield',
        'tampa', 'honolulu', 'aurora', 'anaheim', 'santa ana', 'corpus christi',
        'riverside', 'lexington', 'stockton', 'toledo', 'saint paul', 'newark',
        'greensboro', 'plano', 'henderson', 'lincoln', 'buffalo', 'jersey city',
        'chula vista', 'fort wayne', 'orlando', 'st petersburg', 'chandler',
        'laredo', 'norfolk', 'durham', 'madison', 'lubbock', 'irvine', 'winston salem',
        'glendale', 'garland', 'hialeah', 'reno', 'chesapeake', 'gilbert', 'baton rouge',
        'irving', 'scottsdale', 'north las vegas', 'fremont', 'boise', 'richmond',
        'san bernardino', 'birmingham', 'spokane', 'rochester', 'des moines', 'modesto',
        'fayetteville', 'tacoma', 'oxnard', 'fontana', 'columbus', 'montgomery',
        'moreno valley', 'shreveport', 'aurora', 'yonkers', 'akron', 'huntington beach',
        'little rock', 'augusta', 'amarillo', 'glendale', 'mobile', 'grand rapids',
        'salt lake city', 'tallahassee', 'huntsville', 'grand prairie', 'knoxville',
        'worcester', 'newport news', 'brownsville', 'santa clarita', 'providence',
        'fort lauderdale', 'chattanooga', 'oceanside', 'jackson', 'garden grove',
        'rancho cucamonga', 'port st lucie', 'tempe', 'ontario', 'vancouver',
        'cape coral', 'sioux falls', 'springfield', 'peoria', 'pembroke pines',
        'elk grove', 'salem', 'lancaster', 'corona', 'eugene', 'palmdale', 'salinas',
        'springfield', 'pasadena', 'fort collins', 'hayward', 'pomona', 'cary',
        'rockford', 'alexandria', 'escondido', 'mckinney', 'kansas city', 'joliet',
        'sunnyvale', 'torrance', 'bridgeport', 'lakewood', 'hollywood', 'paterson',
        'naperville', 'syracuse', 'mesquite', 'dayton', 'savannah', 'clarksville',
        'orange', 'pasadena', 'fullerton', 'killeen', 'frisco', 'hampton',
        'mcallen', 'warren', 'bellevue', 'west valley city', 'columbia', 'olathe',
        'sterling heights', 'new haven', 'miramar', 'waco', 'thousand oaks',
        'cedar rapids', 'charleston', 'visalia', 'topeka', 'elizabeth', 'gainesville',
        'thornton', 'roseville', 'carrollton', 'coral springs', 'stamford', 'simi valley',
        'concord', 'hartford', 'kent', 'lafayette', 'midland', 'surprise', 'denton',
        'victorville', 'evansville', 'santa clara', 'abilene', 'athens', 'vallejo',
        'allentown', 'norman', 'beaumont', 'independence', 'murfreesboro', 'ann arbor',
        'fargo', 'wilmington', 'golden valley', 'pearland', 'richardson', 'broken arrow',
        'richmond', 'college station', 'league city', 'sugar land', 'lakeland',
        'duluth', 'woodbridge', 'charleston'
    ];
    
    // Check if city matches major US cities
    if (majorUSCities.some(usCity => cleanCity.includes(usCity))) {
        return true;
    }
    
    // Handle remote jobs - assume US remote unless specified otherwise
    if (cleanCity.includes('remote') && !cleanCity.includes('-') && !cleanState.includes('-')) {
        return true;
    }
    
    if (cleanState.includes('remote') && !cleanState.includes('-')) {
        return true;
    }
    
    // Handle "United States" variations in state field (main case since country info is in state)
    if (cleanState.includes('united states')) {
        return true;
    }
    
    // If both city and state are empty, can't determine - exclude for safety
    if (!cleanCity && !cleanState) {
        return false;
    }
    
    // Default to exclude if we can't determine (changed from include to be more selective)
    return false;
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

    if (text.includes('hardware')|| text.includes('Hardware') ) {
        return 'Hardware Engineering';
    }
    
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
  // Normalize inputs
  let normalizedCity = city ? city.trim() : '';
  let normalizedState = state ? state.trim() : '';

  // STEP 1: Handle remote
  if (normalizedCity.toLowerCase() === 'remote' || normalizedState.toLowerCase() === 'remote') {
    return 'Remote 🏠';
  }

  // STEP 2: Filter out generic/invalid state values
  const invalidStates = [
    'us', 'usa', 'u.s.', 'u.s.a', 'united states',
    'multiple locations', 'various locations', 'nationwide',
    'location not specified', 'tbd', 'tba', 'n/a'
  ];
  
  if (invalidStates.includes(normalizedState.toLowerCase())) {
    normalizedState = ''; // Clear invalid state
  }

  // STEP 3: Clean city - remove job-level keywords if they got through
  const cityCleanupKeywords = [
    'internship', 'intern', 'entry level', 'entrylevel', 'entry',
    'senior', 'junior', 'multiple cities', 'various'
  ];
  
  cityCleanupKeywords.forEach(keyword => {
    const regex = new RegExp(`^${keyword}\\s*`, 'gi');
    normalizedCity = normalizedCity.replace(regex, '').trim();
  });

  // STEP 4: If city contains "United States", remove it
  normalizedCity = normalizedCity
    .replace(/,?\s*United States$/i, '')
    .replace(/,?\s*USA$/i, '')
    .replace(/,?\s*U\.S\.A?$/i, '')
    .trim();

  // STEP 5: Handle state containing "United States"
  if (normalizedState.toLowerCase().includes('united states')) {
    // If state is "United States" or contains it, clear it unless there's specific info
    if (normalizedState.toLowerCase() === 'united states') {
      normalizedState = '';
    } else {
      // Extract actual state if format is like "California, United States"
      normalizedState = normalizedState
        .replace(/,?\s*United States$/i, '')
        .replace(/,?\s*USA$/i, '')
        .trim();
    }
  }

  // STEP 6: Handle patterns like "California - San Francisco"
  // This means state came first, so swap them
  if (normalizedCity.includes(' - ')) {
    const parts = normalizedCity.split(' - ').map(p => p.trim());
    if (parts.length === 2) {
      // First part is likely state, second is city
      normalizedState = normalizedState || parts[0];
      normalizedCity = parts[1];
    }
  }

  // STEP 7: Final validation - filter out if city or state are too short or invalid
  if (normalizedCity && normalizedCity.length < 2) {
    normalizedCity = '';
  }
  if (normalizedState && normalizedState.length < 2) {
    normalizedState = '';
  }

  // STEP 8: Check if city is actually just numbers or special characters
  if (normalizedCity && /^[\d\s,\-._]+$/.test(normalizedCity)) {
    normalizedCity = '';
  }

  // STEP 9: Return formatted location based on what we have
  // Both city and state
  if (normalizedCity && normalizedState) {
    return `${normalizedCity}, ${normalizedState}`;
  }
  
  // Only state
  if (!normalizedCity && normalizedState) {
    return normalizedState;
  }
  
  // Only city
  if (normalizedCity && !normalizedState) {
    return normalizedCity;
  }

  // Neither (should be filtered out in stats)
  return null; // Return null instead of a string so it can be filtered
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
            url: 'https://indeed.com/q-hardware-engineering-intern-jobs.html',
            type: 'Job Board',
            description: 'Comprehensive internship search engine'
        },
        {
            name: 'Glassdoor Internships',
            url: 'https://glassdoor.com/Job/gardware-engineer-intern-jobs-SRCH_KO0,23.htm',
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
    generateJobId,
    migrateOldJobId,
    normalizeCompanyName,
    getCompanyEmoji,
    getCompanyCareerUrl,
    formatTimeAgo,
    isJobOlderThanWeek,
    isUSOnlyJob,
    getExperienceLevel,
    getJobCategory,
    formatLocation,
    fetchInternshipData,
    filterJobsByLevel
};