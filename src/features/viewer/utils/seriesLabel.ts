/** Series description, or a truncated UID when the series has none */
export function formatSeriesLabel(
  seriesInstanceUID: string,
  seriesDescription: string | undefined,
): string {
  if (seriesDescription !== undefined && seriesDescription !== '') {
    return seriesDescription
  }
  return `Series ${seriesInstanceUID.slice(0, 8)}...`
}
