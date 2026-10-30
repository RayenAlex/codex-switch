import { NativeModules, Platform } from 'react-native';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import type { PacketCipherFactory } from '../../../../shared/remote-chat/packetCipher';

type NativePlaintext = { text: string } | { utf8Hex: string };

interface NativePacketCipher {
  available: boolean;
  binaryPackets?: boolean;
  compressedPackets?: boolean;
  encryptWithCompression?(handle: string, input: NativePlaintext, nonce: string): Promise<string>;
  decryptWithDecompression?(handle: string, packet: string): Promise<{ text: string }>;
  decryptPacketHex?(handle: string, packet: string): string | null;
  create(key: string, context: string): string | null;
  encrypt(handle: string, input: NativePlaintext, nonce: string): string | null;
  decrypt(handle: string, packet: string): { text: string } | null;
  destroy(handle: string): boolean;
}

function authenticated(value: string | null): string {
  if (value === null) throw new Error('Invalid encrypted packet');
  return value;
}

function plaintext(text: string) {
  // JNI input strings truncate at NUL, including map entries. JSON transport frames never take this fallback.
  return text.includes('\0') ? { utf8Hex: bytesToHex(utf8ToBytes(text)) } : { text };
}

/** One bounded native call performs crypto, hex and UTF-8 conversion without copying arrays through Hermes. */
export const createNativePacketCipher: PacketCipherFactory = ({ key, context }) => {
  const native = NativeModules.ChatPacketCipher as NativePacketCipher | undefined;
  if (Platform.OS !== 'android' || !native?.available) return undefined;
  const handle = native.create(bytesToHex(key), bytesToHex(context));
  if (handle === null) throw new Error('Unable to initialize encrypted session');
  const integrated = native.compressedPackets && native.encryptWithCompression && native.decryptWithDecompression;
  return {
    encrypt: (text, nonce) => authenticated(native.encrypt(handle, plaintext(text), nonce)),
    decrypt: (packet) => authenticated(native.decrypt(handle, packet)?.text ?? null),
    encryptBytes: native.binaryPackets && native.decryptPacketHex ? (bytes, nonce) =>
      authenticated(native.encrypt(handle, { utf8Hex: bytesToHex(bytes) }, nonce)) : undefined,
    decryptBytes: native.binaryPackets && native.decryptPacketHex ? packet =>
      hexToBytes(authenticated(native.decryptPacketHex!(handle, packet))) : undefined,
    encryptWithCompression: integrated ? async (text, nonce) =>
      authenticated(await native.encryptWithCompression!(handle, plaintext(text), nonce)) : undefined,
    decryptWithDecompression: integrated ? async packet =>
      authenticated((await native.decryptWithDecompression!(handle, packet))?.text ?? null) : undefined,
    destroy: () => { native.destroy(handle); },
  };
};
