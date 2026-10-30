import { hasLocalBackend, invoke } from './backend';
import type { AppSettings, UsageSummary } from '../types';

export interface QuotaAverage {
  usage: UsageSummary;
  totalAccounts: number;
  primaryAccounts: number;
  secondaryAccounts: number;
  stale: boolean;
}

export interface QuotaDisplayStatus {
  enabled: boolean;
  average: QuotaAverage | null;
}

export const quotaDisplayApi = {
  supported: hasLocalBackend,
  load: (): Promise<QuotaDisplayStatus> => hasLocalBackend
    ? invoke('get_quota_display_status') : Promise.resolve({ enabled: false, average: null }),
  save: (enabled: boolean): Promise<AppSettings> => invoke('set_quota_display_all_accounts', { enabled }),
};
