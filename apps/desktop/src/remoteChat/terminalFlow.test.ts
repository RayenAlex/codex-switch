import { expect, it, vi } from 'vitest';
import { TerminalFlow } from './terminalFlow';
import { TerminalOutput } from './terminalOutput';
import { terminalApi } from '../pages/codexGui/terminal/api';

vi.mock('../pages/codexGui/terminal/api', () => ({ terminalApi: {
  outputFlow: vi.fn(async () => {}), outputAck: vi.fn(async () => {}),
} }));

it('acknowledges a transfer cursor once and isolates other viewers and stale cleanup', async () => {
  vi.clearAllMocks();
  const output = new TerminalOutput();
  const flow = new TerminalFlow('ssh-test', output);
  await flow.mode('first', true);
  output.push({ type: 'output', data: [0, 255, 24, 10] });
  flow.deliveredThrough(output.read(0).cursor);
  await flow.read(1, 'another');
  expect(terminalApi.outputAck).not.toHaveBeenCalled();
  await flow.read(1, 'first'); await flow.read(1, 'first');
  expect(vi.mocked(terminalApi.outputAck).mock.calls.map(call => call[1])).toEqual([4, 0]);
  expect(() => flow.mode('second', true)).toThrow('client.ssh.conflict');
  await flow.mode('first', false); await flow.mode('second', true); await flow.mode('first', false);
  expect(terminalApi.outputFlow).toHaveBeenCalledTimes(3);
  expect(terminalApi.outputFlow).toHaveBeenLastCalledWith('ssh-test', true);
});

it('retains an entire credit window of tiny SSH packets without overflowing the history event limit', async () => {
  const output = new TerminalOutput();
  await new TerminalFlow('ssh-test', output).mode('first', true);
  for (let index = 0; index < 64 * 1024; index++) output.push({ type: 'output', data: [index % 256] });
  const first = output.read(0); const second = output.read(first.cursor);
  expect(first.truncated || second.truncated).toBe(false);
  const bytes = [...first.events, ...second.events].flatMap(event => event.type === 'output' ? event.data : []);
  expect(bytes).toEqual(Array.from({ length: 64 * 1024 }, (_, index) => index % 256));
  output.push({ type: 'output', data: [42] });
  expect(output.read(second.cursor).events).toEqual([{ type: 'output', data: [42] }]);
});
