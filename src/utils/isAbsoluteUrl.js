export default function _isAbsoluteUrl(url) {
  return url.includes("http://") || url.includes("https://");
}