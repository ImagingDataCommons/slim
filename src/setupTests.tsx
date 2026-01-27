// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

global.matchMedia =
  global.matchMedia !== undefined
    ? global.matchMedia
    : function (query: string): MediaQueryList {
        return {
          media: query,
          matches: false,
          onchange: null,
          addListener() {
            // Mock implementation - intentionally empty
          },
          removeListener() {
            // Mock implementation - intentionally empty
          },
          addEventListener() {
            // Mock implementation - intentionally empty
          },
          removeEventListener() {
            // Mock implementation - intentionally empty
          },
          dispatchEvent() {
            return false
          },
        }
      }

export {}
