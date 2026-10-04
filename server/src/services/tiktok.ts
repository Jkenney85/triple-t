import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { isTikTokImageUrl, isTikTokUrl } from '@triple-t/shared';
import type { DB } from '../db';
import * as s from '../db/schema';
import type { Config } from '../env';

export const THUMB_FILE = /^v\d+-[a-f0-9]{12}\.(jpg|png|webp)$/;

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const MAX_JSON_BYTES = 512 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const privateRanges = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
] as const) {
  privateRanges.addSubnet(addr, prefix, 'ipv4');
}
for (const [addr, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  // IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) are already matched by the IPv4 rules above.
  privateRanges.addSubnet(addr, prefix, 'ipv6');
}

/** Defence in depth on top of the host allowlist: refuse hosts that resolve to internal addresses. */
async function assertPublicHost(hostname: string) {
  const addrs = await dns.lookup(hostname, { all: true });
  for (const { address, family } of addrs) {
    if (privateRanges.check(address, family === 6 ? 'ipv6' : 'ipv4')) {
      throw new Error(`Refusing to fetch ${hostname}: resolves to a private address`);
    }
  }
}

/** GET that follows redirects by hand, re-checking every hop against `allowed`. */
async function safeGet(url: string, allowed: (u: string) => boolean, accept: string): Promise<{ res: Response; finalUrl: string }> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!allowed(current)) throw new Error(`Blocked non-TikTok URL: ${new URL(current).hostname}`);
    await assertPublicHost(new URL(current).hostname);
    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': USER_AGENT, accept },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      await res.body?.cancel();
      if (!location) throw new Error('Redirect without a location');
      current = new URL(location, current).toString();
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new Error('Too many redirects');
}

async function readCapped(res: Response, max: number): Promise<Buffer> {
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > max) throw new Error('Response too large');
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body!.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new Error('Response too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

const isShortLink = (u: URL) => /^(vm|vt)\./i.test(u.hostname) || u.pathname.startsWith('/t/');

/** Follows short links like vm.tiktok.com/abc to the canonical video URL (without tracking params). */
export async function resolveTikTokUrl(url: string): Promise<string> {
  let u = new URL(url.trim());
  if (isShortLink(u)) {
    const { res, finalUrl } = await safeGet(u.toString(), isTikTokUrl, 'text/html');
    await res.body?.cancel();
    u = new URL(finalUrl);
  }
  u.protocol = 'https:';
  u.search = '';
  u.hash = '';
  return u.toString();
}

interface OEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

export async function fetchOEmbed(videoUrl: string): Promise<OEmbed> {
  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
  const { res } = await safeGet(endpoint, isTikTokUrl, 'application/json');
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`TikTok oEmbed returned ${res.status}`);
  }
  return JSON.parse((await readCapped(res, MAX_JSON_BYTES)).toString('utf8')) as OEmbed;
}

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function downloadThumbnail(url: string, dir: string, videoId: number): Promise<string> {
  const { res } = await safeGet(url, isTikTokImageUrl, 'image/*');
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`Thumbnail download returned ${res.status}`);
  }
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = IMAGE_TYPES[type];
  if (!ext) {
    await res.body?.cancel();
    throw new Error(`Unexpected thumbnail type "${type}"`);
  }
  const data = await readCapped(res, MAX_IMAGE_BYTES);
  const file = `v${videoId}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, file), data);
  return file;
}

/**
 * Resolves the video's URL, fetches its oEmbed metadata, and stores the
 * thumbnail locally (TikTok's CDN URLs expire). Failures are recorded on the
 * row so the UI can show a placeholder; the link keeps working either way.
 */
export async function fetchVideoMetadata(db: DB, config: Config, videoId: number): Promise<void> {
  const video = db.select().from(s.videos).where(eq(s.videos.id, videoId)).get();
  if (!video) return;
  try {
    const url = await resolveTikTokUrl(video.url);
    const meta = await fetchOEmbed(url);
    let thumbnailFile = video.thumbnailFile;
    let thumbError: string | null = null;
    if (meta.thumbnail_url) {
      try {
        thumbnailFile = await downloadThumbnail(meta.thumbnail_url, config.thumbsDir, videoId);
        if (video.thumbnailFile && video.thumbnailFile !== thumbnailFile) {
          await fs.rm(path.join(config.thumbsDir, video.thumbnailFile), { force: true });
        }
      } catch (err) {
        thumbError = (err as Error).message;
      }
    }
    db.update(s.videos)
      .set({
        url,
        title: (meta.title ?? '').slice(0, 500),
        author: (meta.author_name ?? '').slice(0, 200),
        thumbnailFile,
        status: thumbnailFile ? 'ok' : 'error',
        error: thumbnailFile ? null : (thumbError ?? 'No thumbnail available'),
        updatedAt: Date.now(),
      })
      .where(eq(s.videos.id, videoId))
      .run();
  } catch (err) {
    db.update(s.videos)
      .set({ status: 'error', error: (err as Error).message.slice(0, 300), updatedAt: Date.now() })
      .where(eq(s.videos.id, videoId))
      .run();
    throw err;
  }
}
