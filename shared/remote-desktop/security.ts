/** Security changes belong to the active viewer's capture group and expire with its last display. */
export interface DesktopSecurity {
  lockOnDisconnect: boolean;
  muteHost: boolean;
  autoUnlock?: { enabled: boolean; status: 'disabled' | 'ready' | 'unlocking' | 'failed' | 'unavailable' };
}
export type AutoUnlockChange = { enabled: false } | { enabled: true; username: string; password: string };
export interface DesktopSecurityChange {
  lockOnDisconnect?: boolean;
  muteHost?: boolean;
  autoUnlock?: AutoUnlockChange;
}
export const DEFAULT_DESKTOP_SECURITY: DesktopSecurity = { lockOnDisconnect: false, muteHost: false };

export function validateDesktopSecurity(value: unknown): DesktopSecurityChange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('安全选项无效，请重试。');
  }
  const entries = Object.entries(value);
  if (entries.some(([key, item]) => key === 'autoUnlock' ? !validUnlock(item)
    : !['lockOnDisconnect', 'muteHost'].includes(key) || typeof item !== 'boolean')) {
    throw new Error('安全选项无效，请重试。');
  }
  return Object.fromEntries(entries);
}

function validUnlock(value: unknown): value is AutoUnlockChange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.enabled === false) return Object.keys(record).length === 1;
  const text = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0 && value.length <= 256 && !value.includes('\0');
  return record.enabled === true && Object.keys(record).length === 3
    && text(record.username) && record.username === record.username.trim() && text(record.password);
}

export const AUTO_UNLOCK_ERRORS = [
  '请填写 Windows 账号和登录密码。', '请使用这台电脑已绑定的 Windows 账号。',
  '请先在电脑上更新应用并开启无人值守，再设置自动解锁。', '自动解锁设置未能保存，请重试。',
] as const;
export function autoUnlockDescription(state?: DesktopSecurity['autoUnlock']) {
  if (!state) return AUTO_UNLOCK_ERRORS[2];
  switch (state.status) {
    case 'unlocking': return '正在解锁远程电脑…';
    case 'failed': return '自动解锁已暂停，请检查 Windows 账号和密码后重新保存。';
    case 'unavailable': return '自动解锁暂时不可用，请重新连接后重试。';
    case 'ready': return '连接时自动登录或解锁远程电脑。';
    default: return '首次开启时，在此填写远程电脑的 Windows 账号和密码。';
  }
}

export interface SecuritySettingsProps {
  connected: boolean;
  control: boolean;
  supported: boolean;
  value: DesktopSecurity;
  saving: boolean;
  error: string;
  update: (change: DesktopSecurityChange) => Promise<void>;
  privacy: { available: boolean; enabled: boolean; toggle: () => Promise<void> };
  clipboard: { available: boolean; enabled: boolean; toggle: () => void };
  notice?: { message: string; label: string; run: () => void };
  close: () => void;
}
