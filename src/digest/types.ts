export type RunStatus = 'ok' | 'retry' | 'fail';

/** One line of `runs/<night>.jsonl`. */
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

/** One job's night: every line for that job folded into one row. */
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

/** A parsed night. `badLines` counts lines that did not parse; they are never thrown. */
export type Night = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

/**
 * Reads `<runsDir>/<night>.jsonl`. Rows are sorted by job.
 * Returns `null` when the night has no file; an empty file gives `rows: []`.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;
