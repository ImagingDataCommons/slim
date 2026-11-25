import { CustomError, errorTypes } from '../CustomError'

describe('CustomError', () => {
  it('keeps the category and message of the error', () => {
    const error = new CustomError(errorTypes.COMMUNICATION, 'Server down')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(CustomError)
    expect(error.type).toBe('Communication')
    expect(error.message).toBe('Server down')
    expect(error.stack).toEqual(expect.any(String))
  })
})
