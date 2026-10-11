import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { BoardState, Patch } from '@triple-t/shared';
import { bootstrapAdmin } from './auth';
import { buildApp } from './app';
import { openDb } from './db';
import { loadConfig } from './env';

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let cookie = '';
let board: BoardState;
const todo = () => board.columns.find((c) => c.name === 'To Do')!;
const inProgress = () => board.columns.find((c) => c.name === 'In Progress')!;
const done = () => board.columns.find((c) => c.isDone)!;

async function call<T = Patch>(method: string, url: string, payload?: unknown): Promise<{ status: number; body: T }> {
  const res = await app.inject({ method: method as 'GET', url, payload: payload as object, headers: { cookie } });
  return { status: res.statusCode, body: res.json() as T };
}

beforeAll(async () => {
  const config = loadConfig({ NODE_ENV: 'test', DATA_DIR: '/tmp/triple-t-test', TZ: 'America/Chicago' });
  db = openDb(':memory:');
  await bootstrapAdmin(db, 'admin', 'correct-horse-battery', { info: () => {} });
  ({ app } = await buildApp(db, config, { realtime: false }));
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: 'correct-horse-battery' } });
  cookie = String(login.headers['set-cookie']).split(';')[0];
  const created = await call<{ board: { id: number } }>('POST', '/api/boards', { name: 'Test', color: 'ocean' });
  board = (await call<BoardState>('GET', `/api/boards/${created.body.board.id}`)).body;
});

afterAll(async () => {
  await app.close();
});

describe('new boards', () => {
  it('are seeded with To Do / In Progress / Done and the default metric fields', () => {
    expect(board.columns.map((c) => [c.name, c.isDone])).toEqual([
      ['To Do', false],
      ['In Progress', false],
      ['Done', true],
    ]);
    expect(board.fields.map((f) => `${f.name}:${f.type}:${f.totalMode}`)).toEqual([
      'Views:number:sum',
      'CTR:percent:avg',
      'Sales:number:sum',
      'GMV:currency:sum',
    ]);
  });
});

describe('required fields (API)', () => {
  it('rejects a card without a title', async () => {
    const res = await call('POST', `/api/boards/${board.board.id}/cards`, { columnId: todo().id, title: ' ' });
    expect(res.status).toBe(400);
  });

  it('accepts a card with only a title', async () => {
    const res = await call('POST', `/api/boards/${board.board.id}/cards`, { columnId: todo().id, title: 'Just a title' });
    expect(res.status).toBe(200);
    expect(res.body.cards![0]).toMatchObject({ title: 'Just a title', notes: '', labelIds: [], dayOfWeek: null, createdBy: 1 });
  });

  it('rejects clearing the title on update', async () => {
    const { body } = await call('POST', `/api/boards/${board.board.id}/cards`, { columnId: todo().id, title: 'Keep me' });
    const res = await call('PATCH', `/api/cards/${body.cards![0].id}`, { title: '' });
    expect(res.status).toBe(400);
  });
});

