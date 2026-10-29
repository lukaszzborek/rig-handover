import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const line = (at: string, job: string, status: string, owner: string | null = 'ops') =>
  JSON.stringify({ at, job, status, owner });

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-digest-'));
  fs.writeFileSync(
    path.join(runsDir, '2026-01-01.jsonl'),
    [
      line('2026-01-01T01:00:00+01:00', 'zeta-backup', 'ok'),
      line('2026-01-01T01:05:00+01:00', 'alpha-sync', 'retry'),
      line('2026-01-01T01:10:00+01:00', 'alpha-sync', 'ok'),
      line('2026-01-01T02:00:00+01:00', 'mid-report', 'fail'),
    ].join('\n') + '\n',
  );
  fs.writeFileSync(path.join(runsDir, '2026-01-02.jsonl'), '');
  fs.writeFileSync(
    path.join(runsDir, '2026-01-03.jsonl'),
    [line('2026-01-03T01:00:00+01:00', 'alpha-sync', 'ok'), 'this is not json'].join('\n') + '\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

afterAll(() => {
  fs.rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('renders a night with a file', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of ['alpha-sync', 'mid-report', 'zeta-backup']) expect(html).toContain(job);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-01-09');
    expect(res.status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders a night with a bad line', async () => {
    const res = await app.request('/digest/2026-01-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('alpha-sync');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the night as JSON', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-01-01');
    expect(body.rows.map((r) => r.job)).toEqual(['alpha-sync', 'mid-report', 'zeta-backup']);
    expect(body.badLines).toBe(0);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-01-09');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('returns no rows for an empty night', async () => {
    const res = await app.request('/api/digest/2026-01-02');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
  });

  it('counts a bad line and still answers 200', async () => {
    const res = await app.request('/api/digest/2026-01-03');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
  });
});

describe('page and JSON agree', () => {
  it('lists jobs in the same order', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    const body = (await (await app.request('/api/digest/2026-01-01')).json()) as Night;
    const positions = body.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
