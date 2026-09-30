/**
 * Mock for @radix-ui/primitive/is-development
 * This module is used internally by Radix UI components
 */
module.exports = {
  isDevelopment: process.env.NODE_ENV === 'development',
}
