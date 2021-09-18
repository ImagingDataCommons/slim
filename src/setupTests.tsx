// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
global.matchMedia = global.matchMedia || function () {
  return {
    addListener: jest.fn(),
    removeListener: jest.fn()
  }
}
