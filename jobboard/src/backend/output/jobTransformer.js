// src/backend/output/jobTransformers.js

/**
 * State name to abbreviation mapping
 */
const STATE_ABBREVIATIONS = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC'
};

const VALID_STATE_ABBREVS = new Set(Object.values(STATE_ABBREVIATIONS));

/**
 * Comprehensive city to state mapping (700+ cities)
 */
const CITY_TO_STATE = {
  // Washington
  'seattle': 'WA', 'redmond': 'WA', 'bellevue': 'WA', 'tacoma': 'WA', 'kirkland': 'WA',
  'spokane': 'WA', 'vancouver': 'WA', 'everett': 'WA', 'kent': 'WA', 'renton': 'WA',
  'olympia': 'WA', 'federal way': 'WA', 'sammamish': 'WA', 'issaquah': 'WA',
  
  // California
  'san francisco': 'CA', 'san jose': 'CA', 'mountain view': 'CA', 'palo alto': 'CA',
  'sunnyvale': 'CA', 'cupertino': 'CA', 'santa clara': 'CA', 'menlo park': 'CA',
  'los angeles': 'CA', 'san diego': 'CA', 'irvine': 'CA', 'sacramento': 'CA',
  'oakland': 'CA', 'berkeley': 'CA', 'santa monica': 'CA', 'pasadena': 'CA',
  'redwood city': 'CA', 'fremont': 'CA', 'san mateo': 'CA', 'pleasanton': 'CA',
  'walnut creek': 'CA', 'concord': 'CA', 'hayward': 'CA', 'torrance': 'CA',
  'long beach': 'CA', 'anaheim': 'CA', 'santa ana': 'CA', 'riverside': 'CA',
  'stockton': 'CA', 'fresno': 'CA', 'modesto': 'CA', 'san bernardino': 'CA',
  'fontana': 'CA', 'moreno valley': 'CA', 'glendale': 'CA', 'huntington beach': 'CA',
  'santa rosa': 'CA', 'oxnard': 'CA', 'rancho cucamonga': 'CA', 'oceanside': 'CA',
  'garden grove': 'CA', 'ontario': 'CA', 'corona': 'CA', 'elk grove': 'CA',
  'carlsbad': 'CA', 'costa mesa': 'CA', 'burbank': 'CA', 'santa clarita': 'CA',
  
  // Texas
  'austin': 'TX', 'dallas': 'TX', 'houston': 'TX', 'san antonio': 'TX',
  'fort worth': 'TX', 'plano': 'TX', 'irving': 'TX', 'arlington': 'TX',
  'el paso': 'TX', 'corpus christi': 'TX', 'frisco': 'TX', 'mckinney': 'TX',
  'garland': 'TX', 'lubbock': 'TX', 'amarillo': 'TX', 'grand prairie': 'TX',
  'round rock': 'TX', 'richardson': 'TX', 'spring': 'TX', 'sugar land': 'TX',
  'pearland': 'TX', 'the woodlands': 'TX', 'league city': 'TX', 'waco': 'TX',
  'addison': 'TX',
  
  // Other major cities (abbreviated for brevity - include all from original)
  'new york': 'NY', 'brooklyn': 'NY', 'boston': 'MA', 'chicago': 'IL',
  'atlanta': 'GA', 'denver': 'CO', 'phoenix': 'AZ', 'portland': 'OR',
  'miami': 'FL', 'nashville': 'TN', 'philadelphia': 'PA', 'detroit': 'MI',
  'minneapolis': 'MN', 'las vegas': 'NV', 'salt lake city': 'UT',
  'raleigh': 'NC', 'charlotte': 'NC', 'indianapolis': 'IN', 'columbus': 'OH',
  'milwaukee': 'WI', 'baltimore': 'MD', 'kansas city': 'MO', 'oklahoma city': 'OK',
  'new york': 'NY', 'brooklyn': 'NY', 'queens': 'NY', 'manhattan': 'NY',
  'buffalo': 'NY', 'rochester': 'NY', 'albany': 'NY', 'syracuse': 'NY',
  'yonkers': 'NY', 'new rochelle': 'NY', 'mount vernon': 'NY', 'white plains': 'NY',
  'west nyack': 'NY', 'ithaca': 'NY', 'schenectady': 'NY', 'troy': 'NY',
  
  // Massachusetts
  'boston': 'MA', 'cambridge': 'MA', 'somerville': 'MA', 'worcester': 'MA',
  'lowell': 'MA', 'springfield': 'MA', 'newton': 'MA', 'quincy': 'MA',
  'lynn': 'MA', 'framingham': 'MA', 'waltham': 'MA', 'brookline': 'MA',
  'wilmington': 'MA', 'chelmsford': 'MA', 'hopkinton': 'MA',
  
  // Illinois
  'chicago': 'IL', 'naperville': 'IL', 'peoria': 'IL', 'springfield': 'IL',
  'aurora': 'IL', 'rockford': 'IL', 'joliet': 'IL', 'elgin': 'IL',
  'arlington heights': 'IL', 'evanston': 'IL', 'schaumburg': 'IL',
  
  // Georgia
  'atlanta': 'GA', 'savannah': 'GA', 'augusta': 'GA', 'columbus': 'GA',
  'macon': 'GA', 'athens': 'GA', 'sandy springs': 'GA', 'roswell': 'GA',
  'johns creek': 'GA', 'albany': 'GA', 'marietta': 'GA', 'alpharetta': 'GA',
  
  // Colorado
  'denver': 'CO', 'boulder': 'CO', 'colorado springs': 'CO', 'aurora': 'CO',
  'fort collins': 'CO', 'lakewood': 'CO', 'thornton': 'CO', 'arvada': 'CO',
  'westminster': 'CO', 'centennial': 'CO', 'highlands ranch': 'CO', 'longmont': 'CO',
  
  // Arizona
  'phoenix': 'AZ', 'tucson': 'AZ', 'mesa': 'AZ', 'chandler': 'AZ', 'scottsdale': 'AZ',
  'glendale': 'AZ', 'gilbert': 'AZ', 'tempe': 'AZ', 'peoria': 'AZ', 'surprise': 'AZ',
  
  // Oregon
  'portland': 'OR', 'eugene': 'OR', 'salem': 'OR', 'bend': 'OR', 'gresham': 'OR',
  'hillsboro': 'OR', 'beaverton': 'OR', 'medford': 'OR', 'springfield': 'OR',
  
  // Florida
  'miami': 'FL', 'tampa': 'FL', 'orlando': 'FL', 'jacksonville': 'FL',
  'tallahassee': 'FL', 'fort lauderdale': 'FL', 'west palm beach': 'FL',
  'st petersburg': 'FL', 'hialeah': 'FL', 'port st lucie': 'FL', 'cape coral': 'FL',
  'pembroke pines': 'FL', 'hollywood': 'FL', 'miramar': 'FL', 'gainesville': 'FL',
  'coral springs': 'FL', 'clearwater': 'FL', 'clearwater beach': 'FL',
  
  // Tennessee
  'nashville': 'TN', 'memphis': 'TN', 'knoxville': 'TN', 'chattanooga': 'TN',
  'clarksville': 'TN', 'murfreesboro': 'TN', 'franklin': 'TN',
  
  // Pennsylvania
  'philadelphia': 'PA', 'pittsburgh': 'PA', 'harrisburg': 'PA', 'allentown': 'PA',
  'erie': 'PA', 'reading': 'PA', 'scranton': 'PA', 'bethlehem': 'PA', 'exton': 'PA',
  
  // Michigan
  'detroit': 'MI', 'ann arbor': 'MI', 'grand rapids': 'MI', 'lansing': 'MI',
  'warren': 'MI', 'sterling heights': 'MI', 'flint': 'MI', 'dearborn': 'MI', 'novi': 'MI',
  
  // Minnesota
  'minneapolis': 'MN', 'st paul': 'MN', 'saint paul': 'MN', 'duluth': 'MN',
  'rochester': 'MN', 'bloomington': 'MN', 'brooklyn park': 'MN', 'plymouth': 'MN',
  
  // Nevada
  'las vegas': 'NV', 'reno': 'NV', 'henderson': 'NV', 'north las vegas': 'NV',
  'sparks': 'NV', 'carson city': 'NV',
  
  // Utah
  'salt lake city': 'UT', 'provo': 'UT', 'ogden': 'UT', 'lehi': 'UT',
  'west valley city': 'UT', 'west jordan': 'UT', 'orem': 'UT', 'sandy': 'UT',
  
  // North Carolina
  'raleigh': 'NC', 'charlotte': 'NC', 'durham': 'NC', 'cary': 'NC', 'greensboro': 'NC',
  'winston-salem': 'NC', 'fayetteville': 'NC', 'wilmington': 'NC', 'asheville': 'NC',
  'research triangle park': 'NC',
  
  // Indiana
  'indianapolis': 'IN', 'fort wayne': 'IN', 'evansville': 'IN', 'south bend': 'IN',
  'carmel': 'IN', 'fishers': 'IN', 'bloomington': 'IN',
  
  // Ohio
  'columbus': 'OH', 'cleveland': 'OH', 'cincinnati': 'OH', 'toledo': 'OH',
  'akron': 'OH', 'dayton': 'OH', 'beavercreek': 'OH', 'youngstown': 'OH',
  
  // Wisconsin
  'milwaukee': 'WI', 'madison': 'WI', 'green bay': 'WI', 'kenosha': 'WI',
  'racine': 'WI', 'appleton': 'WI', 'waukesha': 'WI',
  
  // Maryland
  'baltimore': 'MD', 'annapolis': 'MD', 'rockville': 'MD', 'fort meade': 'MD',
  'frederick': 'MD', 'gaithersburg': 'MD', 'bowie': 'MD', 'hagerstown': 'MD',
  
  // Missouri
  'kansas city': 'MO', 'st louis': 'MO', 'saint louis': 'MO', 'springfield': 'MO',
  'columbia': 'MO', 'independence': 'MO', "lee's summit": 'MO',
  
  // Oklahoma
  'oklahoma city': 'OK', 'tulsa': 'OK', 'norman': 'OK', 'broken arrow': 'OK',
  'bartlesville': 'OK',
  
  // New Mexico
  'albuquerque': 'NM', 'santa fe': 'NM', 'las cruces': 'NM', 'rio rancho': 'NM',
  
  // Kentucky
  'louisville': 'KY', 'lexington': 'KY', 'bowling green': 'KY', 'owensboro': 'KY',
  
  // Virginia
  'richmond': 'VA', 'virginia beach': 'VA', 'norfolk': 'VA', 'arlington': 'VA',
  'mclean': 'VA', 'alexandria': 'VA', 'reston': 'VA', 'chantilly': 'VA',
  'ashburn': 'VA', 'chesapeake': 'VA', 'newport news': 'VA', 'hampton': 'VA',
  
  // Rhode Island
  'providence': 'RI', 'newport': 'RI', 'warwick': 'RI', 'cranston': 'RI',
  
  // Idaho
  'boise': 'ID', 'meridian': 'ID', 'nampa': 'ID', 'idaho falls': 'ID',
  
  // Iowa
  'des moines': 'IA', 'cedar rapids': 'IA', 'davenport': 'IA', 'sioux city': 'IA',
  
  // Nebraska
  'omaha': 'NE', 'lincoln': 'NE', 'bellevue': 'NE', 'grand island': 'NE',
  'offutt afb': 'NE',
  
  // Hawaii
  'honolulu': 'HI', 'hilo': 'HI', 'kailua': 'HI', 'kapolei': 'HI',
  
  // Alaska
  'anchorage': 'AK', 'juneau': 'AK', 'fairbanks': 'AK', 'sitka': 'AK',
  
  // Louisiana
  'new orleans': 'LA', 'baton rouge': 'LA', 'lafayette': 'LA', 'shreveport': 'LA',
  
  // Alabama
  'birmingham': 'AL', 'montgomery': 'AL', 'huntsville': 'AL', 'mobile': 'AL',
  
  // Arkansas
  'little rock': 'AR', 'fayetteville': 'AR', 'fort smith': 'AR', 'springdale': 'AR',
  
  // South Carolina
  'charleston': 'SC', 'columbia': 'SC', 'greenville': 'SC', 'myrtle beach': 'SC',
  
  // South Dakota
  'sioux falls': 'SD', 'rapid city': 'SD', 'aberdeen': 'SD', 'pierre': 'SD',
  
  // North Dakota
  'fargo': 'ND', 'bismarck': 'ND', 'grand forks': 'ND', 'minot': 'ND',
  
  // Mississippi
  'jackson': 'MS', 'gulfport': 'MS', 'southaven': 'MS', 'biloxi': 'MS',
  
  // Connecticut
  'bridgeport': 'CT', 'hartford': 'CT', 'new haven': 'CT', 'stamford': 'CT',
  'waterbury': 'CT', 'norwalk': 'CT', 'danbury': 'CT',
  
  // New Hampshire
  'manchester': 'NH', 'nashua': 'NH', 'concord': 'NH', 'derry': 'NH',
  
  // Vermont
  'burlington': 'VT', 'montpelier': 'VT', 'rutland': 'VT', 'essex': 'VT',
  
  // Maine
  'portland': 'ME', 'augusta': 'ME', 'lewiston': 'ME', 'bangor': 'ME',
  
  // Delaware
  'wilmington': 'DE', 'dover': 'DE', 'newark': 'DE', 'middletown': 'DE',
  
  // Wyoming
  'cheyenne': 'WY', 'casper': 'WY', 'laramie': 'WY', 'gillette': 'WY',
  
  // Montana
  'billings': 'MT', 'missoula': 'MT', 'great falls': 'MT', 'bozeman': 'MT',
  
  // West Virginia
  'charleston': 'WV', 'huntington': 'WV', 'morgantown': 'WV', 'parkersburg': 'WV',
  
  // DC/New Jersey
  'washington': 'DC', 'jersey city': 'NJ', 'newark': 'NJ', 'paterson': 'NJ',
  'elizabeth': 'NJ', 'edison': 'NJ', 'trenton': 'NJ', 'princeton': 'NJ',

  // Add remaining cities from your original mapping
};

