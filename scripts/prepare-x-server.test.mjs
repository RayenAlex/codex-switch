import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { verifyXServerArchive } from './prepare-x-server.mjs';

test('does not extract an unverified X server executable', () => {
  assert.throws(() => verifyXServerArchive(Buffer.from('untrusted installer')), /checksum mismatch/);
});
