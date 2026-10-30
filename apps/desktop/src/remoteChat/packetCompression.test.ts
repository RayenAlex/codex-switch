import { deflateRawSync } from 'node:zlib';
import { afterEach, expect, it, vi } from 'vitest';
import { keyPair, SessionCipher } from '../../../../shared/remote-chat/cipher';
import { CompressedPackets, isCompressedPacket } from '../../../../shared/remote-chat/compressedPackets';
import { compressedPacket, compressedPacketBody, MAX_PACKET_PLAIN_BYTES }
  from '../../../../shared/remote-chat/packetCompression';
import { decodeRelay, encodeRelay } from '../../../../shared/remote-chat/relayWire';
import { hotLinkHarness } from './hotLinkHarness';
import { testPacketCompression } from './compressionTestCodec';

const compression = { pc: testPacketCompression, phone: testPacketCompression };
const harnesses: ReturnType<typeof hotLinkHarness>[] = [];
afterEach(() => { harnesses.splice(0).forEach(harness => harness.close()); vi.useRealTimers(); });
function connected(options: Parameters<typeof hotLinkHarness>[0] = { compression }) {
  vi.useFakeTimers(); vi.setSystemTime(100_000);
  const harness = hotLinkHarness(options); harnesses.push(harness); return harness;
}

it.each(['direct', 'relay'] as const)('negotiates compression and delivers Unicode over %s with smaller packets', async path => {
  const harness = connected();
  if (path === 'relay') harness.paths.direct = false;
  await vi.advanceTimersByTimeAsync(4500);
  const event = { kind: 'event' as const, event: '中文😀代码与聊天正文 '.repeat(1000) };
  const sent = harness.links.pc.send(event);
  await vi.advanceTimersByTimeAsync(2500); await sent;
  expect(harness.messages.phone).toEqual([event]);
  const data = harness.packets.filter(packet => packet.side === 'pc' && packet.frame.kind === 'data');
  expect(data.length).toBeGreaterThan(1);
  expect(data.every(packet => packet.path === path && isCompressedPacket(packet.payload))).toBe(true);
  const encoded = data.reduce((sum, packet) => sum + packet.payload.length / 2, 0);
  const plain = data.reduce((sum, packet) => sum + Buffer.byteLength(JSON.stringify(packet.frame)), 0);
  expect(encoded).toBeLessThan(plain / 2);
  expect(harness.error).not.toHaveBeenCalled();
});

it.each(['pc', 'phone'] as const)('keeps both directions uncompressed when only %s supports the codec', async side => {
  const harness = connected({ compression: { [side]: testPacketCompression } });
  await vi.advanceTimersByTimeAsync(4500);
  for (const sender of ['pc', 'phone'] as const) {
    const pending = harness.links[sender].send({ kind: 'event', event: 'compatibility '.repeat(500) });
    await vi.advanceTimersByTimeAsync(1000); await pending;
  }
  expect(harness.messages.pc).toHaveLength(1); expect(harness.messages.phone).toHaveLength(1);
  expect(harness.packets.every(packet => !isCompressedPacket(packet.payload))).toBe(true);
  expect(harness.error).not.toHaveBeenCalled();
});

it('recovers independently compressed responses across lost fragments, retries and a path switch', async () => {
  const harness = connected();
  await vi.advanceTimersByTimeAsync(4500);
  harness.filter(packet => !(packet.path === 'direct' && packet.frame.kind === 'data' && packet.frame.sequence === 1));
  const history = { kind: 'response' as const, id: 'history', data: '恢复中文😀'.repeat(5000) };
  const pending = harness.links.pc.send(history);
  const reply = { kind: 'response' as const, id: 'live', data: 'independent reply' };
  void harness.links.pc.send(reply);
  await vi.advanceTimersByTimeAsync(300);
  expect(harness.messages.phone.map(message => message.kind === 'response' ? message.id : '')).toContain('live');
  harness.paths.direct = false;
  await vi.advanceTimersByTimeAsync(8000); await pending;
  expect(harness.messages.phone.filter(message => message.kind === 'response' && message.id === 'history'))
    .toEqual([history]);
  expect(harness.error).not.toHaveBeenCalled();
});

function packetPair() {
  const a = keyPair(size => crypto.getRandomValues(new Uint8Array(size)));
  const b = keyPair(size => crypto.getRandomValues(new Uint8Array(size)));
  return [new SessionCipher({ secret: a.secret, publicKey: b.publicKey, sessionId: 'codec', desktop: true }),
    new SessionCipher({ secret: b.secret, publicKey: a.publicKey, sessionId: 'codec', desktop: false })] as const;
}

it('authenticates the compression flag and length before decoding, and rejects duplicate work', async () => {
  const [sender, receiver] = packetPair();
  const codec = testPacketCompression()!;
  const decode = vi.spyOn(codec, 'decompress');
  const failed = vi.fn(); const accept = vi.fn();
  const output = new CompressedPackets(codec, receiver, failed);
  const plain = Buffer.from('authenticated '.repeat(100));
  const body = Buffer.concat([Buffer.from([plain.length >> 8, plain.length & 255]), deflateRawSync(plain)]);
  const packet = sender.encryptCompressed(body);
  expect(() => receiver.decrypt(packet.slice(0, 8) + '00000000' + packet.slice(16))).toThrow();
  const corrupted = packet.slice(0, -2) + (packet.endsWith('00') ? '01' : '00');
  expect(() => output.receive(corrupted, accept)).toThrow();
  expect(decode).not.toHaveBeenCalled();
  output.receive(packet, accept); output.receive(packet, accept);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(decode).toHaveBeenCalledOnce(); expect(accept).toHaveBeenCalledWith(plain.toString());
  expect(failed).not.toHaveBeenCalled(); output.close(); sender.destroy(); receiver.destroy();
});

