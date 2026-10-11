import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');
const statements = (file: string) =>
  fs
    .readFileSync(path.join(dir, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

describe('0004 monthly metrics migration', () => {
  it('keeps existing values, filed under the month each video was last saved', () => {
    const db = new Database(':memory:');
    // Just enough of the pre-0004 schema
    db.exec(`
      create table videos (id integer primary key, updated_at integer not null);
      create table fields (id integer primary key);
      create table video_values (video_id integer not null, field_id integer not null, value text not null, primary key (video_id, field_id));
      insert into videos values (1, ${Date.UTC(2026, 9, 9, 15)}), (2, ${Date.UTC(2026, 8, 30, 12)});
      insert into fields values (1), (2);
      insert into video_values values (1, 1, '125000'), (1, 2, '4.2'), (2, 1, '48000');
    `);
    for (const sql of statements('0004_monthly_metrics.sql')) db.exec(sql);
    const rows = db.prepare('select video_id, field_id, month, value from video_values order by video_id, field_id').all();
    expect(rows).toEqual([
      { video_id: 1, field_id: 1, month: '2026-10', value: '125000' },
      { video_id: 1, field_id: 2, month: '2026-10', value: '4.2' },
      { video_id: 2, field_id: 1, month: '2026-09', value: '48000' },
    ]);
  });
});

describe('0006 due date outline migration', () => {
  it('turns the outline off only for Needs Recording lists', () => {
    const db = new Database(':memory:');
    db.exec(`
      create table columns (id integer primary key, name text not null);
      insert into columns values (1, 'To Do'), (2, 'Needs Recording'), (3, 'needs recording 🎥'), (4, 'Recorded');
    `);
    for (const sql of statements('0006_highlight_due.sql')) db.exec(sql);
    expect(db.prepare('select id, highlight_due as h from columns order by id').all()).toEqual([
      { id: 1, h: 1 },
      { id: 2, h: 0 },
      { id: 3, h: 0 },
      { id: 4, h: 1 },
    ]);
  });
});
