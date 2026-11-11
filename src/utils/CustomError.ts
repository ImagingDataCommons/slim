export const errorTypes = {
  AUTHENTICATION: 'Authentication',
  COMMUNICATION: 'Communication',
  ENCODINGANDDECODING: 'EncodingDecoding',
  VISUALIZATION: 'Visualization',
} as const

/** Error tagged with a category (usually one of `errorTypes`) for notifications. */
export class CustomError extends Error {
  readonly type: string

  constructor(type: string, message: string) {
    super(message)
    this.type = type
  }
}
