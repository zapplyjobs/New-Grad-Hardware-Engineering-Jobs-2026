# Performance Optimization Plan - Option 2: Skip Puppeteer for API Companies

## Overview
This document outlines the implementation of Option 2 to reduce GitHub Actions workflow runtime from 90+ minutes to ~30 minutes by skipping Puppeteer initialization for companies that use direct API endpoints.

## Problem Statement
- **Current Issue:** Workflow takes 90+ minutes to complete
- **Root Cause:** Puppeteer is initialized for ALL companies, even those using direct API calls
- **Impact:** Unnecessary overhead of ~30-60 seconds per API-based company

## Solution: Skip Puppeteer for API-Only Companies

### Why This Is Safe
1. **No Functional Changes:** API-based companies already use `fetch()` calls, not browser automation
2. **Zero Risk:** These companies never touch Puppeteer code paths
3. **Immediate Impact:** Saves browser startup/shutdown time for ~40% of companies

### Implementation Strategy

#### Phase 1: Identify API-Based Companies
Companies in `CAREER_APIS` object that use direct HTTP endpoints:
- Stripe (Greenhouse API)
- Coinbase (Greenhouse API)
- Airbnb (Greenhouse API)
- Square (Greenhouse API)
- Databricks (Greenhouse API)
- Robinhood (Greenhouse API)
- Netflix (custom API)
- Adobe (custom API)
- Salesforce (custom API)
- Oracle (Taleo API)

#### Phase 2: Code Modifications

**Current Flow:**
```
1. Initialize Puppeteer for ALL companies
2. Fetch API data OR scrape with Puppeteer
3. Close Puppeteer
```

**Optimized Flow:**
```
1. Check if company uses API
2a. If API: Fetch data directly (no Puppeteer)
2b. If scraper: Initialize Puppeteer → Scrape → Close
```

#### Phase 3: Implementation Details

**File:** `.github/scripts/real-career-scraper.js`

**Changes Required:**
1. Split company processing into two paths:
   - API path: Direct fetch without Puppeteer
   - Scraper path: Current Puppeteer-based approach

2. Modify `fetchAllRealJobs()` function to:
   - Process API companies first (no browser needed)
   - Then process scraper companies with Puppeteer

3. Add company type detection:
   ```javascript
   function isAPICompany(companyName) {
     return Object.keys(CAREER_APIS).includes(companyName);
   }
   ```

## Expected Performance Gains

### Before Optimization
- Total companies: ~25
- API companies: ~10
- Time per API company: ~60 seconds (30s Puppeteer init + 30s fetch)
- Total API time: 600 seconds (10 minutes)

### After Optimization
- API companies: ~10
- Time per API company: ~5 seconds (fetch only)
- Total API time: 50 seconds
- **Time Saved: ~9 minutes**

### Additional Benefits
- Reduced memory usage (no Chrome instances for API calls)
- Fewer timeout failures
- Cleaner separation of concerns
- Easier debugging (API vs scraping issues)

## Testing Plan

1. **Unit Test:** Verify API companies bypass Puppeteer
2. **Integration Test:** Ensure both paths return same data format
3. **Performance Test:** Measure actual time reduction
4. **Regression Test:** Verify all companies still fetch successfully

## Rollback Plan
If issues occur, the change can be instantly reverted by:
1. Removing the conditional logic
2. Returning to always initializing Puppeteer

This is low-risk since we're only optimizing, not changing functionality.

## Success Metrics
- [ ] Workflow runtime < 30 minutes
- [ ] All API companies fetch successfully
- [ ] No reduction in job discovery
- [ ] Zero new errors introduced

## Implementation Timeline
1. Document plan (COMPLETE)
2. Identify API companies
3. Implement code changes
4. Test locally
5. Deploy to production

---

*Last Updated: 2025-10-07*