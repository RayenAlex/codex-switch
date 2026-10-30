import { UnlockKeyhole } from 'lucide-react';
import { autoUnlockDescription, type SecuritySettingsProps } from '../../../../../shared/remote-desktop/security';
import { useAutoUnlockForm } from '../../../../../shared/remote-desktop/useAutoUnlockForm';
import { t } from '../../i18n';

export function AutoUnlockSettings(props: SecuritySettingsProps) {
  const form = useAutoUnlockForm(props);
  const state = props.value.autoUnlock;
  const disabled = !props.connected || !props.control || !props.supported || props.saving || !state;
  return <section className="rd-security-unlock">
    <button type="button" className="rd-security-option" role="switch" aria-label={t('自动解锁被控端')}
      aria-checked={state?.enabled ?? false} disabled={disabled} onClick={form.toggle}>
      <UnlockKeyhole size={23} aria-hidden="true" />
      <span className="rd-security-copy"><strong>{t('自动解锁被控端')}</strong>
        <small role="status">{t(autoUnlockDescription(state))}</small></span>
      <span className="rd-security-switch" aria-hidden="true"><span /></span>
    </button>
    {state?.enabled && !form.editing && <button type="button" className="rd-unlock-edit" disabled={disabled}
      onClick={form.edit}>{t('修改登录信息')}</button>}
    {form.editing && <form className="rd-unlock-form" autoComplete="off" onSubmit={event => {
      event.preventDefault(); form.save();
    }} onKeyDown={event => event.stopPropagation()}>
      <label>{t('Windows 账号')}<input aria-label={t('Windows 账号')} value={form.username}
        autoFocus autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={256} disabled={disabled}
        placeholder={t('例如：电脑名\\用户名')} onChange={event => form.setUsername(event.target.value)} /></label>
      <label>{t('Windows 登录密码')}<input type="password" aria-label={t('Windows 登录密码')}
        autoComplete="new-password" value={form.password} maxLength={256} disabled={disabled}
        onChange={event => form.setPassword(event.target.value)} /></label>
      <p className="rd-security-hint">{t('请填写账号密码，不是 PIN。密码仅加密保存在远程电脑；关闭后会删除。')}</p>
      <div className="rd-security-choices">
        <button type="button" onClick={form.cancel}>{t('取消')}</button>
        <button type="submit" disabled={disabled || !form.username.trim() || !form.password}>{t('保存并启用')}</button>
      </div>
    </form>}
  </section>;
}
