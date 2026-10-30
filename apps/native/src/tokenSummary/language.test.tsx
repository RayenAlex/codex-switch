import React, { Children, isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UsageTotals, UsageTrend } from './UsagePanels';
import { ConsumptionPanels } from './ConsumptionPanels';
import { QuotaPanel } from './QuotaPanel';
import { setInterfaceLanguage } from '../../../../shared/localization/interfaceLanguage';
import { translateMessage } from '../../../../shared/localization/messages';
import { TOKEN_FIELDS, CONTEXT_FIELDS, MODE_FIELDS } from '../../../../shared/remote-chat/tokenSummaryLabels';
import type { TokenSummary } from '../../../../shared/remote-chat/tokenSummary';

vi.mock('react', async original => ({ ...await original<typeof React>(),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  useState: (value: unknown) => [value, vi.fn()], useMemo: (factory: () => unknown) => factory(),
}));
vi.mock('react-native', () => ({ Text: 'Text', View: 'View', Pressable: 'Pressable', TextInput: 'TextInput' }));
vi.mock('./styles', () => ({ useSummaryStyles: () => ({}) }));
vi.mock('./TimeBars', () => ({ TimeBars: ({ labels }: { labels: string[] }) => labels.join('|') }));
vi.mock('../components/BottomSheet', () => ({ BottomSheet: () => null }));
vi.mock('../components/SheetScrollView', () => ({ SheetScrollView: () => null }));

const data: TokenSummary = { weeks: 4, refreshSeconds: 3600, thresholdTokens: 128000,
  startTs: 0, endTs: 1, dateKeys: [], dailyUsage: [], breakdown: [], quotaHistory: [],
  rankings: { providers: [], models: [], accounts: [] }, entryCount: 0,
  errors: { usage: false, analytics: false, quota: false } };

function renderedText(node: ReactNode): string {
  return Children.toArray(node).map(child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return String(child);
    if (typeof child.type === 'function') {
      const component = child.type as (props: { children?: ReactNode }) => ReactNode;
      return renderedText(component(child.props));
    }
    return renderedText(child.props.children);
  }).join('|');
}

beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => { setInterfaceLanguage('zh'); vi.unstubAllGlobals(); });

it.each(['zh', 'en', 'ru', 'ja'] as const)('uses semantic keys for native token metrics and quota controls in %s', language => {
  setInterfaceLanguage(language);
  const text = renderedText(<><UsageTotals data={data} /><UsageTrend data={data} />
    <ConsumptionPanels data={data} /><QuotaPanel data={data} /></>);
  for (const [key] of [...TOKEN_FIELDS, ...CONTEXT_FIELDS, ...MODE_FIELDS]) {
    expect(text).toContain(translateMessage(language, key));
  }
  for (const key of ['client.chat.hourly', 'client.chat.every6Hours', 'client.chat.daily',
    'client.chat.usagePerPeriod', 'client.accounts.remainingQuota'] as const) {
    expect(text).toContain(translateMessage(language, key));
  }
  if (language === 'en' || language === 'ru') expect(text).not.toMatch(/\p{Script=Han}/u);
});
