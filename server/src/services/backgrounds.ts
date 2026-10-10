import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type Sharp } from 'sharp';

export const BACKGROUND_FILE = /^b\d+-[a-f0-9]{12}(-thumb)?\.webp$/;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_EDGE = 2560;

export class UnsupportedImageError extends Error {}

/**
 * Re-encodes an uploaded photo as WebP (max 2560px on the long edge) plus a
 * small thumbnail for board tiles. Re-encoding validates that the upload is a
 * real image and strips metadata such as the GPS location from phone photos.
 * Returns the full-size file name.
 */
export async function saveBackground(input: Buffer, dir: string, boardId: number): Promise<string> {
  let image: Sharp;
  try {
    image = sharp(input, { limitInputPixels: 120_000_000, failOn: 'error' }).rotate();
    const meta = await image.metadata();
    if (!meta.format || !['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff'].includes(meta.format)) throw new Error('format');
  } catch {
    throw new UnsupportedImageError("That file isn't a supported image. Use a JPEG, PNG or WebP photo.");
  }
  const stem = `b${boardId}-${crypto.randomBytes(6).toString('hex')}`;
  await fs.mkdir(dir, { recursive: true });
  const full = `${stem}.webp`;
  await image
    .clone()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(dir, full));
  await image.clone().resize({ width: 480, height: 320, fit: 'cover' }).webp({ quality: 70 }).toFile(path.join(dir, `${stem}-thumb.webp`));
  return full;
}

export async function removeBackground(dir: string, file: string | null): Promise<void> {
  if (!file || !BACKGROUND_FILE.test(file)) return;
  await Promise.all([
    fs.rm(path.join(dir, file), { force: true }),
    fs.rm(path.join(dir, file.replace(/\.webp$/, '-thumb.webp')), { force: true }),
  ]);
}
