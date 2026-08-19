/**
 * Creates the **first** admin account (§12, step 1).
 *
 *     node scripts/seed-admin.mjs --local
 *     node scripts/seed-admin.mjs --remote
 *
 * A one-off. Every account after this one comes from an invitation sent inside
 * the panel; this exists only because the invite flow needs somebody to send the
 * first invitation, and there is no public sign-up to bootstrap from.
 *
 * ## What it does, and why it is a script rather than a route
 *
 * It writes the same two rows Better Auth's sign-up would — a `user` and a
 * credential `account` — hashing the password with **Better Auth's own
 * `hashPassword`**, imported from the installed package. That is the whole
 * reason this is JavaScript talking to Wrangler rather than a SQL file: the
 * stored hash has to be exactly what Better Auth's sign-in verifier expects,
 * and an account whose hash was produced by anything else is an account that
 * can never sign in.
 *
 * Being a script rather than a `/admin/setup` route means there is no
 * bootstrap endpoint sitting on the public internet waiting to be found the day
 * someone deletes the last user. Running it needs the repository, the Wrangler
 * credentials, and a shell.
 *
 * ## Neither the password nor the hash is passed on a command line
 *
 * The password is read from stdin with echo off, and the hash reaches D1 in a
 * parameterised statement (`--command` with `?` placeholders is not available,
 * so the SQL is written to a temporary file and applied with `--file`; the
 * value is single-quote escaped). Passing a password as an argument would put
 * it in the shell history and in the process list.
 *
 * ## It refuses to run twice
 *
 * If any user already exists it stops. The first admin is a bootstrap, not a
 * back door for adding accounts that bypass the invitation trail.
 */

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { hashPassword } from 'better-auth/crypto';

const DB = 'nusukhelp-db';
const MIN_PASSWORD_LENGTH = 12;

/**
 * Wrangler's own entry script, run with this Node rather than through `npx`.
 *
 * `npx` on Windows is `npx.cmd`, and since Node 20.12 spawning a `.cmd` without
 * `shell: true` fails with `EINVAL` — the fix for the BatBadBut argument
 * injection issue. Turning the shell back on is the wrong way out: with
 * `shell: true` Node concatenates the arguments into a command line instead of
 * passing them through, and `--command "SELECT COUNT(*) AS n FROM user;"`
 * reaches Wrangler as a dozen separate words. Running the JS entry point with
 * `process.execPath` sidesteps both: no shell, arguments passed verbatim, and
 * nothing here can be read as shell syntax.
 *
 * The path is built rather than `require.resolve`d, because `bin/wrangler.js`
 * is not in the package's `exports` map and resolution therefore refuses it.
 */
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRANGLER = path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js');

/* -------------------------------------------------------------------------- */

const remote = process.argv.includes('--remote');
const local = process.argv.includes('--local');

if (remote === local) {
  fail('Pass exactly one of --local or --remote.');
}

const target = remote ? '--remote' : '--local';

/**
 * Runs a `wrangler d1` command and returns its stdout.
 *
 * `stdio: 'pipe'` on the JSON queries so the result can be parsed; failures
 * print Wrangler's own stderr, which is more useful than anything this script
 * could say about them.
 */
