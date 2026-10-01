export interface DebounceOptions {
  /** Invoke on the first call of a burst */
  leading?: boolean
  /** Invoke with the latest arguments once the burst settles */
  trailing?: boolean
}

export interface DebouncedFunction<Args extends unknown[]> {
  (...args: Args): void
  /** Drop any pending trailing call */
  cancel: () => void
}

/**
 * Delay `fn` until `wait` ms have passed without another call. With both
 * `leading` and `trailing`, a burst of one call invokes `fn` once; longer
 * bursts invoke it at the start and again with the last arguments.
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  wait: number,
  { leading = false, trailing = true }: DebounceOptions = {},
): DebouncedFunction<Args> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingArgs: Args | undefined

  const settle = (): void => {
    timer = undefined
    const args = pendingArgs
    pendingArgs = undefined
    if (trailing && args !== undefined) fn(...args)
  }

  const debounced = (...args: Args): void => {
    const isBurstStart = timer === undefined
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(settle, wait)
    if (isBurstStart && leading) {
      fn(...args)
      return
    }
    pendingArgs = args
  }

  debounced.cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    pendingArgs = undefined
  }

  return debounced
}
