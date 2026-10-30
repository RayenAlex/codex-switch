import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';

async function scenario(commands, expected, options = {}) {
  const { failure, headless } = options;
  const child = spawn(process.argv[2], [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...(failure ? { [`PRIVACY_TEST_${failure}_RETRY`]: '1' } : {}),
      ...(headless ? { PRIVACY_TEST_HEADLESS: '1' } : {}) } });
  let log = '';
  child.stderr.on('data', data => { log += data; });
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const ended = once(child, 'exit');
  assert.equal((await lines.next()).value, 'test-display');
  for (const command of commands) {
    if (command === 'EOF') { child.stdin.end(); break; }
    child.stdin.write(`${command}\n`);
    if (command === 'commit' || command === 'disable') assert.equal((await lines.next()).value, 'ok');
  }
  const timer = setTimeout(() => child.kill(), 5000);
  try { assert.equal((await ended)[0], failure ? 1 : 0); } finally { clearTimeout(timer); }
  assert.deepEqual(log.trim().split(/\r?\n/).filter(line => !line.startsWith('privacy ')), expected);
}
await scenario(['EOF'], ['prepare', 'restore']);
await scenario(['commit', 'disable'], ['prepare', 'disconnect', 'restore']);
await scenario(['commit', 'EOF'], ['prepare', 'disconnect', 'lock-confirmed', 'restore']);
await scenario(['commit'], ['prepare', 'disconnect', 'lock-confirmed', 'restore']);
await scenario(['commit', 'finish'], ['prepare', 'disconnect', 'lock-confirmed', 'restore']);
await scenario(['commit', 'EOF'],
  ['prepare', 'disconnect', 'lock-pending', 'lock-confirmed', 'restore'], { failure: 'LOCK' });
for (const commands of [['commit', 'EOF'], ['commit']]) {
  await scenario(commands,
    ['prepare', 'disconnect', 'lock-confirmed', 'restore-pending', 'unlock', 'restore'], { failure: 'RESTORE' });
  await scenario(commands,
    ['prepare', 'disconnect', 'lock-confirmed', 'restore', 'release-pending', 'unlock'], { failure: 'RELEASE' });
  await scenario(commands, ['prepare', 'disconnect', 'lock-confirmed', 'retain-display'], { headless: true });
}
await scenario(['commit', 'disable'], ['prepare', 'disconnect', 'retain-display'], { headless: true });
console.log('Privacy guardian: rollback, disable, EOF, timeout and recovery without repeated locking passed.');
