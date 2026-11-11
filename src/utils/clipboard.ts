export type ClipboardWriter = Pick<Clipboard, 'writeText'>

/** `navigator.clipboard` is missing in insecure contexts despite its DOM type. */
export function getClipboard(): ClipboardWriter | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as { clipboard?: ClipboardWriter }).clipboard
}

/** Resolves to whether the text actually reached the clipboard. */
export async function writeClipboardText(
  clipboard: ClipboardWriter | undefined,
  text: string,
): Promise<boolean> {
  if (clipboard === undefined) return false
  try {
    await clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
