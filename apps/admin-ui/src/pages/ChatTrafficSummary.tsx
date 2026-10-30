import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/ChatTrafficSummary';
import { Card, Skeleton, Statistic } from "antd";
import type { UserChatTrafficSummary } from "../chat-traffic-types";
import { useI18n } from "../i18n-context";
import { formatTrafficBytes } from "./chat-traffic-chart";

interface ChatTrafficSummaryProps {
  summary?: UserChatTrafficSummary;
  month: string;
  loading: boolean;
}

export function ChatTrafficSummary({ summary, month, loading }: ChatTrafficSummaryProps) {
  const { language } = useI18n();
  const zh = language === "zh";
  const bytes = (value: number) => formatTrafficBytes(value, language);
  const metrics = [
    { title: zh ? inlineCopy["text_75ede56c"] : inlineCopy["Monthly_usage_8525c1d2"], period: month, value: summary && bytes(summary.monthBytes) },
    { title: zh ? inlineCopy["text_72d42b47"] : inlineCopy["Total_relay_traffic_ac8c4c71"], value: summary && bytes(summary.totalBytes) },
    { title: zh ? inlineCopy["text_431e64e6"] : inlineCopy["Monthly_active_users_0f29d6a6"], period: month, value: summary?.monthActiveUsers },
    { title: zh ? inlineCopy["text_af9528cd"] : inlineCopy["Total_active_users_6697f703"], value: summary?.totalActiveUsers },
  ];

  return <div className="chat-traffic-user-summary" aria-busy={loading}>
    {metrics.map((metric) => <Card key={metric.title} size="small">
      <div className="chat-traffic-metric-title">
        <span>{metric.title}</span>{metric.period && <span>{metric.period}</span>}
      </div>
      {loading ? <Skeleton.Input active size="small" /> : <Statistic value={metric.value ?? "—"} />}
    </Card>)}
  </div>;
}
