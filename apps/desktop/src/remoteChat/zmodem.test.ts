import { afterEach, expect, it, vi } from 'vitest';
import Zmodem from 'zmodem.js';
import { ZmodemTransfer } from '../../../../shared/terminal/zmodem';
import { ZmodemReceiver } from '../../../../shared/terminal/zmodemReceiver';
import { ZmodemWriter } from '../../../../shared/terminal/zmodemWriter';
import { zmodemFilename } from '../../../../shared/terminal/zmodemFilename';

afterEach(() => vi.useRealTimers());
const header = (name: string, offset?: number) => Zmodem.Header.build(name, ...(offset === undefined ? [] : [offset]));

function transfer() {
  const write = vi.fn(async (_bytes: number[]) => {});
  const change = vi.fn(); const output = vi.fn(); const file = vi.fn();
  return { write, change, output, file, controller: new ZmodemTransfer({ write, change, output, file }) };
}

it('detects fragmented sz headers without sending anything until accepted, then cancels and recovers', async () => {
  const { controller, write, change, output } = transfer();
  const bytes = header('ZRQINIT').to_hex();
  controller.output(bytes.slice(0, 7)); controller.output(bytes.slice(7));
  expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'offer', direction: 'receive' }));
  expect(write).not.toHaveBeenCalled();
  await controller.accept(); await Promise.resolve();
  expect(write).toHaveBeenCalled();
  controller.cancel();
  expect(controller.busy).toBe(false);
  controller.output([65, 66]); expect(output).toHaveBeenLastCalledWith([65, 66]);
  controller.dispose();
});

it('does not respond to retracted detections or downgrades printed as terminal text', () => {
  const { controller, write, change } = transfer();
  controller.output(header('ZRQINIT').to_hex()); controller.output([67]);
  expect(write).not.toHaveBeenCalled(); expect(change).toHaveBeenLastCalledWith(undefined);
  controller.dispose();
});

it('waits for lossless output delivery before responding and cancels a pending handshake', async () => {
  let release!: () => void;
  const binaryMode = vi.fn(async (_token: string, enabled: boolean) => {
    if (enabled) await new Promise<void>(resolve => { release = resolve; });
  });
  const write = vi.fn(async () => {});
  const controller = new ZmodemTransfer({ write, binaryMode, change: vi.fn(), output: vi.fn(), file: vi.fn() });
  controller.output(header('ZRQINIT').to_hex());
  const accepting = controller.accept();
  expect(write).not.toHaveBeenCalled();
  controller.disconnect(); release(); await accepting;
  expect(write).not.toHaveBeenCalled(); expect(controller.busy).toBe(false);
  expect(binaryMode).toHaveBeenLastCalledWith(binaryMode.mock.calls[0][0], false);
  controller.dispose();
});

it('disconnects and times out transfers without leaving stdin blocked or sending bytes after disconnect', async () => {
  vi.useFakeTimers();
  const { controller, write, change } = transfer();
  controller.output(header('ZRQINIT').to_hex()); await controller.accept(); await Promise.resolve();
  controller.disconnect(); write.mockClear();
  await vi.runAllTimersAsync();
  expect(write).not.toHaveBeenCalled(); expect(controller.busy).toBe(false);
  controller.output(header('ZRQINIT').to_hex()); await controller.accept();
  await vi.advanceTimersByTimeAsync(120_001);
  expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'error' }));
  controller.dispose();
});

it.each([16, 32] as const)('receives CRC%s binary bytes over multiple bounded windows and restores trailing output', crc => {
  const send = vi.fn(); const file = vi.fn(); const end = vi.fn(); const progress = vi.fn();
  const receiver = new ZmodemReceiver({ send, file, end, progress });
  const encoder = new Zmodem.ZDLE(); encoder.set_escape_ctrl_chars(true);
  const packet = (bytes: number[], ending: string) => {
    const value = Zmodem.Subpacket.build(bytes, ending);
    return crc === 16 ? value.encode16(encoder) : value.encode32(encoder);
  };
  const frame = (name: string, offset?: number) => crc === 16
    ? header(name, offset).to_binary16(encoder) : header(name, offset).to_binary32(encoder);
  const feed = (bytes: number[]) => { for (const byte of bytes) receiver.consume([byte]); };
  receiver.start();
  const init = send.mock.calls[0][0] as number[];
  expect(String.fromCharCode(...init)).toContain('0100800021');
  feed(frame('ZFILE')); feed(packet([...Buffer.from('../binary.bin\0' + '256 0\0')], 'end_ack'));
  feed(frame('ZDATA', 0)); feed(packet(Array.from({ length: 128 }, (_, i) => i), 'end_ack'));
  expect(String.fromCharCode(...send.mock.calls.at(-1)![0])).toContain('0380000000');
  feed(frame('ZDATA', 128)); feed(packet(Array.from({ length: 128 }, (_, i) => i + 128), 'end_no_ack'));
  feed(frame('ZEOF', 256)); feed(header('ZFIN').to_hex()); receiver.consume([79, 79, 36, 32]);
  expect(file).toHaveBeenCalledOnce(); expect(file.mock.calls[0][0]).toBe('binary.bin');
  expect(Buffer.concat(file.mock.calls[0][1]).equals(Buffer.from(Array.from({ length: 256 }, (_, i) => i)))).toBe(true);
  expect(end).toHaveBeenCalledWith([36, 32]);
});

it('rejects oversized offers, corrupt packets and executable command frames', () => {
  const create = () => new ZmodemReceiver({ send: vi.fn(), file: vi.fn(), end: vi.fn(), progress: vi.fn() });
  const encoder = new Zmodem.ZDLE(); encoder.set_escape_ctrl_chars(true);
  const receiver = create(); receiver.consume(header('ZFILE').to_hex());
  expect(() => receiver.consume(Zmodem.Subpacket.build([...Buffer.from('huge\0' + '999999999\0')], 'end_ack')
    .encode16(encoder))).toThrow('client.ssh.zmodemReceiveTooLarge');
  const corrupt = header('ZRQINIT').to_hex(); corrupt[10] = 49;
  expect(() => create().consume(corrupt)).toThrow();
  expect(() => create().consume(header('ZRPOS', 0).to_hex())).toThrow('client.ssh.zmodemFailed');
  expect(() => zmodemFilename('../..')).toThrow();
});

it('serializes binary writes with backpressure and drops queued file bytes on cancel', async () => {
  let release: (() => void) | undefined;
  const write = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
  const writer = new ZmodemWriter(write, vi.fn());
  writer.send(Array(20_000).fill(255)); await Promise.resolve();
  expect(write).toHaveBeenCalledTimes(1);
  writer.clear(); release!(); await writer.drain();
  expect(write).toHaveBeenCalledTimes(1);
  expect(() => writer.send(Array(300_000).fill(0))).toThrow('queue limit');
});
