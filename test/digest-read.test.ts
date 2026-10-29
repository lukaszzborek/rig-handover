import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  const night = readNight('runs', '2026-10-28')!;
  const row = (job: string) => night.rows.find((r) => r.job === job)!;

  it('folds the real night into 5 jobs and counts the truncated line', () => {
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.badLines).toBe(1);
  });

  it('counts retries and takes the last line for status and error', () => {
    expect(row('fixtures/refresh')).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a row whose owner is null', () => {
    expect(row('digest/render').owner).toBeNull();
  });

  describe('edge files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it('returns null for a missing night', () => {
      expect(readNight(dir, '2000-01-01')).toBeNull();
    });

    it('gives no rows for an empty file', () => {
      writeFileSync(join(dir, '2000-01-02.jsonl'), '');
      expect(readNight(dir, '2000-01-02')).toEqual({ night: '2000-01-02', rows: [], badLines: 0 });
    });

    it('counts lines that parse but fail validation', () => {
      writeFileSync(
        join(dir, '2000-01-03.jsonl'),
        [
          '{"at":"2000-01-03T01:00:00+01:00","job":"a","status":"done","owner":"x"}',
          '{"at":"2000-01-03T01:00:00+01:00","job":"a","status":"ok","owner":7}',
          '[]',
          '{"at":"2000-01-03T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
        ].join('\n'),
      );
      const n = readNight(dir, '2000-01-03')!;
      expect(n.badLines).toBe(3);
      expect(n.rows).toHaveLength(1);
    });
  });
});