it('bounds declared lengths and avoids compressing short or incompressible packets', async () => {
  for (const length of [0, 255, MAX_PACKET_PLAIN_BYTES + 1, 65535]) {
    expect(() => compressedPacketBody(Uint8Array.of(length >> 8, length & 255, 1))).toThrow();
  }
  const [sender, receiver] = packetPair();
  const codec = testPacketCompression()!; const compress = vi.spyOn(codec, 'compress');
  const stream = new CompressedPackets(codec, sender, vi.fn());
  const packets: string[] = [];
  stream.send('short', 'tiny', packet => packets.push(packet));
  expect(compress).not.toHaveBeenCalled(); expect(receiver.decrypt(packets[0])).toBe('tiny');
  compress.mockImplementationOnce(async bytes => bytes);
  stream.send('random', 'x'.repeat(1000), packet => packets.push(packet));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(receiver.decrypt(packets[1])).toBe('x'.repeat(1000));
  stream.close(); sender.destroy(); receiver.destroy();
});

it('keeps heartbeat probes flowing while native compression is saturated', async () => {
  const slowCodec = () => {
    const codec = testPacketCompression()!;
    return { ...codec, compress: async (bytes: Uint8Array) => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return codec.compress(bytes);
    } };
  };
  const harness = connected({ compression: { pc: slowCodec, phone: testPacketCompression } });
  await vi.advanceTimersByTimeAsync(4500);
  const pending = harness.links.pc.send({ kind: 'event', event: 'slow codec '.repeat(40_000) });
  // Closing the fixture rejects its unfinished delivery, as expected.
  void pending.catch(() => {});
  await vi.advanceTimersByTimeAsync(4000);
  expect(harness.links.pc.connectionMode).toBe('direct');
  expect(harness.links.phone.connectionMode).toBe('direct');
  expect(harness.error).not.toHaveBeenCalled();
});

it('bounds native decoding and lets overflow be retried after the queue drains', async () => {
  const [sender, receiver] = packetPair();
  const codec = testPacketCompression()!;
  const release: (() => void)[] = [];
  const decode = vi.spyOn(codec, 'decompress').mockImplementation(() => new Promise(resolve => {
    release.push(() => resolve(new Uint8Array(Buffer.alloc(1000, 'x'))));
  }));
  const failed = vi.fn(), accept = vi.fn();
  const stream = new CompressedPackets(codec, receiver, failed);
  const source = Buffer.alloc(1000, 'x');
  const packed = compressedPacket(source, deflateRawSync(source))!;
  const packets = Array.from({ length: 65 }, () => sender.encryptCompressed(packed));
  for (const payload of packets) stream.receive(payload, accept);
  expect(decode).toHaveBeenCalledTimes(64);
  for (const finish of release.splice(0)) finish();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(accept).toHaveBeenCalledTimes(64);
  stream.receive(packets[64], accept);
  expect(decode).toHaveBeenCalledTimes(65);
  release[0]();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(accept).toHaveBeenCalledTimes(65);
  expect(failed).not.toHaveBeenCalled();
  stream.close(); sender.destroy(); receiver.destroy();
});

it('does not send or deliver native completions after the session closes', async () => {
  const [sender, receiver] = packetPair();
  const codec = testPacketCompression()!;
  const source = Buffer.alloc(1000, 'x');
  const packed = compressedPacket(source, deflateRawSync(source))!;
  let releaseEncode!: (bytes: Uint8Array) => void;
  let releaseDecode!: (bytes: Uint8Array) => void;
  vi.spyOn(codec, 'compress').mockImplementation(() => new Promise(resolve => { releaseEncode = resolve; }));
  vi.spyOn(codec, 'decompress').mockImplementation(() => new Promise(resolve => { releaseDecode = resolve; }));
  const write = vi.fn(), accept = vi.fn(), failed = vi.fn();
  const stream = new CompressedPackets(codec, receiver, failed);
  stream.send('pending', source.toString(), write);
  stream.receive(sender.encryptCompressed(packed), accept);
  stream.close(); receiver.destroy(); sender.destroy();
  releaseEncode(packed.subarray(2)); releaseDecode(source);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(write).not.toHaveBeenCalled(); expect(accept).not.toHaveBeenCalled(); expect(failed).not.toHaveBeenCalled();
});

it('carries compressed ciphertext in the unchanged CSB1 binary relay envelope', async () => {
  const [sender, receiver] = packetPair();
  const codec = testPacketCompression()!;
  const source = Buffer.from('binary relay 中文😀 '.repeat(200));
  const packed = compressedPacket(source, await codec.compress(source))!;
  const payload = sender.encryptCompressed(packed);
  const frame = { type: 'relay', sessionId: 'compression-test', payload };
  const wire = encodeRelay(JSON.stringify(frame)) as Uint8Array;
  expect(wire.length).toBe(5 + frame.sessionId.length + payload.length / 2);
  const decoded = JSON.parse(decodeRelay(wire.buffer as ArrayBuffer)) as typeof frame;
  const body = compressedPacketBody(receiver.decryptCompressed(decoded.payload)!);
  expect(Buffer.from(await codec.decompress(body.bytes, body.length))).toEqual(source);
  codec.close(); sender.destroy(); receiver.destroy();
});
