// This file doesn't exist yet, so we're creating it

/**
 * Custom Jest configuration for order service tests
 */
module.exports = {
  // Limit test execution to one worker to avoid parallel execution issues
  maxWorkers: 1,
  
  // Set a longer timeout for tests
  testTimeout: 30000,
  
  // Use a more verbose test reporter
  verbose: true,
}; 