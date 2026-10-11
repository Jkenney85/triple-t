import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { BoardState, Patch } from '@triple-t/shared';
import { bootstrapAdmin } from './auth';
import { buildApp } from './app';
import { openDb } from './db';
import { loadConfig } from './env';

let app: FastifyInstance;
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
  const db = openDb(':memory:');
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