describe('moving into the Done column clears the day (server-enforced)', () => {
  it('clears the day on move into Done', async () => {
    const { body } = await call('POST', `/api/boards/${board.board.id}/cards`, { columnId: todo().id, title: 'Wed card', dayOfWeek: 3 });
    const id = body.cards![0].id;
    expect(body.cards![0].dayOfWeek).toBe(3);

    const moved = await call('POST', `/api/cards/${id}/move`, { columnId: inProgress().id, position: 10 });
    expect(moved.body.cards![0].dayOfWeek).toBe(3);

    const intoDone = await call('POST', `/api/cards/${id}/move`, { columnId: done().id, position: 10 });
    expect(intoDone.status).toBe(200);
    expect(intoDone.body.cards![0]).toMatchObject({ columnId: done().id, dayOfWeek: null });

    const back = await call('POST', `/api/cards/${id}/move`, { columnId: todo().id, position: 10 });
    expect(back.body.cards![0].dayOfWeek).toBeNull();
  });

  it('ignores a day set directly on a card in Done', async () => {
    const { body } = await call('POST', `/api/boards/${board.board.id}/cards`, { columnId: done().id, title: 'Done card', dayOfWeek: 2 });
    expect(body.cards![0].dayOfWeek).toBeNull();
    const res = await call('PATCH', `/api/cards/${body.cards![0].id}`, { dayOfWeek: 4 });
    expect(res.body.cards![0].dayOfWeek).toBeNull();
  });

  it('clears days when a list with cards becomes the Done list', async () => {
    const { body } = await call('POST', `/api/boards/${board.board.id}/cards`, { columnId: inProgress().id, title: 'Fri card', dayOfWeek: 5 });
    const res = await call('PUT', `/api/boards/${board.board.id}/done-column`, { columnId: inProgress().id });
    expect(res.body.cards!.find((c) => c.id === body.cards![0].id)?.dayOfWeek).toBeNull();
    // restore the original Done list for other tests
    await call('PUT', `/api/boards/${board.board.id}/done-column`, { columnId: board.columns[2].id });
  });

  it('applies the rule when a deleted list moves its cards into Done', async () => {
    const col = (await call('POST', `/api/boards/${board.board.id}/columns`, { name: 'Temp' })).body.columns![0];
    const { body } = await call('POST', `/api/boards/${board.board.id}/cards`, { columnId: col.id, title: 'Sat card', dayOfWeek: 6 });
    const refused = await call('DELETE', `/api/columns/${col.id}`, {});
    expect(refused.status).toBe(409);
    const res = await call('DELETE', `/api/columns/${col.id}`, { moveTo: board.columns[2].id });
    expect(res.status).toBe(200);
    expect(res.body.cards!.find((c) => c.id === body.cards![0].id)).toMatchObject({ columnId: board.columns[2].id, dayOfWeek: null });
  });
});

describe('comments on videos', () => {
  async function cardWithVideo(title: string) {
    const { body } = await call('POST', `/api/boards/${board.board.id}/cards`, { columnId: todo().id, title });
    const cardId = body.cards![0].id;
    // A non-resolvable TikTok URL is fine: the background metadata fetch just records an error.
    const v = await call('POST', `/api/cards/${cardId}/videos`, { url: 'https://www.tiktok.com/@nobody/video/1' });
    return { cardId, videoId: v.body.videos![0].id };
  }

  it('adds a comment to a specific video', async () => {
    const { cardId, videoId } = await cardWithVideo('Commented');
    const res = await call('POST', `/api/videos/${videoId}/comments`, { body: 'Great hook in the first 2s' });
    expect(res.status).toBe(200);
    expect(res.body.comments![0]).toMatchObject({ cardId, videoId, body: 'Great hook in the first 2s', userId: 1 });
    const state = (await call<BoardState>('GET', `/api/boards/${board.board.id}`)).body;
    expect(state.comments.filter((c) => c.videoId === videoId)).toHaveLength(1);
  });

  it('no longer accepts new card-level comments', async () => {
    const { cardId } = await cardWithVideo('No card comments');
    expect((await call('POST', `/api/cards/${cardId}/comments`, { body: 'hi' })).status).toBe(404);
  });

  it('deletes a video’s comments with the video, leaving earlier card comments alone', async () => {
    const { cardId, videoId } = await cardWithVideo('Delete video');
    const c = (await call('POST', `/api/videos/${videoId}/comments`, { body: 'bye' })).body.comments![0];
    // An earlier card-level comment, as created before comments moved onto videos
    db.$client.prepare('insert into comments (card_id, user_id, body) values (?, 1, ?)').run(cardId, 'legacy');

    const res = await call('DELETE', `/api/videos/${videoId}`, {});
    expect(res.status).toBe(200);
    expect(res.body.removed?.comments).toEqual([c.id]);
    const left = db.$client.prepare('select body, video_id as videoId from comments where card_id = ?').all(cardId);
    expect(left).toEqual([{ body: 'legacy', videoId: null }]);
  });
});

