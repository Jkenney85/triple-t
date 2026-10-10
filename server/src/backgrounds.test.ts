import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Board, Patch } from '@triple-t/shared';
import { bootstrapAdmin } from './auth';
import { buildApp } from './app';
import { openDb } from './db';
import { loadConfig } from './env';

let app: FastifyInstance;
let cookie = '';
let boardId = 0;
let dataDir = '';

function multipart(filename: string, type: string, data: Buffer) {
  const boundary = '----ttt' + Math.random().toString(16).slice(2);
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, headers: { cookie, 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

async function uploadFile(filename: string, type: string, data: Buffer) {
  const { body, headers } = multipart(filename, type, data);
  return app.inject({ method: 'POST', url: `/api/boards/${boardId}/background`, payload: body, headers });
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttt-bg-'));
  const config = loadConfig({ NODE_ENV: 'test', DATA_DIR: dataDir, TZ: 'America/Chicago' });
  const db = openDb(':memory:');
  await bootstrapAdmin(db, 'admin', 'correct-horse-battery', { info: () => {} });
  ({ app } = await buildApp(db, config, { realtime: false }));
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: 'correct-horse-battery' } });
  cookie = String(login.headers['set-cookie']).split(';')[0];
  const res = await app.inject({ method: 'POST', url: '/api/boards', payload: { name: 'Photo board' }, headers: { cookie } });
  boardId = res.json<{ board: Board }>().board.id;
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('board wallpaper upload', () => {
  it('re-encodes a real image to webp with a thumbnail, and serves it', async () => {
    const png = await sharp({ create: { width: 3200, height: 1800, channels: 3, background: '#3366ff' } }).png().toBuffer();
    const res = await uploadFile('beach.png', 'image/png', png);
    expect(res.statusCode).toBe(200);
    const url = res.json<Patch>().board!.backgroundImage!;
    expect(url).toMatch(/^\/api\/backgrounds\/b\d+-[a-f0-9]{12}\.webp$/);

    const full = await app.inject({ method: 'GET', url, headers: { cookie } });
    expect(full.statusCode).toBe(200);
    expect(full.headers['content-type']).toBe('image/webp');
    const meta = await sharp(full.rawPayload).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width!, meta.height!)).toBe(2560);

    const thumb = await app.inject({ method: 'GET', url: url.replace('.webp', '-thumb.webp'), headers: { cookie } });
    expect(thumb.statusCode).toBe(200);
  });

  it('rejects files that are not images, whatever their content type says', async () => {
    const res = await uploadFile('evil.png', 'image/png', Buffer.from('<script>alert(1)</script>'));
    expect(res.statusCode).toBe(400);
  });

  it('requires a session to view wallpapers', async () => {
    const board = (await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie } })).json<{ board: Board }>().board;
    const res = await app.inject({ method: 'GET', url: board.backgroundImage! });
    expect(res.statusCode).toBe(401);
  });

  it('deletes the old files when replaced or removed', async () => {
    const dir = path.join(dataDir, 'backgrounds');
    const jpg = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#ff6600' } }).jpeg().toBuffer();
    expect((await uploadFile('a.jpg', 'image/jpeg', jpg)).statusCode).toBe(200);
    expect(fs.readdirSync(dir)).toHaveLength(2);
    const removed = await app.inject({ method: 'DELETE', url: `/api/boards/${boardId}/background`, payload: {}, headers: { cookie } });
    expect(removed.json<Patch>().board!.backgroundImage).toBeNull();
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });

  it('accepts custom gradient colors and refuses arbitrary CSS', async () => {
    const ok = await app.inject({ method: 'PATCH', url: `/api/boards/${boardId}`, payload: { color: 'gradient:#112233:#445566:45' }, headers: { cookie } });
    expect(ok.statusCode).toBe(200);
    const bad = await app.inject({ method: 'PATCH', url: `/api/boards/${boardId}`, payload: { color: 'url(https://evil.example/x.png)' }, headers: { cookie } });
    expect(bad.statusCode).toBe(400);
  });
});
