import { getLocale, t } from '../i18n';
export function resetLabel(timestamp?: number | null) {
  if (!timestamp) return t("client.shared.resetTimeUnavailable");
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return t("client.shared.resetTimeUnavailable");
  const milliseconds = date.getTime() - Date.now();
  if (milliseconds <= 0) return t("client.shared.resettingSoon");
  const totalMinutes = Math.floor(milliseconds / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return t("client.mobile.resetsInAboutHM", { value1: days ? t("client.shared.d", { days }) : '', value2: hours, value3: minutes });
}

export function maskEmail(email: string) {
  const at = email.indexOf('@');
  if (at < 2) return '******';
  const local = email.slice(0, at);
  return `${local.slice(0, 2)}${'*'.repeat(Math.min(5, Math.max(2, local.length - 2)))}${email.slice(at)}`;
}

export function displayDate(value?: string | null) {
  if (!value) return t("client.accounts.notRefreshed");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("client.accounts.notRefreshed");
  return new Intl.DateTimeFormat(getLocale(), {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

export function displayFullDate(value?: string | null) {
  if (!value) return t("client.app.unknownTime");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("client.app.unknownTime");
  return new Intl.DateTimeFormat(getLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
