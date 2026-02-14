#!/usr/bin/env node

/**
 * JSearch API Fetcher for Hardware Engineering Jobs
 * Wrapper for shared JSearch fetcher library (Phase 4.3)
 */

const createJSearchFetcher = require('../shared/lib/jsearch-fetcher');

// Domain-specific search queries for Hardware Engineering
const SEARCH_QUERIES = [
    'hardware engineer',
    'electrical engineer',
    'embedded systems engineer',
    'embedded software engineer',
    'firmware engineer',
    'fpga engineer',
    'asic engineer',
    'pcb designer',
    'hardware design engineer',
    'verification engineer',
    'digital design engineer',
    'analog engineer',
    'mixed signal engineer',
    'power electronics engineer',
    'rf engineer',
    'vlsi engineer',
    'hardware test engineer',
    'electrical engineering intern',
    'hardware engineering intern',
    'embedded systems intern'
];

// Create fetcher instance with domain queries
const fetcher = createJSearchFetcher(
    SEARCH_QUERIES,
    process.env.JSEARCH_API_KEY,
    { maxRequestsPerDay: 30 }
);

module.exports = {
    fetchAllJSearchJobs: fetcher.fetchAllJSearchJobs,
    SEARCH_QUERIES: fetcher.SEARCH_QUERIES
};
