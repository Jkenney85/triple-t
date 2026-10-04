const TIKTOK_PAGE_DOMAINS = ['tiktok.com'];
/** Domains TikTok serves oEmbed thumbnails from. */
const TIKTOK_IMAGE_DOMAINS = ['tiktok.com', 'tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'ibyteimg.com', 'tiktokv.com', 'muscdn.com'];

function hostMatches(host: string, domains: string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  return domains.some((d) => h === d || h.endsWith(`.${d}`));
}

function parse(url: string): URL | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password) return null;
    if (u.port && u.port !== '443' && u.port !== '80') return null;
    return u;
  } catch {
    return null;
  }
}

/** True for http(s) links on tiktok.com or any subdomain (www., vm., vt., m.). */
export function isTikTokUrl(url: string): boolean {
  const u = parse(url);
  return !!u && hostMatches(u.hostname, TIKTOK_PAGE_DOMAINS);
}

export function isTikTokImageUrl(url: string): boolean {
  const u = parse(url);
  return !!u && u.protocol === 'https:' && hostMatches(u.hostname, TIKTOK_IMAGE_DOMAINS);
}
