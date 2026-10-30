import { afterEach, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  Platform: { OS: 'android' },
  NativeModules: { ChatPacketCipher: undefined as unknown },
}));
vi.mock('react-native', () => runtime);
import { createNativePacketCipher } from './packetCipher';

const material = { key: new Uint8Array(32), context: new Uint8Array([1, 2]) };
afterEach(() => { runtime.Platform.OS = 'android'; runtime.NativeModules.ChatPacketCipher = undefined; });

it('uses the portable implementation when the Android module or algorithm is unavailable', () => {
  expect(createNativePacketCipher(material)).toBeUndefined();
  runtime.NativeModules.ChatPacketCipher = { available: false };
  expect(createNativePacketCipher(material)).toBeUndefined();
  runtime.Platform.OS = 'ios';
  runtime.NativeModules.ChatPacketCipher = { available: true };
  expect(createNativePacketCipher(material)).toBeUndefined();
});

it('never falls back or returns unauthenticated data after a native packet error', () => {
  const native = { available: true, create: vi.fn(() => 'opaque-handle'),
    encrypt: vi.fn(() => null), decrypt: vi.fn(() => null), destroy: vi.fn() };
  runtime.NativeModules.ChatPacketCipher = native;
  const cipher = createNativePacketCipher(material)!;
  expect(native.create).toHaveBeenCalledWith('00'.repeat(32), '0102');
  expect(() => cipher.decrypt('corrupt')).toThrow('Invalid encrypted packet');
  expect(() => cipher.encrypt('plain', 'nonce')).toThrow('Invalid encrypted packet');
  cipher.destroy();
  expect(native.destroy).toHaveBeenCalledWith('opaque-handle');
});

it('surfaces native session creation failures without silently using a different key', () => {
  runtime.NativeModules.ChatPacketCipher = { available: true, create: () => null };
  expect(() => createNativePacketCipher(material)).toThrow('Unable to initialize encrypted session');
});

it('preserves embedded NULs across JNI input and output conversion', () => {
  const native = { available: true, create: () => 'session', encrypt: vi.fn(() => 'encrypted'),
    decrypt: () => ({ text: 'a\0b' }), destroy: vi.fn() };
  runtime.NativeModules.ChatPacketCipher = native;
  const cipher = createNativePacketCipher(material)!;
  expect(cipher.encrypt('a\0b', 'nonce')).toBe('encrypted');
  expect(native.encrypt).toHaveBeenCalledWith('session', { utf8Hex: '610062' }, 'nonce');
  expect(cipher.decrypt('packet')).toBe('a\0b');
});

it('bridges authenticated binary plaintext without UTF-8 decoding or network Base64', () => {
  const native = { available: true, binaryPackets: true, create: () => 'session',
    encrypt: vi.fn(() => 'encrypted'), decryptPacketHex: vi.fn(() => '00ff80'),
    decrypt: vi.fn(), destroy: vi.fn() };
  runtime.NativeModules.ChatPacketCipher = native;
  const cipher = createNativePacketCipher(material)!;
  expect(cipher.encryptBytes!(Uint8Array.of(0, 255, 128), 'nonce')).toBe('encrypted');
  expect(native.encrypt).toHaveBeenCalledWith('session', { utf8Hex: '00ff80' }, 'nonce');
  expect(cipher.decryptBytes!('packet')).toEqual(Uint8Array.of(0, 255, 128));
  expect(native.decrypt).not.toHaveBeenCalled();
  native.decryptPacketHex.mockReturnValueOnce(null as unknown as string);
  expect(() => cipher.decryptBytes!('bad')).toThrow('Invalid encrypted packet');
  cipher.destroy();
});

it('uses one asynchronous native call per compressed direction and retains old module compatibility', async () => {
  const native = { available: true, compressedPackets: true, create: () => 'session',
    encrypt: vi.fn(), decrypt: vi.fn(), destroy: vi.fn(),
    encryptWithCompression: vi.fn(async () => 'packet'),
    decryptWithDecompression: vi.fn(async () => ({ text: '中文😀\0' })) };
  runtime.NativeModules.ChatPacketCipher = native;
  const cipher = createNativePacketCipher(material)!;
  expect(await cipher.encryptWithCompression!('中文😀', 'nonce')).toBe('packet');
  expect(native.encryptWithCompression).toHaveBeenCalledWith('session', { text: '中文😀' }, 'nonce');
  expect(await cipher.decryptWithDecompression!('packet')).toBe('中文😀\0');
  expect(native.decryptWithDecompression).toHaveBeenCalledWith('session', 'packet');
  expect(native.encrypt).not.toHaveBeenCalled(); expect(native.decrypt).not.toHaveBeenCalled();
  native.encryptWithCompression.mockRejectedValueOnce(new Error('failed'));
  await expect(cipher.encryptWithCompression!('plain', 'nonce')).rejects.toThrow('failed');
  native.compressedPackets = false;
  expect(createNativePacketCipher(material)!.encryptWithCompression).toBeUndefined();
});
