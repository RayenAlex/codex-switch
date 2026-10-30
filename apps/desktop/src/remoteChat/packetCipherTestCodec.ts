import { createCipheriv, createDecipheriv } from 'node:crypto';
import type { PacketCipherFactory } from '../../../../shared/remote-chat/packetCipher';

// Independent crypto implementation exercises the platform seam against Noble in both directions.
export const platformCipher: PacketCipherFactory = ({ key, context }) => {
  const copy = Buffer.from(key);
  return {
    encrypt(text, nonceHex) {
      const cipher = createCipheriv('chacha20-poly1305', copy, Buffer.from(nonceHex, 'hex'));
      cipher.setAAD(context, { plaintextLength: Buffer.byteLength(text) });
      return nonceHex + Buffer.concat([cipher.update(text), cipher.final(), cipher.getAuthTag()]).toString('hex');
    },
    decrypt(payload) {
      if (!/^[a-f0-9]+$/.test(payload)) throw new Error('Invalid packet');
      const bytes = Buffer.from(payload, 'hex');
      const cipher = createDecipheriv('chacha20-poly1305', copy, bytes.subarray(0, 12));
      cipher.setAuthTag(bytes.subarray(-16));
      cipher.setAAD(context, { plaintextLength: bytes.length - 28 });
      return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString('utf8');
    },
    destroy() { copy.fill(0); },
  };
};

export const binaryPlatformCipher: PacketCipherFactory = material => {
  const cipher = platformCipher(material)!;
  const key = Buffer.from(material.key);
  return { ...cipher,
    encryptBytes(bytes, nonceHex) {
      const native = createCipheriv('chacha20-poly1305', key, Buffer.from(nonceHex, 'hex'));
      native.setAAD(material.context, { plaintextLength: bytes.length });
      return nonceHex + Buffer.concat([native.update(bytes), native.final(), native.getAuthTag()]).toString('hex');
    },
    decryptBytes(payload) {
      const bytes = Buffer.from(payload, 'hex');
      const native = createDecipheriv('chacha20-poly1305', key, bytes.subarray(0, 12));
      native.setAuthTag(bytes.subarray(-16));
      native.setAAD(material.context, { plaintextLength: bytes.length - 28 });
      return Buffer.concat([native.update(bytes.subarray(12, -16)), native.final()]);
    },
    destroy() { key.fill(0); cipher.destroy(); },
  };
};
