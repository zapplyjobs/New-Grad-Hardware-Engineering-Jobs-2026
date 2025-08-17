function filterUSJobs(jobs, options = {}) {
  const {
    includeRemote = true,          // Include remote/hybrid jobs
    includeTerritories = true,     // Include US territories
    strictMode = false,            // If true, requires exact state match
    requireStateMatch = true,      // Require a valid US state to be present
    includeMultiLocation = true,   // Include jobs with multiple US locations
    excludeGlobal = true,         // Exclude jobs marked as global/worldwide
    minConfidence = 0.7,          // Minimum confidence score for US detection
    locationFields = ['job_state', 'job_city', 'location', 'job_location', 'address', 'region'], // Fields to check for location
    debugMode = false,            // Enable debug logging
    excludeKeywords = ['global', 'worldwide', 'international', 'europe', 'asia', 'australia', 'africa'],  // Keywords to exclude
    requireUSMention = false      // Require explicit mention of US/USA/United States
  } = options;

  // US States - Full names and abbreviations
  const US_STATES = {
    // State abbreviations to full names
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
    'DC': 'District of Columbia'
  };

  // US Territories (if includeTerritories is true)
  const US_TERRITORIES = {
    'PR': 'Puerto Rico',
    'VI': 'U.S. Virgin Islands', 'USVI': 'U.S. Virgin Islands',
    'GU': 'Guam',
    'AS': 'American Samoa',
    'MP': 'Northern Mariana Islands', 'CNMI': 'Northern Mariana Islands'
  };

  // Combine states and territories
  const validLocations = includeTerritories ? 
    { ...US_STATES, ...US_TERRITORIES } : 
    { ...US_STATES };

  // Create arrays for different matching patterns
  const stateAbbreviations = Object.keys(validLocations);
  const stateFullNames = Object.values(validLocations);
  const allValidNames = [...stateAbbreviations, ...stateFullNames];

  // Remote work keywords
  const remoteKeywords = [
    'remote', 'work from home', 'wfh', 'home office', 'telecommute',
    'virtual', 'distributed', 'anywhere', 'flexible location',
    'hybrid', 'remote-first', 'remote friendly'
  ];

  // US indicators
  const usIndicators = [
    'united states', 'usa', 'us', 'america', 'american'
  ];

  /**
   * Check if a location string indicates a US-based position
   */
  function isUSLocation(locationString) {
    if (!locationString || typeof locationString !== 'string') {
      return false;
    }

    const location = locationString.toLowerCase().trim();
    
    // Skip empty locations
    if (!location) return false;

    // Check for remote work (if enabled)
    if (includeRemote && remoteKeywords.some(keyword => location.includes(keyword))) {
      return true;
    }

    // Check for explicit US indicators
    if (usIndicators.some(indicator => location.includes(indicator))) {
      return true;
    }

    // Check for state abbreviations (case-insensitive, word boundaries)
    for (const abbrev of stateAbbreviations) {
      const regex = new RegExp(`\\b${abbrev}\\b`, 'i');
      if (regex.test(location)) {
        return true;
      }
    }

    // Check for full state names (case-insensitive)
    for (const stateName of stateFullNames) {
      if (location.includes(stateName.toLowerCase())) {
        return true;
      }
    }

    // Check for common US city patterns (major cities)
    const majorUSCities = [
      'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
      'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
      'san francisco', 'columbus', 'charlotte', 'fort worth', 'indianapolis',
      'seattle', 'denver', 'boston', 'el paso', 'detroit', 'nashville',
      'portland', 'memphis', 'oklahoma city', 'las vegas', 'louisville',
      'baltimore', 'milwaukee', 'albuquerque', 'tucson', 'fresno', 'mesa',
      'sacramento', 'atlanta', 'kansas city', 'colorado springs', 'miami',
      'raleigh', 'omaha', 'long beach', 'virginia beach', 'oakland',
      'minneapolis', 'tulsa', 'arlington', 'tampa', 'new orleans',
      'wichita', 'cleveland', 'bakersfield', 'aurora', 'anaheim',
      'honolulu', 'santa ana', 'corpus christi', 'riverside', 'lexington',
      'stockton', 'toledo', 'st. paul', 'newark', 'anchorage'
    ];

    // Check for major US cities
    if (majorUSCities.some(city => location.includes(city))) {
      return true;
    }

    return false;
  }

  /**
   * Extract all location strings from a job object
   */
  function getLocationStrings(job) {
    const locations = [];
    
    locationFields.forEach(field => {
      if (job[field]) {
        locations.push(job[field]);
      }
    });

    // Also check common location field variations
    const additionalFields = ['location', 'job_location', 'city', 'state', 'country'];
    additionalFields.forEach(field => {
      if (job[field] && !locationFields.includes(field)) {
        locations.push(job[field]);
      }
    });

    return locations;
  }

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    try {
      const locationStrings = getLocationStrings(job);
      
      if (locationStrings.length === 0) {
        if (debugMode) {
          console.log(`❌ No location data found for job: ${job.job_title || 'Unknown'}`);
        }
        return false;
      }

      // Check if any location string indicates US-based position
      const isUS = locationStrings.some(locationString => isUSLocation(locationString));
      
      if (debugMode && isUS) {
        console.log(`✅ US job found: ${job.job_title || 'Unknown'} - ${locationStrings.join(', ')}`);
      } else if (debugMode && !isUS) {
        console.log(`❌ Non-US job filtered: ${job.job_title || 'Unknown'} - ${locationStrings.join(', ')}`);
      }
      
      return isUS;
      
    } catch (error) {
      if (debugMode) {
        console.error(`Error processing job: ${job.job_title || 'Unknown'}`, error);
      }
      return false;
    }
  });

  // Log summary
  console.log(`\n🇺🇸 US Job Filter Results:`);
  console.log(`   Total jobs processed: ${jobs.length}`);
  console.log(`   US-based jobs found: ${filteredJobs.length}`);
  console.log(`   Jobs filtered out: ${jobs.length - filteredJobs.length}`);
  
  if (debugMode) {
    // Show breakdown by state
    const stateBreakdown = {};
    filteredJobs.forEach(job => {
      const locationStrings = getLocationStrings(job);
      locationStrings.forEach(loc => {
        const location = loc.toLowerCase();
        stateAbbreviations.forEach(abbrev => {
          if (new RegExp(`\\b${abbrev}\\b`, 'i').test(location)) {
            stateBreakdown[abbrev] = (stateBreakdown[abbrev] || 0) + 1;
          }
        });
      });
    });
    
    console.log('\n📊 Jobs by State:');
    Object.entries(stateBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([state, count]) => {
        console.log(`   ${state}: ${count} jobs`);
      });
  }

  return filteredJobs;
}

