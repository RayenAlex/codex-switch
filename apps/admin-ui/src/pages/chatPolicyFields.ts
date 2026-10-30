import POLICY_SECTIONSResource from '@remoteai/i18n/copy/admin/chatPolicyFields';
import { CHAT_POLICY_FIELDS } from '../../../../shared/remote-chat/policy';
type Copy = readonly [string, string];
export interface PolicyField { key: keyof typeof CHAT_POLICY_FIELDS; label: Copy; hint: Copy; unit: Copy }
export interface PolicySection { key: string; title: Copy; hint: Copy; fields: readonly PolicyField[] }
export const POLICY_SECTIONS: readonly PolicySection[] = POLICY_SECTIONSResource;
