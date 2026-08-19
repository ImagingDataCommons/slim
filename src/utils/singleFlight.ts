/**
 * Collapse concurrent callers that share a key onto one in-flight operation.
 *
 * Used for work that must not be duplicated even though several independent
 * callers may need it at the same instant — notably asking the user a question.
 * A page load can challenge the same DICOMweb origin from several clients at
 * once, and each would otherwise open its own consent prompt.
 *
 * The entry is released once the operation settles, so a later call starts
 * fresh rather than replaying a stale result.
 */
export type SingleFlight<T> = (key: string, run: () => Promise<T>) => Promise<T>

/**
 * Build a single-flight gate with its own independent key space.
 *
 * @returns A function that runs `run` for a key, or joins the run already in
 *   progress for that key
 */
export const createSingleFlight = <T>(): SingleFlight<T> => {
  const inFlight = new Map<string, Promise<T>>()

  return async (key: string, run: () => Promise<T>): Promise<T> => {
    const pending = inFlight.get(key)
    if (pending !== undefined) {
      return await pending
    }
    const promise = run().finally(() => {
      inFlight.delete(key)
    })
    inFlight.set(key, promise)
    return await promise
  }
}
