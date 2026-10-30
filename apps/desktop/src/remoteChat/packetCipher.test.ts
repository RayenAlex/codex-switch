import { platformCipher, binaryPlatformCipher } from './packetCipherTestCodec';
import { describe, expect, it, vi } from 'vitest';
import { keyPair, SessionCipher } from '../../../../shared/remote-chat/cipher';
import type { PacketCipherFactory } from '../../../../shared/remote-chat/packetCipher';

it('preserves arbitrary compressed bytes through native crypto and retains old native capability fallback', () => {
  const old = pair(platformCipher);
  expect(old.receiver.supportsBinaryPlaintext).toBe(false);
  expect(() => old.receiver.encryptCompressed(Uint8Array.of(0, 255))).toThrow();
  old.sender.destroy(); old.receiver.destroy(); old.other.destroy();
  const { sender, receiver, other } = pair(binaryPlatformCipher);
  const bytes = Uint8Array.from({ length: 1024 }, (_, index) => index % 256);
  expect(receiver.supportsBinaryPlaintext).toBe(true);
  expect(receiver.decryptCompressed(sender.encryptCompressed(bytes))).toEqual(Buffer.from(bytes));
  expect(sender.decryptCompressed(receiver.encryptCompressed(bytes))).toEqual(bytes);
  sender.destroy(); receiver.destroy(); other.destroy();
});

function pair(factory?: PacketCipherFactory) {
  const a = keyPair((size) => crypto.getRandomValues(new Uint8Array(size)));
  const b = keyPair((size) => crypto.getRandomValues(new Uint8Array(size)));
  const base = { secret: b.secret, publicKey: a.publicKey, desktop: false, createPacketCipher: factory };
  return {
    sender: new SessionCipher({ secret: a.secret, publicKey: b.publicKey, desktop: true, sessionId: 'test' }),
    receiver: new SessionCipher({ ...base, sessionId: 'test' }),
    other: new SessionCipher({ ...base, sessionId: 'other-session' }),
  };
}

describe.each([undefined, platformCipher])('session cipher with optional platform codec %s', (factory) => {
  it('matches the existing wire format for empty, ASCII, Unicode and large frames in both directions', () => {
    const { sender, receiver, other } = pair(factory);
    for (const text of ['', 'hello', '中文😀\u0000 café', 'YWFh'.repeat(4000)]) {
      expect(receiver.decrypt(sender.encrypt(text))).toBe(text);
      expect(sender.decrypt(receiver.encrypt(text))).toBe(text);
    }
    sender.destroy(); receiver.destroy(); other.destroy();
  });

  it('authenticates before updating replay state and rejects reflection and cross-session packets', () => {
    const { sender, receiver, other } = pair(factory);
    const packets = Array.from({ length: 1100 }, () => sender.encrypt('valid'));
    const last = packets.at(-1)!;
    const corrupt = last.slice(0, -2) + (last.endsWith('00') ? '01' : '00');
    expect(() => receiver.decrypt(corrupt)).toThrow();
    expect(() => other.decrypt(last)).toThrow();
    expect(() => receiver.decrypt(receiver.encrypt('reflection'))).toThrow('Invalid nonce');
    expect(receiver.decrypt(packets[0])).toBe('valid');
    expect(receiver.decrypt(last)).toBe('valid');
    expect(receiver.decrypt(packets[0])).toBeNull();
    expect(receiver.decrypt(packets[1098])).toBe('valid');
    expect(receiver.decrypt(last)).toBeNull();
    sender.destroy(); receiver.destroy(); other.destroy();
  });

  it('rejects malformed envelopes and prevents use after closing', () => {
    const { sender, receiver, other } = pair(factory);
    const packet = sender.encrypt('valid');
    for (const invalid of ['', packet.slice(1), packet + '00'.repeat(20000),
      packet.slice(0, -1) + 'G', '000000000000000000000001' + packet.slice(24)]) {
      expect(() => receiver.decrypt(invalid)).toThrow();
    }
    expect(receiver.decrypt(packet)).toBe('valid');
    receiver.destroy();
    expect(() => receiver.decrypt(packet)).toThrow('Session closed');
    expect(() => receiver.encrypt('closed')).toThrow('Session closed');
    sender.destroy(); other.destroy();
  });
});

it('falls back only at initialization and destroys each native session exactly once', () => {
  const fallback = pair(() => undefined);
  expect(fallback.receiver.decrypt(fallback.sender.encrypt('fallback'))).toBe('fallback');
  fallback.sender.destroy(); fallback.receiver.destroy(); fallback.other.destroy();
  const destroy = vi.fn();
  const native = pair((material) => ({ ...platformCipher(material)!, destroy }));
  native.receiver.destroy(); native.receiver.destroy();
  expect(destroy).toHaveBeenCalledOnce();
  native.sender.destroy(); native.other.destroy();
});
