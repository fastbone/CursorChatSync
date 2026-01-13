/**
 * Jest test setup file
 * This runs before all tests
 */

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';

// Increase timeout for database operations
jest.setTimeout(10000);
