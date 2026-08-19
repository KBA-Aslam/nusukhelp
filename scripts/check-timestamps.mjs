/**
 * Asserts that **no timestamp column in the database stores milliseconds**
 * (SPEC §8, *Timestamps*; §19 open item 21).
 *
 *     npm run check:timestamps:local
 *     npm run check:timestamps:remote
 *
 * Exits non-zero, naming every offending table, column and value, if any
 * timestamp holds a number large enough to be milliseconds.
 *
 * ## Why it reads the schema out of the database
 *
 * The columns are discovered by walking `sqlite_master` and `pragma_table_info`,
 * not from a list kept in this file. A hand-maintained list would
 * be correct on the day it was written and silently incomplete from Phase 9
 * onwards — bookings, payments, reminders and the audit log all arrive with
 * their own `created_at`, and the check that matters most is the one on a table
 * nobody remembered to add here. Whatever is in the database is what gets
 * checked.
 *
 * A column counts as a timestamp if it is declared `INTEGER` and its name ends
 * in `_at` or is one of the handful of exceptions named below. That is a
 * convention rather than a guarantee, which is why `EXTRA_COLUMNS` exists and
 * why adding a differently named time column means adding it there — the
 * failure mode is a missed check, so the convention is stated in the spec too.
 *
 * ## `pragma_table_info(...)`, not `PRAGMA table_info(...)`
 *
 * The table-valued form, because it is a `SELECT`. The bare statement works
 * against remote D1 and is refused by the local one with
 * `not authorized: SQLITE_AUTH` — miniflare runs queries through SQLite's
 * authorizer, which rejects PRAGMA statements. The function form passes both,
 * so one script covers both databases.
 *
 * ## The threshold
 *
 * 1e11 seconds is the year 5138; 1e11 milliseconds is March 1973. Every
 * timestamp this system will hold is far below it in seconds and far above it
 * in milliseconds. Mirrors `MILLISECOND_THRESHOLD` in `src/lib/time.ts`.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DB = 'nusukhelp-db';
const MILLISECOND_THRESHOLD = 100_000_000_000;

/** Time columns whose names do not end in `_at`. */
const EXTRA_COLUMNS = new Set(['window_start']);

/**
 * Tables the platform owns; not ours to police.
 *
 * The `_cf_` prefix is matched rather than listed. Cloudflare's own tables vary
 * between the local database and the remote one — the local Miniflare instance
 * carries `_cf_METADATA` as well as `_cf_KV` — and SQLite's authorizer refuses
 * to introspect them at all, so a missing name here is not a skipped check but
 * a hard `SQLITE_AUTH` failure. Matching the prefix means a new internal table
 * cannot break this script.
 */
function isPlatformTable(name) {
  return (
    name.startsWith('_cf_') ||
    name.startsWith('sqlite_') ||
    name === 'd1_migrations'
  );
}

// See the note in scripts/seed-admin.mjs: `npx` is `npx.cmd` on Windows, which
// Node refuses to spawn without a shell, and a shell would mangle the SQL.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRANGLER = path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js');

const remote = process.argv.includes('--remote');
const local = process.argv.includes('--local');

if (remote === local) {
  console.error('\nPass exactly one of --local or --remote.\n');
  process.exit(1);
}

const target = remote ? '--remote' : '--local';

function query(sql) {
  const result = spawnSync(
    process.execPath,
    [WRANGLER, 'd1', 'execute', DB, target, '--json', '--command', sql],
    { encoding: 'utf8' },
  );

  if (result.error) {
    console.error(`\nCould not run wrangler: ${result.error.message}\n`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    process.stderr.write(result.stdout ?? '');
    // Naming the statement matters: every query here is generated from the
    // schema, so a bare "wrangler failed" leaves you guessing which table.
    console.error(`\nwrangler failed on: ${sql}\n`);
    process.exit(1);
  }

  try {
    return JSON.parse(result.stdout)?.[0]?.results ?? [];
  } catch {
    console.error(`\nCould not parse the response to: ${sql}\n`);
    process.exit(1);
  }
}

function isTimestampColumn(column) {
  if (!/^INTEGER$/i.test(column.type)) return false;
  return column.name.endsWith('_at') || EXTRA_COLUMNS.has(column.name);
}

function main() {
  const tables = query(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;",
  )
    .map((row) => row.name)
    .filter((name) => !isPlatformTable(name));

  const failures = [];
  let checked = 0;

  for (const table of tables) {
    const columns = query(
      `SELECT name, type FROM pragma_table_info('${table}');`,
    ).filter(isTimestampColumn);

    for (const column of columns) {
      checked += 1;

      // MAX ignores NULLs, so a column nothing has written yet reports null and
      // passes — which is correct: there is no wrong value in it.
      const [row] = query(
        `SELECT MAX(${column.name}) AS worst, COUNT(${column.name}) AS n FROM ${table};`,
      );

      const worst = row?.worst ?? null;
      if (worst !== null && worst > MILLISECOND_THRESHOLD) {
        failures.push({ table, column: column.name, worst, rows: row.n });
      }
    }
  }

  console.log(
    `\nChecked ${checked} timestamp column${checked === 1 ? '' : 's'} across ` +
      `${tables.length} table${tables.length === 1 ? '' : 's'} ` +
      `(${remote ? 'remote' : 'local'}).`,
  );

  if (failures.length === 0) {
    console.log('All timestamps are Unix seconds.\n');
    return;
  }

  console.error('\nMilliseconds found where seconds are required (SPEC §8):\n');
  for (const f of failures) {
    console.error(
      `  ${f.table}.${f.column} — largest value ${f.worst} across ${f.rows} row(s)`,
    );
  }
  console.error(
    '\nWrite through nowSeconds() in src/lib/time.ts, and convert the stored\n' +
      'values the way drizzle/migrations/0002_timestamps_to_seconds.sql does.\n',
  );
  process.exit(1);
}

main();
