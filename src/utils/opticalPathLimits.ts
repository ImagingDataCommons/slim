/** Maximum pixel value for BitsAllocated, used by optical-path windowing. */
export function maxValueForBitsAllocated(
  bitsAllocated: number | undefined,
): number {
  return 2 ** (bitsAllocated ?? 8) - 1
}