/**
 * Enhanced parseLocation function with better US detection
 */
function parseLocationEnhanced(locationText) {
  if (!locationText) {
    return { city: '', state: '', country: '', isUS: false };
  }
  
  // Clean up the location text
  let cleanLocation = locationText
    .replace(/,?\s*United States$/i, '')
    .replace(/,?\s*USA$/i, '')
    .replace(/,?\s*US$/i, '')
    .trim();
  
  const isUSLocation = locationText.toLowerCase().includes('united states') ||
                      locationText.toLowerCase().includes('usa') ||
                      locationText.toLowerCase().match(/\bus\b/i);
  
  if (!cleanLocation) {
    return { city: '', state: '', country: isUSLocation ? 'United States' : '', isUS: isUSLocation };
  }
  
  // Split by comma and trim
  const parts = cleanLocation.split(',').map(part => part.trim());
  
  // US state abbreviations
  const stateAbbreviations = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ];
  
  if (parts.length >= 2) {
    // Format: "City, State" or "City, State, Country"
    const city = parts[0];
    const state = parts[1];
    const country = parts.length > 2 ? parts[2] : (isUSLocation ? 'United States' : '');
    
    return {
      city,
      state,
      country,
      isUS: isUSLocation || stateAbbreviations.includes(state.toUpperCase())
    };
  } else if (parts.length === 1) {
    const singlePart = parts[0];
    
    if (stateAbbreviations.includes(singlePart.toUpperCase())) {
      return { 
        city: '', 
        state: singlePart.toUpperCase(), 
        country: 'United States', 
        isUS: true 
      };
    } else {
      return { 
        city: singlePart, 
        state: '', 
        country: isUSLocation ? 'United States' : '', 
        isUS: isUSLocation 
      };
    }
  }
  
  return { city: '', state: '', country: '', isUS: isUSLocation };
}

// Example usage function
function testUSFilter() {
  // Sample job data for testing
  const sampleJobs = [
    {
      job_title: "Software Engineer",
      job_city: "San Francisco",
      job_state: "CA",
      location: "San Francisco, CA"
    },
    {
      job_title: "Data Scientist", 
      job_city: "New York",
      job_state: "NY",
      location: "New York, NY, United States"
    },
    {
      job_title: "Product Manager",
      job_city: "London",
      job_state: "England",
      location: "London, UK"
    },
    {
      job_title: "DevOps Engineer",
      job_city: "Remote",
      job_state: "US",
      location: "Remote, United States"
    },
    {
      job_title: "Backend Developer",
      job_city: "Toronto",
      job_state: "ON",
      location: "Toronto, Canada"
    },
    {
      job_title: "ML Engineer",
      job_city: "Austin",
      job_state: "Texas",
      location: "Austin, TX"
    }
  ];
  
  console.log("🧪 Testing US Job Filter:");
  console.log("Original jobs:", sampleJobs.length);
  
  const usJobs = filterUSJobs(sampleJobs, { debugMode: true });
  
  console.log("\n✅ US-based jobs found:");
  usJobs.forEach((job, index) => {
    console.log(`${index + 1}. ${job.job_title} - ${job.location}`);
  });
  
  return usJobs;
}

// Export functions
module.exports = {
  filterUSJobs,
  parseLocationEnhanced,
  testUSFilter
};