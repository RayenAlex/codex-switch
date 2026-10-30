import { Clipboard, EyeOff, LockKeyhole, ShieldCheck, VolumeX, X, type LucideIcon } from 'lucide-react';
import { AutoUnlockSettings } from './AutoUnlockSettings';
import type { SecuritySettingsProps } from '../../../../../shared/remote-desktop/security';
import { t } from '../../i18n';
import './securitySettings.css';

function Toggle({ icon: Icon, title, description, checked, disabled, change }: {
  icon: LucideIcon; title: string; description: string; checked: boolean; disabled: boolean; change: () => void;
}) {
  return <button type="button" className="rd-security-option" role="switch" aria-label={t(title)}
    aria-checked={checked} disabled={disabled} onClick={change}>
    <Icon size={23} aria-hidden="true" />
    <span className="rd-security-copy"><strong>{t(title)}</strong><small>{t(description)}</small></span>
    <span className="rd-security-switch" aria-hidden="true"><span /></span>
  </button>;
}

export function SecuritySettings(props: SecuritySettingsProps) {
  const { connected, control, supported, value, saving, error, update, privacy, clipboard, notice, close } = props;
  const disabled = !connected || !control || saving;
  return <aside className="rd-settings rd-security-settings" aria-label={t('安全选项')}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    <header><ShieldCheck size={26} aria-hidden="true" /><h2>{t('安全选项')}</h2>
      <button type="button" className="rd-security-close" onClick={close} aria-label={t('关闭安全选项')}>
        <X size={22} /></button></header>
    <div className="rd-security-scroll" tabIndex={0} role="region" aria-label={t('安全设置选项')}>
      {notice && <div className="rd-security-notice" role="status"><p>{t(notice.message)}</p>
        <button type="button" disabled={saving} onClick={notice.run}>{t(notice.label)}</button></div>}
      <AutoUnlockSettings {...props} />
      <Toggle icon={LockKeyhole} title="远程结束后锁屏" checked={value.lockOnDisconnect}
        disabled={disabled || !supported} change={() => { void update({ lockOnDisconnect: !value.lockOnDisconnect }); }}
        description={supported ? '连接结束或断开后，自动锁定远程电脑。' : '这台电脑暂不支持此安全选项。'} />
      <Toggle icon={VolumeX} title="被控端静音运行" checked={value.muteHost}
        disabled={disabled || !supported} change={() => { void update({ muteHost: !value.muteHost }); }}
        description={supported ? '远程电脑静音，本机仍可听到声音；连接结束后恢复。' : '这台电脑暂不支持此安全选项。'} />
      <section className="rd-security-privacy" aria-label={t('被控端防窥模式')}>
        <div className="rd-security-option-heading"><EyeOff size={23} aria-hidden="true" />
          <div className="rd-security-copy"><strong>{t('被控端防窥模式')}</strong>
            <small>{t(privacy.available ? '隐藏远程电脑的屏幕内容，本机仍可查看和操作。' : '这台电脑暂不支持隐私屏。')}</small>
          </div></div>
        <div className="rd-security-choices" role="group" aria-label={t('防窥模式')}>
          {[false, true].map(enabled => <button key={String(enabled)} type="button"
            disabled={disabled || !privacy.available} aria-pressed={privacy.enabled === enabled}
            onClick={() => { if (privacy.enabled !== enabled) void privacy.toggle(); }}>
            {t(enabled ? '启用' : '不启用')}</button>)}
        </div>
      </section>
      <Toggle icon={Clipboard} title="同步剪贴板" checked={clipboard.enabled}
        disabled={!connected || !clipboard.available} change={clipboard.toggle}
        description="开启后，可在本机和远程电脑之间复制粘贴。" />
      {error && <p className="rd-security-error" role="alert">{t(error)}</p>}
      {!control && <p className="rd-security-hint">{t('仅观看')}</p>}
    </div>
  </aside>;
}