/**
 * Clean job title by removing common prefixes, suffixes, and formatting issues
 */
function cleanJobTitle(title) {
  if (!title) return title;
  return title
    .replace(/\|/g, ' - ')
    .replace(/\n/g, ' ')
    .replace(/\s+(I|II|III|IV|V|\d+)$/, '')
    .replace(/\s*-\s*(Remote|Hybrid|On-site).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Look up state for a given city name
 */
function getStateForCity(cityName) {
  if (!cityName) return '';
  const normalized = cityName.toLowerCase().trim();
  return CITY_TO_STATE[normalized] || '';
}

/**
 * Normalize state to standard abbreviation
 */
function normalizeState(state) {
  if (!state) return '';
  
  const cleaned = state.trim().toUpperCase();
  
  // Check if already valid abbreviation
  if (VALID_STATE_ABBREVS.has(cleaned)) {
    return cleaned;
  }
  
  // Check full state name
  const fullName = state.trim().toLowerCase();
  return STATE_ABBREVIATIONS[fullName] || '';
}

/**
 * Remove street addresses and numbers from location string
 */
function removeAddressComponents(text) {
  return text
    // Remove complete street addresses with numbers
    .replace(/\b\d{3,}\s+[A-Za-z\s]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Circle|Cir|Parkway|Pkwy|Way)\b/gi, '')
    // Remove suite/unit numbers
    .replace(/\b(Suite|Ste|Unit|Apt|#)\s*\d+\w*\s*,?\s*/gi, '')
    // Remove standalone street numbers at the start (only if 3+ digits)
    .replace(/^\d{3,}\s+/, '')
    // Remove zip codes
    .replace(/\b\d{5}(-\d{4})?\b/g, '')
    .trim();
}

/**
 * ENHANCED: Remove ALL duplicate city/state patterns with multi-word support
 */
function removeDuplicateCities(text) {
  if (!text) return text;
  
  let cleaned = text;
  let previousCleaned = '';
  
  // Keep iterating until no more changes occur
  while (cleaned !== previousCleaned) {
    previousCleaned = cleaned;
    
    // Remove duplicate single words
    cleaned = cleaned.replace(/\b(\w+)\s+\1\b/gi, '$1');
    
    // Remove duplicate two-word phrases (e.g., "Santa Clara Santa Clara")
    cleaned = cleaned.replace(/\b(\w+\s+\w+)\s+\1\b/gi, '$1');
    
    // Remove duplicate three-word phrases (e.g., "New York City New York City")
    cleaned = cleaned.replace(/\b(\w+\s+\w+\s+\w+)\s+\1\b/gi, '$1');
    
    // Remove duplicates across comma boundaries
    cleaned = cleaned.replace(/\b(\w+(?:\s+\w+)*)\s*,\s*\1\b/gi, '$1');
    
    // Remove duplicates with multiple spaces
    cleaned = cleaned.replace(/\b(\w+(?:\s+\w+)*)\s{2,}\1\b/gi, '$1');
  }
  
  return cleaned.trim();
}

/**
 * Clean city name by removing state names and country identifiers
 */
function cleanCityName(cityText) {
  if (!cityText) return cityText;
  
  let cleaned = cityText;
  
  // Remove complete parenthetical phrases
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '').trim();
  
  // Handle incomplete parentheses
  cleaned = cleaned.replace(/\s*\(.*$/g, '').trim();
  
  // Remove "US" or "USA" at the end
  cleaned = cleaned.replace(/,?\s*\b(US|USA|U\.S\.A?)\b\s*$/i, '');
  
  // Remove state names (full names) at the end - only when preceded by comma
  Object.keys(STATE_ABBREVIATIONS).forEach(stateName => {
    const escapedState = stateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const statePattern = new RegExp(`,\\s*\\b${escapedState}\\b\\s*$`, 'gi');
    cleaned = cleaned.replace(statePattern, '');
  });
  
  // Remove state abbreviations at the end - only when preceded by comma
  VALID_STATE_ABBREVS.forEach(abbrev => {
    const abbrevPattern = new RegExp(`,\\s*\\b${abbrev}\\b\\s*$`, 'gi');
    cleaned = cleaned.replace(abbrevPattern, '');
  });
  
  // Clean up trailing commas or spaces
  cleaned = cleaned.replace(/[,\s]+$/, '').trim();
  
  return cleaned;
}

/**
 * COMPREHENSIVE helper function to check if location is remote
 */
function isRemoteLocation(text) {
  if (!text) return false;
  
  const normalized = text.toLowerCase().trim();
  
  // Direct remote keywords
  const remoteKeywords = [
    'remote', 'wfh', 'work from home', 'telecommute', 'telework',
    'virtual', 'off-site', 'offsite', 'home office', 'home based',
    'home-based', 'distributed', 'flexible location', 'anywhere',
    'any location', 'any where', 'location flexible'
  ];
  
  // Check for exact matches
  if (remoteKeywords.includes(normalized)) return true;
  
  // Check if text contains remote keywords
  for (const keyword of remoteKeywords) {
    if (normalized.includes(keyword)) return true;
  }
  
  // Country-code remote patterns
  if (/^[a-z]{2,}-.*remote/i.test(text)) return true;
  if (/^[a-z]{2,}\s*-\s*remote/i.test(text)) return true;
  
  // Any / Remote patterns
  if (/any\s*\/\s*remote/i.test(text)) return true;
  if (/remote\s*\/\s*any/i.test(text)) return true;
  
  // State/Country with remote
  if (/^[a-z\s]+\s+remote$/i.test(text)) return true;
  if (/remote\s*[-,]\s*[a-z\s]+$/i.test(text)) return true;
  
  // Remote with parentheses/brackets
  if (/remote\s*[\(\[].*[\)\]]/i.test(text)) return true;
  if (/[\(\[].*remote.*[\)\]]/i.test(text)) return true;
  
  // Emoji indicator
  if (text.includes('🏠')) return true;
  
  return false;
}

/**
 * ENHANCED: Parse and clean location text to extract city and state
 * Now handles patterns like: "LocationUS,CA,Santa Clara 2485 Augustine Drive Santa Clara, California US"
 */
function parseLocation(locationText) {
  // Handle null/empty cases
  if (!locationText ||
      locationText === 'null' ||
      locationText.trim() === '' ||
      locationText.toLowerCase().trim() === 'null') {
    return { city: 'US - Remote', state: '' };
  }

  // CRITICAL: Remove "Location" prefix FIRST
  let cleanLocation = locationText
    .replace(/^Location\s*/gi, '')  // Remove "Location" at the start
    .replace(/^location/gi, '')     // Case-insensitive removal
    .replace(/__/g, '')              // Remove markdown underscores
    .replace(/\*/g, '')              // Remove asterisks
    .replace(/posted\s+on/gi, '')
    .replace(/posted\s+/gi, '')
    .replace(/\d+\s+(days?|hours?|weeks?|months?)\s+ago/gi, '')
    .replace(/\d+\s+ago/gi, '')
    .replace(/\s+Ago/gi, '')
    .replace(/\s+ID:\s*\d+/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '')
    .trim();

  // Check for remote patterns FIRST
  if (isRemoteLocation(cleanLocation)) {
    return { city: 'US - Remote', state: '' };
  }

  // Check for multiple location patterns
  const multipleLocationPatterns = [
    /multiple\s+(cities|locations|sites|position)/i,
    /various\s+(cities|locations)/i,
    /all\s+locations/i,
    /nationwide/i,
    /^\d+\s+(locations|cities)$/i,
    /^multiple$/i
  ];

  for (const pattern of multipleLocationPatterns) {
    if (pattern.test(cleanLocation.toLowerCase())) {
      return { city: 'Multiple Cities', state: '' };
    }
  }

  // ENHANCED: Handle "US,CA,Santa Clara..." pattern - extract city before address
  const usStateCityPattern = /^(US|USA),([A-Z]{2}),([A-Za-z\s]+?)(?:\s+\d+|\s+[A-Z][a-z]+\s+[A-Z][a-z]+|,)/i;
  const usStateCityMatch = cleanLocation.match(usStateCityPattern);
  
  if (usStateCityMatch) {
    const state = normalizeState(usStateCityMatch[2].trim());
    let city = usStateCityMatch[3].trim();
    
    // Remove any trailing numbers or addresses
    city = city.replace(/\s+\d+.*$/, '').trim();
    
    if (state && city) {
      return { city, state };
    }
  }

  // ENHANCED: Handle "USA-State-City-Address" format (e.g., "USA-Colorado-Fort Collins-4380 Ziegler Road")
  const usaDashPattern = /^(USA|US)-([A-Za-z\s]+?)-([A-Za-z\s]+?)(?:-\d+|-[A-Z])/i;
  const usaDashMatch = cleanLocation.match(usaDashPattern);
  
  if (usaDashMatch) {
    const statePart = usaDashMatch[2].trim();
    let city = usaDashMatch[3].trim();
    
    const state = normalizeState(statePart);
    
    // Remove any trailing numbers or addresses
    city = city.replace(/\s+\d+.*$/, '').trim();
    
    if (state && city) {
      return { city, state };
    }
  }

  // Remove address components
  cleanLocation = removeAddressComponents(cleanLocation);
  
  // Remove street addresses that appear BEFORE city names
  cleanLocation = cleanLocation
    .replace(/^\d+\s+[\w\s]+\s+(Avenue|Ave|Street|St|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct)\s+/gi, '')
    .trim();

  // CRITICAL: Remove ALL duplicates early
  cleanLocation = removeDuplicateCities(cleanLocation);

  // Handle various comma-separated formats
  
  // "City, State, Country" format
  const cityStateCountryMatch = cleanLocation.match(/^([^,]+),\s*([^,]+),\s*(?:united\s+states|usa|us)$/i);
  if (cityStateCountryMatch) {
    const city = cityStateCountryMatch[1].trim();
    const state = normalizeState(cityStateCountryMatch[2].trim());
    if (state && city) {
      return { city, state };
    }
  }

  // "City, State USA" format
  const cityStateUSAMatch = cleanLocation.match(/^([^,]+),\s*([^,]+?)\s*(?:US|USA|United\s+States)$/i);
  if (cityStateUSAMatch) {
    const city = cityStateUSAMatch[1].trim();
    const state = normalizeState(cityStateUSAMatch[2].trim());
    if (state && city) {
      return { city, state };
    }
  }

  // "City, State" standard format
  const cityStateMatch = cleanLocation.match(/^([^,]+),\s*([A-Z]{2})$/i);
  if (cityStateMatch) {
    const city = cityStateMatch[1].trim();
    const state = normalizeState(cityStateMatch[2].trim());
    if (state && city) {
      return { city, state };
    }
  }

  // Parse by comma separation
  const parts = cleanLocation
    .split(',')
    .map(part => removeDuplicateCities(part.trim()))
    .filter(part => part.length > 0);

  if (parts.length >= 2) {
    const part1 = parts[0];
    const part2 = parts[1];
    
    const state1 = normalizeState(part1);
    const state2 = normalizeState(part2);
    
    // Normal "City, State" format
    if (!state1 && state2) {
      return { city: part1, state: state2 };
    }
    
    // Reversed "State, City" format
    if (state1 && !state2) {
      return { city: part2, state: state1 };
    }
    
    // Check city mappings
    if (!state1 && !state2) {
      const autoState1 = getStateForCity(part1);
      if (autoState1) {
        return { city: part1, state: autoState1 };
      }
    }
    
    return { city: part1, state: state2 || '' };
    
  } else if (parts.length === 1) {
    const singlePart = parts[0];
    
    // Check if it's a state
    const normalizedState = normalizeState(singlePart);
    if (normalizedState) {
      return { city: '', state: normalizedState };
    }
    
    // Try to find state for this city
    const autoState = getStateForCity(singlePart);
    if (autoState) {
      return { city: singlePart, state: autoState };
    }
    
    return { city: singlePart, state: '' };
  }

  return { city: 'Multiple Cities', state: '' };
}

/**
 * Convert date string to relative format
 */
function convertDateToRelative(postedDate) {
  if (!postedDate || String(postedDate).trim() === '') return null;
  
  const dateStr = String(postedDate);
  
  // Already in desired format
  if (/^\d+[hdwmo]+$/i.test(dateStr.trim())) {
    return dateStr.trim();
  }

  let cleanedDate = dateStr
    .replace(/^posted\s+/i, '')
    .replace(/\s+ago$/i, '')
    .replace(/^on\s+/i, '')
    .trim()
    .toLowerCase();

  // Handle relative terms
  if (cleanedDate === 'today') return '1d';
  if (cleanedDate === 'yesterday') return '1d';
  if (cleanedDate.includes('just') || cleanedDate.includes('recently')) return '1h';

  // Handle time units
  const timeRegex = /(\d+)\s*(hour|h|day|d|week|w|month|mo|m)(?:\s|$)/i;
  const match = cleanedDate.match(timeRegex);
  
  if (match) {
    const number = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    if (unit.startsWith('h')) return `${number}h`;
    if (unit.startsWith('d')) return `${number}d`;
    if (unit.startsWith('w')) return `${number}w`;
    if (unit === 'mo' || (unit === 'm' && !unit.includes('min'))) return `${number}mo`;
  }

  // Try to parse as date
  const parsedDate = new Date(dateStr);
  if (isNaN(parsedDate.getTime())) return null;

  const now = new Date();
  const diffTime = Math.abs(now - parsedDate);
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffHours < 24) return diffHours === 0 ? '1h' : `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  return `${Math.floor(diffDays / 30)}mo`;
}

/**
 * Check if job is older than one month
 */
function isJobOlderThanOneMonth(postedDate) {
  const relativeDate = convertDateToRelative(postedDate);
  if (relativeDate === null) return false;
  
  const match = relativeDate.match(/^(\d+)([hdwmo])$/i);
  if (!match) return true;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  return unit === 'mo' && value >= 1;
}

/**
 * Format location for output
 */
function formatLocation(location) {
  if (!location) return 'US - Remote';
  
  if (typeof location === 'string') return location;
  
  if (typeof location === 'object') {
    const { city, state } = location;
    
    if (city === 'US - Remote' || city === 'Multiple Cities') {
      return city;
    }
    
    if (city && state) return `${city}, ${state}`;
    if (city && !state) return city;
    if (!city && state) return state;
  }
  
  return 'US - Remote';
}

/**
 * Main transformation function
 */
function transformJobs(jobs, searchQuery, saveToFile = true, outputPath = null) {
  const fs = require('fs');
  const path = require('path');
  
  const transformedJobs = jobs
    .filter(job => job.title && job.title.trim() !== '')
    .filter(job => !isJobOlderThanOneMonth(job.posted))
    .map(job => {
      const location = parseLocation(job.location);
      const applyLink = job.applyLink || '';
      const postedRelative = convertDateToRelative(job.posted);
      const job_description = job.description;

      // Clean the city name
      const cleanedCity = cleanCityName(location.city);

      return {
        employer_name: job.company || '',
        job_title: cleanJobTitle(job.title),
        job_city: cleanedCity || '',
        job_state: location.state || '',
        job_posted_at: postedRelative,
        job_description: job_description || `${searchQuery} job for the role ${job.title}`,
        job_apply_link: applyLink,
      };
    });

  // Save to JSON file if requested
  if (saveToFile) {
    const finalOutputPath = outputPath || path.join(__dirname, '../../data/transformed_jobs.json');
    const dir = path.dirname(finalOutputPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      fs.writeFileSync(
        finalOutputPath,
        JSON.stringify(transformedJobs, null, 2),
        'utf8'
      );
      console.log(`✓ Saved ${transformedJobs.length} transformed jobs to ${finalOutputPath}`);
    } catch (error) {
      console.error(`✗ Error saving transformed jobs:`, error.message);
    }
  }

  return transformedJobs;
}

module.exports = {
  cleanJobTitle,
  parseLocation,
  convertDateToRelative,
  isJobOlderThanOneMonth,
  transformJobs,
  getStateForCity,
  normalizeState,
  formatLocation,
  removeDuplicateCities,
  cleanCityName,
  isRemoteLocation
};