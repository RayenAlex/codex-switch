import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { afterEach, expect, it, vi } from 'vitest';
import { keyPair, SessionCipher } from '../../../../shared/remote-chat/cipher';
import type { PacketCipherFactory } from '../../../../shared/remote-chat/packetCipher';
import { compressedPacket, compressedPacketBody } from '../../../../shared/remote-chat/packetCompression';
import { CompressedPackets, isCompressedPacket } from '../../../../shared/remote-chat/compressedPackets';
import { binaryPlatformCipher } from './packetCipherTestCodec';
import { testPacketCompression } from './compressionTestCodec';

const integratedCipher: PacketCipherFactory = material => {
  const cipher = binaryPlatformCipher(material)!;
  return { ...cipher,
    async encryptWithCompression(text, nonce) {
      const bytes = Buffer.from(text);
      const packed = bytes.length >= 256 ? compressedPacket(bytes, deflateRawSync(bytes)) : undefined;
      return packed ? cipher.encryptBytes!(packed, nonce.slice(0, 8) + '00000001' + nonce.slice(16))
        : cipher.encrypt(text, nonce);
    },
    async decryptWithDecompression(payload) {
      const body = compressedPacketBody(cipher.decryptBytes!(payload));
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(inflateRawSync(body.bytes));
    },
  };
};

