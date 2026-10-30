import { describe, expect, it, vi } from 'vitest';
import { MAX_PRIVATE_KEY_BYTES, readSshPrivateKey } from '../../../../shared/terminal/sshPrivateKey';

const keyFile = (text: string) => ({ size: new TextEncoder().encode(text).length, text: async () => text });
const key = (format: string) => `-----BEGIN ${format}-----\nfixture-data\n-----END ${format}-----`;

describe('private key file import', () => {
  it.each(['OPENSSH PRIVATE KEY', 'RSA PRIVATE KEY', 'EC PRIVATE KEY', 'PRIVATE KEY', 'ENCRYPTED PRIVATE KEY'])(
    'accepts %s without requiring a filename extension', async format => {
      await expect(readSshPrivateKey(keyFile(key(format)))).resolves.toBe(key(format));
    },
  );
  it('accepts a UTF-8 BOM and Windows line endings without changing the key body', async () => {
    const content = key('OPENSSH PRIVATE KEY').replaceAll('\n', '\r\n');
    await expect(readSshPrivateKey(keyFile(`\uFEFF${content}\r\n`))).resolves.toBe(content);
  });
  it('rejects an oversized file before reading it', async () => {
    const file = { size: MAX_PRIVATE_KEY_BYTES + 1, text: vi.fn(async () => '') };
    await expect(readSshPrivateKey(file)).rejects.toThrow('client.ssh.keyFileTooLarge');
    expect(file.text).not.toHaveBeenCalled();
  });
  it('rejects empty files', async () => {
    await expect(readSshPrivateKey(keyFile(' \r\n'))).rejects.toThrow('client.ssh.keyFileEmpty');
  });
  it.each(['ssh-ed25519 public-key user@host', 'binary\u0000content', key('PUBLIC KEY'),
    '-----BEGIN RSA PRIVATE KEY-----\ndata\n-----END EC PRIVATE KEY-----'])(
    'rejects public keys and unsupported or incomplete containers', async text => {
      await expect(readSshPrivateKey(keyFile(text))).rejects.toThrow('client.ssh.keyFileInvalid');
    },
  );
  it('shows a safe error when a file cannot be read', async () => {
    const file = { size: 12, text: async () => { throw new Error('sensitive local path'); } };
    await expect(readSshPrivateKey(file)).rejects.toThrow('client.ssh.keyFileReadFailed');
  });
});
