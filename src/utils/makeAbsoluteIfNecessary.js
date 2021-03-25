import isAbsoluteUrl from "./isAbsoluteUrl";

export default function makeAbsoluteIfNecessary(url, base_url) {
  if (isAbsoluteUrl(url)) {
    return url;
  }

  /*
   * Make sure base_url and url are not duplicating slashes.
   */
  if (base_url[base_url.length - 1] === "/") {
    base_url = base_url.slice(0, base_url.length - 1);
  }

  return base_url + url;
}
