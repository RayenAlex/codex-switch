import { getRandomBytes } from 'expo-crypto';
import { utf8ToBytes } from '@noble/hashes/utils';
import { keyPair, SessionCipher } from '../../../shared/remote-chat/cipher';
import { compressedPacket, compressedPacketBody } from '../../../shared/remote-chat/packetCompression';
import { createMobilePacketCompression } from '../src/chat/packetCompression';
import { createNativePacketCipher } from '../src/chat/packetCipher';

/** Uses the actual Rust worker and Android crypto bridge from a release/Hermes APK. */
export async function checkAndroidPacketCompression() {
  const codec = createMobilePacketCompression();
  if (!codec) throw new Error('Native packet compression unavailable');
  const a = keyPair(getRandomBytes), b = keyPair(getRandomBytes);
  const native = new SessionCipher({ secret: a.secret, publicKey: b.publicKey,
    sessionId: 'compression-test', desktop: false, createPacketCipher: createNativePacketCipher });
  const portable = new SessionCipher({ secret: b.secret, publicKey: a.publicKey,
    sessionId: 'compression-test', desktop: true });
  if (!native.supportsBinaryPlaintext) throw new Error('Native binary crypto unavailable');
  let ticks = 0;
  const timer = setInterval(() => { ticks++; }, 10);
  const started = performance.now();
  let totalPlain = 0, totalCompressed = 0;
  try {
    for (let index = 0; index < 100; index++) {
      const text = `native-${index}:` + '中文😀 independent packet '.repeat(180);
      const bytes = utf8ToBytes(text);
      const packed = compressedPacket(bytes, await codec.compress(bytes));
      if (!packed) throw new Error('Expected compression savings');
      totalPlain += bytes.length; totalCompressed += packed.length;
      for (const [sender, receiver] of [[native, portable], [portable, native]]) {
        const payload = sender.encryptCompressed(packed);
        const decoded = receiver.decryptCompressed(payload);
        if (!decoded) throw new Error('Packet decode failed');
        const body = compressedPacketBody(decoded);
        const result = await codec.decompress(body.bytes, body.length);
        if (result.length !== bytes.length || result.some((byte, offset) => byte !== bytes[offset])) {
          throw new Error('Compression interoperability failed');
        }
        if (receiver.decryptCompressed(payload) !== null) throw new Error('Replay accepted');
      }
    }
    if (!ticks) throw new Error('UI timer did not run during native work');
    return { totalPlain, totalCompressed, ticks, elapsedMs: performance.now() - started };
  } finally { clearInterval(timer); codec.close(); native.destroy(); portable.destroy(); }
}
