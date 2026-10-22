/**
 * Saves `text` as a file. The anchor must be in the document for Firefox to
 * honour the click, and revoking the object URL synchronously can cancel the
 * download in some browsers, so revocation is deferred.
 */
export function downloadTextFile(
  name: string,
  text: string,
  mime = 'text/plain',
): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.style.display = 'none'
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
