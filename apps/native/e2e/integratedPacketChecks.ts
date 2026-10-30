import { getRandomBytes } from 'expo-crypto';
import { utf8ToBytes } from '@noble/hashes/utils';
import { keyPair, SessionCipher } from '../../../shared/remote-chat/cipher';
import { compressedPacket, compressedPacketBody, MAX_PACKET_PLAIN_BYTES }
  from '../../../shared/remote-chat/packetCompression';
import { isCompressedPacket } from '../../../shared/remote-chat/compressedPackets';
import { decodeChatUtf8 } from '../../../shared/remote-chat/utf8';
import { createMobilePacketCompression } from '../src/chat/packetCompression';
import { createNativePacketCipher } from '../src/chat/packetCipher';

async function rejects(action: () => unknown) {
  try { await action(); } catch { return; }
  throw new Error('Expected packet rejection');
}

/** Release/Hermes check of the actual combined Kotlin/JNI/Rust path against the portable wire implementation. */
export async function checkIntegratedPackets() {
  const codec = createMobilePacketCompression()!;
  const a = keyPair(getRandomBytes), b = keyPair(getRandomBytes);
  const native = new SessionCipher({ secret: a.secret, publicKey: b.publicKey, desktop: false,
    sessionId: 'integrated-codec', createPacketCipher: createNativePacketCipher });
  const portable = new SessionCipher({ secret: b.secret, publicKey: a.publicKey,
    desktop: true, sessionId: 'integrated-codec' });
  if (!native.supportsIntegratedCompression) throw new Error('Combined native codec unavailable');
  try {
    for (const text of ['', 'tiny', 'x'.repeat(255), 'x'.repeat(256), '\uFEFF' + '中文😀\0'.repeat(200),
      'x'.repeat(MAX_PACKET_PLAIN_BYTES), Array.from({ length: 256 }, (_, i) => String.fromCharCode(i)).join('')]) {
      const bytes = utf8ToBytes(text);
      const packed = bytes.length >= 256 ? compressedPacket(bytes, await codec.compress(bytes)) : undefined;
      const payload = await native.encryptWithCompression(text);
      if (isCompressedPacket(payload) !== Boolean(packed)) throw new Error('Compression policy changed');
      if (payload.length / 2 !== (packed?.length ?? bytes.length) + 28) throw new Error('Wire size changed');
      const decoded = packed ? await decodePortable(payload) : portable.decrypt(payload);
      if (decoded !== text) throw new Error('Native encoder interoperability failed');
      if (packed) {
        const incoming = portable.encryptCompressed(packed);
        const corrupt = incoming.slice(0, -2) + (incoming.endsWith('00') ? '01' : '00');
        await rejects(() => native.decryptWithDecompression(corrupt));
        if (await native.decryptWithDecompression(incoming) !== text) throw new Error('Native decoder failed');
        if (await native.decryptWithDecompression(incoming) !== null) throw new Error('Replay accepted');
      }
    }
    await rejects(() => native.encryptWithCompression('x'.repeat(MAX_PACKET_PLAIN_BYTES + 1)));
    await checkMalformed();
    const pending = native.encryptWithCompression('closed'.repeat(100));
    native.destroy();
    await rejects(() => pending);
    return 'Combined native codec: Unicode/NUL/BOM, byte-identical sizes, thresholds, limits, authentication, replay, close';
  } finally { native.destroy(); portable.destroy(); codec.close(); a.secret.fill(0); b.secret.fill(0); }

  async function decodePortable(payload: string) {
    const body = compressedPacketBody(portable.decryptCompressed(payload)!);
    return decodeChatUtf8(await codec.decompress(body.bytes, body.length));
  }

  async function checkMalformed() {
    const source = utf8ToBytes('valid'.repeat(100));
    const packed = compressedPacket(source, await codec.compress(source))!;
    const trailing = new Uint8Array(packed.length + 1); trailing.set(packed);
    const wrongLength = packed.slice(); wrongLength[1] ^= 1;
    const invalidUtf8 = new Uint8Array(256).fill(255);
    const invalidText = compressedPacket(invalidUtf8, await codec.compress(invalidUtf8))!;
    for (const bytes of [trailing, wrongLength, packed.subarray(0, packed.length - 1), invalidText,
      Uint8Array.of(255, 255, 1), Uint8Array.of(0, 255, 1)]) {
      await rejects(() => native.decryptWithDecompression(portable.encryptCompressed(bytes)));
    }
  }
}