describe('monthly video metrics', () => {
  it('stores each month separately and requires a month', async () => {
    const { body } = await call('POST', `/api/boards/${board.board.id}/cards`, { columnId: todo().id, title: 'Monthly' });
    const videoId = (await call('POST', `/api/cards/${body.cards![0].id}/videos`, { url: 'https://www.tiktok.com/@nobody/video/2' })).body.videos![0].id;
    const views = board.fields.find((f) => f.name === 'Views')!.id;

    expect((await call('PATCH', `/api/videos/${videoId}`, { values: { [views]: '10' } })).status).toBe(400);
    expect((await call('PATCH', `/api/videos/${videoId}`, { month: '2026-13', values: { [views]: '10' } })).status).toBe(400);

    await call('PATCH', `/api/videos/${videoId}`, { month: '2026-09', values: { [views]: '1,000' } });
    const res = await call('PATCH', `/api/videos/${videoId}`, { month: '2026-10', values: { [views]: '500' } });
    expect(res.body.videos![0].months).toEqual({ '2026-09': { [views]: '1000' }, '2026-10': { [views]: '500' } });

    const cleared = await call('PATCH', `/api/videos/${videoId}`, { month: '2026-09', values: { [views]: '' } });
    expect(cleared.body.videos![0].months).toEqual({ '2026-10': { [views]: '500' } });
  });
});

describe('label colors', () => {
  it('accepts solid and gradient label colors and rejects raw CSS', async () => {
    const boardId = board.board.id;
    const solid = await call('POST', `/api/boards/${boardId}/labels`, { name: 'Solid', color: '#4bce97' });
    expect(solid.status).toBe(200);
    const grad = await call('POST', `/api/boards/${boardId}/labels`, { name: 'Fade', color: 'gradient:#ff5f6d:#ffc371:90' });
    expect(grad.body.labels![0].color).toBe('gradient:#ff5f6d:#ffc371:90');
    expect((await call('POST', `/api/boards/${boardId}/labels`, { name: 'Bad', color: 'linear-gradient(red, blue)' })).status).toBe(400);
  });
});

describe('list sort', () => {
  it('defaults to day of week and accepts only known sorts', async () => {
    const id = todo().id;
    expect(todo().sort).toBe('day');
    expect((await call('PATCH', `/api/columns/${id}`, { sort: 'title' })).body.columns![0].sort).toBe('title');
    expect((await call('PATCH', `/api/columns/${id}`, { sort: 'random' })).status).toBe(400);
    expect((await call('PATCH', `/api/columns/${id}`, { sort: 'day' })).body.columns![0].sort).toBe('day');
  });
});

describe('list colors', () => {
  it('sets, normalizes and clears a list color, and rejects anything else', async () => {
    const id = todo().id;
    expect((await call('PATCH', `/api/columns/${id}`, { color: '#579DFF' })).body.columns![0].color).toBe('#579dff');
    expect((await call('PATCH', `/api/columns/${id}`, { color: 'red' })).status).toBe(400);
    expect((await call('PATCH', `/api/columns/${id}`, { color: 'url(x)' })).status).toBe(400);
    expect((await call('PATCH', `/api/columns/${id}`, { color: null })).body.columns![0].color).toBeNull();
  });
});

describe('security', () => {
  it('requires a session', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/boards/${board.board.id}` });
    expect(res.statusCode).toBe(401);
  });

  it('blocks cross-origin mutations', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/boards',
      payload: { name: 'x' },
      headers: { cookie, origin: 'https://evil.example' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('refuses non-TikTok video URLs', async () => {
    const { body } = await call('POST', `/api/boards/${board.board.id}/cards`, { columnId: todo().id, title: 'Vid' });
    const res = await call('POST', `/api/cards/${body.cards![0].id}/videos`, { url: 'http://127.0.0.1:3000/healthz' });
    expect(res.status).toBe(400);
  });
});