function d1(args) {
  const result = spawnSync(
    process.execPath,
    [WRANGLER, 'd1', ...args],
    { encoding: 'utf8' },
  );

  if (result.error) {
    fail(`Could not run wrangler: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    process.stderr.write(result.stdout ?? '');
    fail('wrangler failed.');
  }

  return result.stdout ?? '';
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

/** Single quotes doubled — the SQLite escape for a string literal. */
function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * **One** readline interface for the whole run, not one per question.
 *
 * Creating a fresh interface per prompt works at a terminal and silently loses
 * input when stdin is a pipe: the first interface reads a whole chunk into its
 * buffer, and closing it discards everything after the first line, so the
 * second question sees end-of-input and the script stops with a half-asked
 * form. Sharing one interface makes the script scriptable as well as
 * interactive, which is how it gets tested.
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: process.stdin.isTTY === true,
});

/**
 * When true, the interface writes nothing to the terminal — this is how the
 * password prompts avoid echoing. `readline` offers no supported way to do it,
 * so its private `_writeToOutput` is wrapped once here rather than swapped in
 * and out around each question.
 */
let muted = false;
const writeToOutput = rl._writeToOutput?.bind(rl);
rl._writeToOutput = (text) => {
  if (muted) return;
  writeToOutput?.(text);
};

/**
 * Lines are taken from a queue fed by the `line` event, not from
 * `rl.question`.
 *
 * `rl.question` answers exactly once when stdin is a pipe: the whole input
 * arrives in a single chunk, readline emits every `line` synchronously, and the
 * callbacks for questions that have not been asked yet do not exist — so the
 * second prompt waits forever on input that was already delivered and dropped.
 * Buffering the lines as they arrive and handing them out on demand behaves the
 * same at a terminal and makes the script scriptable, which is how it gets
 * tested.
 */
const lines = [];
const waiting = [];

rl.on('line', (line) => {
  const waiter = waiting.shift();
  if (waiter) waiter(line);
  else lines.push(line);
});

rl.on('close', () => {
  while (waiting.length) waiting.shift()(null);
});

function nextLine() {
  if (lines.length > 0) return Promise.resolve(lines.shift());
  return new Promise((resolve) => waiting.push(resolve));
}

async function ask(question) {
  process.stdout.write(question);

  const line = await nextLine();
  if (line === null) fail('Input ended before the form was complete.');

  return line.trim();
}

/**
 * Reads a line without echoing it.
 *
 * Off a terminal — a CI runner, a piped invocation — there is nothing on screen
 * to hide and nothing to mute.
 */
async function askSecret(question) {
  process.stdout.write(question);

  if (!rl.terminal) {
    const line = await nextLine();
    if (line === null) fail('Input ended before the form was complete.');
    return line;
  }

  muted = true;
  try {
    const line = await nextLine();
    if (line === null) fail('Input ended before the form was complete.');
    return line;
  } finally {
    muted = false;
    process.stdout.write('\n');
  }
}

/* -------------------------------------------------------------------------- */

async function main() {
  console.log(
    `\nAl Haramain Reservation — first admin account (${remote ? 'REMOTE' : 'local'})\n`,
  );

  /* ---- Refuse to run twice --------------------------------------------- */
  const existing = d1([
    'execute',
    DB,
    target,
    '--json',
    '--command',
    'SELECT COUNT(*) AS n FROM user;',
  ]);

  let count = 0;
  try {
    const parsed = JSON.parse(existing);
    count = parsed?.[0]?.results?.[0]?.n ?? 0;
  } catch {
    fail(
      'Could not read the user table. Has the migration been applied?\n' +
        `  npx wrangler d1 migrations apply ${DB} ${target}`,
    );
  }

  if (count > 0) {
    fail(
      `There ${count === 1 ? 'is already 1 account' : `are already ${count} accounts`} in this database.\n` +
        'Invite further staff from /admin/settings/users instead.',
    );
  }

  /* ---- Collect ---------------------------------------------------------- */
  const name = await ask('Full name:        ');
  if (name.length < 2) fail('A name is required.');

  const email = (await ask('Email:            ')).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('That is not an email address.');

  const password = await askSecret(
    `Password (min ${MIN_PASSWORD_LENGTH}): `,
  );
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const confirm = await askSecret('Confirm password: ');
  if (confirm !== password) fail('The two passwords do not match.');

  /* ---- Write ------------------------------------------------------------ */
  const userId = randomUUID();
  const accountId = randomUUID();
  const now = Math.floor(Date.now() / 1000); // Unix seconds — §8.
  const hash = await hashPassword(password);

  // `local:credential` is the issuer Better Auth 1.7 stamps on a password
  // account (`createLocalAccountIssuer('credential')`), and the unique index on
  // (issuer, account_id) depends on it being exactly this.
  const sql = [
    'INSERT INTO user (id, name, email, email_verified, role, is_active, created_at, updated_at)',
    `VALUES (${sqlString(userId)}, ${sqlString(name)}, ${sqlString(email)}, 1, 'admin', 1, ${now}, ${now});`,
    'INSERT INTO account (id, user_id, issuer, account_id, provider_id, password, created_at, updated_at)',
    `VALUES (${sqlString(accountId)}, ${sqlString(userId)}, 'local:credential', ${sqlString(userId)}, 'credential', ${sqlString(hash)}, ${now}, ${now});`,
  ].join('\n');

  const file = path.join(os.tmpdir(), `seed-admin-${randomUUID()}.sql`);
  fs.writeFileSync(file, sql, { mode: 0o600 });

  try {
    d1(['execute', DB, target, '--file', file]);
  } finally {
    // The file holds a password hash. It does not outlive this process.
    fs.rmSync(file, { force: true });
  }

  console.log(`\nCreated ${email} as Admin.`);
  console.log('Sign in at /admin/login and invite the rest of the team.\n');
}

main()
  .then(() => rl.close())
  .catch((error) => {
    rl.close();
    console.error(error);
    process.exit(1);
  });
