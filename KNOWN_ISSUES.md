# Known Issues with Job Sites

## Sites with Description Extraction Issues

### 1. Hewlett Packard Enterprise (HPE)
**Issue**: Description selector failing
```
Selector: #mainContent > div > div.css-1142bqn > div > div > section > div > div.css-oa138a > div > div > div > div.css-1i27f3a > div > div.css-11ukcqc > p
```
**Error**: "Waiting for selector failed" on pages 1-3
**Impact**: No job descriptions extracted for HPE jobs
**Suspected Cause**: CSS classes may have changed or selector is too specific

### 2. Sites with Same-Page Description Loading Issues
**Pattern**: Sites where clicking job title should load description in sidebar/modal
**Common Issues**:
- Description doesn't load after click
- Selector present but content empty
- Timing issues with dynamic content loading
**Impact**: Missing descriptions, slower scraping due to retries

### 3. Sites with Next-Page Navigation Issues
**Pattern**: Sites requiring navigation to individual job pages
**Common Issues**:
- Navigation timeout (was 115 seconds!)
- Failed to return to listing page
- URL conversion issues
**Impact**: Stuck navigation, incomplete job extraction

## Sites Likely Affected (Based on Code Patterns)

### Special Handling Required:
- **10x Genomics** - Custom posted date extraction
- **Applied Materials** - Slice limit applied (last N jobs only)
- **Honeywell** - Special location extraction logic
- **JPMorgan Chase** - Special location extraction logic
- **Texas Instruments** - Special location extraction logic

### Potential Selector Issues:
These companies have complex selectors that may break:
1. Companies using `descriptionType: 'next-page'`
2. Companies with deeply nested CSS selectors
3. Companies using dynamic class names (css-[hash] patterns)

## Common Failure Patterns

### 1. Dynamic CSS Classes
- Selectors like `.css-1142bqn` are generated and change frequently
- Solution: Use more stable selectors (data attributes, semantic HTML)

### 2. Single Page Applications (SPAs)
- Content loads dynamically after initial page load
- Timing issues with `waitForSelector`
- Solution: Increase wait times or use different wait strategies

### 3. Rate Limiting/Anti-Scraping
- Some sites may detect automated access
- Symptoms: Timeouts, empty responses, 429 errors
- Solution: Add delays, rotate user agents, respect robots.txt

## Recommendations for Fixes

### Immediate Actions:
1. **Update HPE selector** - Find new stable selector
2. **Audit all description selectors** - Test which ones still work
3. **Add selector validation** - Check if selector exists before using

### Long-term Improvements:
1. **Implement selector auto-detection** - Fallback to common patterns
2. **Add selector health monitoring** - Track success rates
3. **Create company-specific handlers** - Custom logic per site
4. **Implement graceful degradation** - Continue without descriptions

## Performance Impact

Current optimizations handle these failures better:
- **Before**: 20+ seconds per failed description
- **After**: 3-4 seconds per failed description
- **Savings**: ~15-17 seconds per failure × dozens of jobs = significant

## Testing Checklist

When fixing these issues:
- [ ] Test selector on live site using browser DevTools
- [ ] Verify selector is stable across page refreshes
- [ ] Check selector works for all job types (not just first one)
- [ ] Test with both empty and populated job listings
- [ ] Verify pagination still works after selector updates
- [ ] Monitor for rate limiting or blocking

## Notes

- These issues existed before optimizations
- Optimizations make failures faster, not more frequent
- Priority should be on high-volume companies (HPE, etc.)
- Consider removing description extraction for consistently failing sites

## Next Session TODO

1. **Fix selector issues for major companies**
   - Hewlett Packard Enterprise (highest priority)
   - Update other broken description selectors
   - Test and validate selectors

2. **Discord Bot Enhancements** (Already exists but could be improved)
   - Current features: Posts new jobs, slash commands, subscriptions
   - Potential improvements:
     - Add more sophisticated filtering
     - Implement job search by skills
     - Add statistics/analytics commands
     - Improve tag generation accuracy

3. **Monitor optimization performance**
   - Track actual runtime after optimizations
   - Identify any new bottlenecks
   - Fine-tune thresholds if needed