const sessions: SessionCipher[] = [];
afterEach(() => { sessions.splice(0).forEach(session => session.destroy()); });
function pair(factory = integratedCipher) {
  const a = keyPair(size => crypto.getRandomValues(new Uint8Array(size)));
  const b = keyPair(size => crypto.getRandomValues(new Uint8Array(size)));
  const sender = new SessionCipher({ secret: a.secret, publicKey: b.publicKey, desktop: true, sessionId: 'combined' });
  const receiver = new SessionCipher({ secret: b.secret, publicKey: a.publicKey, desktop: false,
    sessionId: 'combined', createPacketCipher: factory });
  sessions.push(sender, receiver);
  return { sender, receiver };
}
function encoded(sender: SessionCipher, text = '中文😀'.repeat(200)) {
  const bytes = Buffer.from(text);
  return sender.encryptCompressed(compressedPacket(bytes, deflateRawSync(bytes))!);
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

it('uses the integrated native path without calling either standalone codec and preserves the wire format', async () => {
  const { sender, receiver } = pair();
  const codec = testPacketCompression()!;
  const compress = vi.spyOn(codec, 'compress'), decompress = vi.spyOn(codec, 'decompress');
  const failed = vi.fn(), accept = vi.fn();
  const stream = new CompressedPackets(codec, receiver, failed);
  const text = '中文😀'.repeat(200);
  const packets: string[] = [];
  stream.send('text', text, packet => packets.push(packet));
  await flush();
  expect(isCompressedPacket(packets[0])).toBe(true);
  const body = compressedPacketBody(sender.decryptCompressed(packets[0])!);
  expect(inflateRawSync(body.bytes).toString()).toBe(text);
  stream.send('tiny', 'hi', packet => packets.push(packet));
  await flush();
  expect(sender.decrypt(packets[1])).toBe('hi');
  stream.receive(encoded(sender, text), accept);
  await flush();
  expect(accept).toHaveBeenCalledWith(text);
  expect(compress).not.toHaveBeenCalled(); expect(decompress).not.toHaveBeenCalled();
  expect(failed).not.toHaveBeenCalled(); stream.close();
});

it('rejects tampering without consuming a valid sequence and prevents reflection and replays', async () => {
  const { sender, receiver } = pair();
  const packet = encoded(sender);
  const corrupt = packet.slice(0, -2) + (packet.endsWith('00') ? '01' : '00');
  await expect(receiver.decryptWithDecompression(corrupt)).rejects.toThrow();
  await expect(receiver.decryptWithDecompression(packet.slice(0, 8) + '00000000' + packet.slice(16)))
    .rejects.toThrow('Invalid nonce');
  await expect(receiver.decryptWithDecompression(await receiver.encryptWithCompression('reflection'.repeat(100))))
    .rejects.toThrow('Invalid nonce');
  expect(await receiver.decryptWithDecompression(packet)).toBe('中文😀'.repeat(200));
  expect(await receiver.decryptWithDecompression(packet)).toBeNull();
});

it('keeps every sub-256-byte string on the synchronous path without allocating UTF-8 buffers', async () => {
  const { receiver } = pair();
  const encrypt = vi.spyOn(receiver, 'encryptWithCompression');
  const stream = new CompressedPackets(testPacketCompression()!, receiver, vi.fn());
  for (const text of ['x'.repeat(255), 'x'.repeat(256), 'x'.repeat(218) + '好', '中'.repeat(85),
    '中'.repeat(85) + 'x', '😀'.repeat(63) + 'abc', '😀'.repeat(64), 'x'.repeat(252) + '\ud800',
    'x'.repeat(253) + '\ud800', 'é'.repeat(127) + 'x', 'é'.repeat(128)]) {
    encrypt.mockClear();
    await new Promise<void>(resolve => stream.send(text, text, () => resolve()));
    expect(encrypt).toHaveBeenCalledTimes(Buffer.byteLength(text) < 256 ? 0 : 1);
    await flush();
  }
  stream.close();
});

function delayedPair() {
  const releases: (() => void)[] = [];
  const decrypt = vi.fn();
  const peers = pair(material => {
    const native = integratedCipher(material)!;
    decrypt.mockImplementation(async (payload: string) => {
      await new Promise<void>(resolve => releases.push(resolve));
      return native.decryptWithDecompression!(payload);
    });
    return { ...native, decryptWithDecompression: decrypt };
  });
  return { ...peers, releases, decrypt };
}

it('deduplicates pending work and drops completions that have fallen outside the shared replay window', async () => {
  const { sender, receiver, releases, decrypt } = delayedPair();
  const packet = encoded(sender);
  const pending = receiver.decryptWithDecompression(packet);
  expect(await receiver.decryptWithDecompression(packet)).toBeNull();
  expect(decrypt).toHaveBeenCalledOnce();
  for (let i = 0; i < 1024; i++) expect(receiver.decrypt(sender.encrypt('control'))).toBe('control');
  releases[0]();
  expect(await pending).toBeNull();
  expect(await receiver.decryptWithDecompression(packet)).toBeNull();
});

it('accepts out-of-order native completions and ignores completions after disposal', async () => {
  const { sender, receiver, releases } = delayedPair();
  const first = receiver.decryptWithDecompression(encoded(sender, 'first'.repeat(100)));
  const second = receiver.decryptWithDecompression(encoded(sender, 'second'.repeat(100)));
  releases[1](); expect(await second).toBe('second'.repeat(100));
  releases[0](); expect(await first).toBe('first'.repeat(100));
  const closed = receiver.decryptWithDecompression(encoded(sender));
  const rejected = expect(closed).rejects.toThrow();
  receiver.destroy(); releases[2](); await rejected;
});

it('bounds native work and leaves overflow available for retry', async () => {
  const { sender, receiver, releases, decrypt } = delayedPair();
  const codec = testPacketCompression()!, failed = vi.fn(), accept = vi.fn();
  const stream = new CompressedPackets(codec, receiver, failed);
  const packets = Array.from({ length: 65 }, () => encoded(sender));
  for (const packet of packets) stream.receive(packet, accept);
  expect(decrypt).toHaveBeenCalledTimes(64);
  releases.splice(0).forEach(release => release()); await flush();
  expect(accept).toHaveBeenCalledTimes(64);
  stream.receive(packets[64], accept);
  expect(decrypt).toHaveBeenCalledTimes(65);
  releases[0](); await flush();
  expect(accept).toHaveBeenCalledTimes(65);
  expect(failed).not.toHaveBeenCalled(); stream.close();
});

it('bounds combined sends, bypasses the queue for controls, and suppresses completions after close', async () => {
  const releases: (() => void)[] = [];
  const { sender, receiver } = pair(material => {
    const native = integratedCipher(material)!;
    return { ...native, async encryptWithCompression(text, nonce) {
      await new Promise<void>(resolve => releases.push(resolve));
      return native.encryptWithCompression!(text, nonce);
    } };
  });
  const failed = vi.fn(), write = vi.fn();
  const stream = new CompressedPackets(testPacketCompression()!, receiver, failed);
  const text = 'bounded'.repeat(100);
  for (let i = 0; i < 64; i++) expect(stream.send(String(i), text, write)).toBe(true);
  expect(stream.send('0', text, write)).toBe(true);
  expect(stream.send('overflow', text, write)).toBe(false);
  expect(releases).toHaveLength(64);
  expect(sender.decrypt(receiver.encrypt('ping'))).toBe('ping');
  stream.close(); releases.forEach(release => release()); await flush();
  expect(write).not.toHaveBeenCalled(); expect(failed).not.toHaveBeenCalled();
});
