// Optional live fixture: SSH_FIXTURE_CONFIG points to a disposable WSL SSH server's JSON configuration.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const configPath = process.env.SSH_FIXTURE_CONFIG;
if (!configPath) throw new Error('SSH_FIXTURE_CONFIG must reference a disposable test server');
const binary = process.env.SSH_FIXTURE_BRIDGE ?? `${root}/.codex-tmp/ssh-target/debug/examples/bridge.exe`;
const bridge = spawn(binary, [], { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
const pending = new Map();
const streams = new Map();
const sessions = new Map();
let sequence = 0;
createInterface({ input: bridge.stdout }).on('line', line => {
  const value = JSON.parse(line);
  if (value.event) { streams.get(value.stream)?.push(value.event); return; }
  const request = pending.get(value.id);
  if (!request) return;
  pending.delete(value.id);
  if (value.error) request.reject(new Error(value.error));
  else {
    if (value.data?.id) sessions.set(value.data.id, streams.get(value.id));
    request.resolve(value.data);
  }
});
bridge.on('exit', () => {
  for (const request of pending.values()) request.reject(new Error('SSH fixture exited'));
  pending.clear();
});
function rpc(request) {
  const id = ++sequence;
  if (request.type === 'open') streams.set(id, []);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    bridge.stdin.write(`${JSON.stringify({ id, request })}\n`);
  });
}
const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:1488');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');
  if (request.method === 'OPTIONS') { response.end(); return; }
  try {
    if (request.url === '/reset') {
      for (const id of sessions.keys()) await rpc({ type: 'command', request: { type: 'close', id } });
      sessions.clear(); streams.clear(); response.end('{}'); return;
    }
    if (request.url === '/config') { response.end(readFileSync(configPath)); return; }
    let body = '';
    for await (const part of request) {
      body += part;
      if (body.length > 8 * 1024 * 1024) throw new Error('Fixture request too large');
    }
    const input = JSON.parse(body);
    if (request.url === '/read') {
      const output = sessions.get(input.id);
      response.end(JSON.stringify({ found: !!output, events: output?.slice(input.cursor) ?? [],
        cursor: output?.length ?? 0, truncated: false }));
    } else response.end(JSON.stringify({ data: await rpc(input) }));
  } catch (error) { response.end(JSON.stringify({ error: error.message })); }
});
server.listen(Number(process.env.SSH_FIXTURE_PORT ?? 1498), '127.0.0.1',
  () => process.stdout.write('SSH fixture bridge ready\n'));
const stop = () => { bridge.kill(); server.close(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
