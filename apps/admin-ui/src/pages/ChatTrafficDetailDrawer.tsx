import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/ChatTrafficDetailDrawer';
import { useState } from "react";
import { Alert, Button, Drawer, Space, Table, Typography } from "antd";
import type { TrafficApi, UserChatTraffic, UserChatTrafficDetail } from "../chat-traffic-types";
import { useTrafficResource } from "../hooks/useTrafficResource";
import { useI18n } from "../i18n-context";
import { ChatTrafficPanel } from "./ChatTrafficPanel";
import { formatTrafficBytes } from "./chat-traffic-chart";

export function ChatTrafficDetailDrawer({ user, month, api, dark, onClose }: {
  user: UserChatTraffic; month: string; api: TrafficApi; dark: boolean; onClose: () => void;
}) {
  const { language } = useI18n();
  const zh = language === "zh";
  const [selectedDate, setSelectedDate] = useState<string>();
  const { data, loading, error, refresh } = useTrafficResource<UserChatTrafficDetail>(api,
    `/admin/api/chat-traffic/users/${user.id}?month=${month}`);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date());
  const selected = data?.daily.find((day) => day.date === (selectedDate ?? today))
    ?? data?.daily[data.daily.length - 1];
  const hours = selected?.hourlyBytes.map((bytes, hour) => ({
    time: `${selected.date} ${String(hour).padStart(2, "0")}:00`, bytes,
  })) ?? [];
  return <Drawer open title={zh ? inlineCopy["text_81b55c37"] : inlineCopy["User_traffic_details_4878cacc"]} width={1000} onClose={onClose}>
    <Space direction="vertical" size="large" className="chat-traffic-detail" style={{ width: "100%" }}>
      <Space wrap><Typography.Text strong>{user.email}</Typography.Text><Typography.Text>{month}</Typography.Text>
        <Button loading={loading} onClick={() => void refresh()}>{zh ? inlineCopy["text_aee88743"] : inlineCopy["Refresh_0e916101"]}</Button></Space>
      {error && <Alert type="error" showIcon message={zh ? inlineCopy["text_e43acadd"] : inlineCopy["Unable_to_load_traffic_Please_88ffc29f"]} />}
      <ChatTrafficPanel data={data} loading={loading} dark={dark} date={selected?.date} onDateChange={setSelectedDate} />
      <Typography.Title level={5}>{zh ? inlineCopy["text_12f7a82b"] : inlineCopy["Hourly_details_UTC8_450884e1"]}</Typography.Title>
      <Table rowKey="time" size="small" dataSource={hours} loading={loading && !data}
        pagination={false} columns={[
          { title: zh ? inlineCopy["text_8b6ff498"] : inlineCopy["Time_33b93476"], dataIndex: "time" },
          { title: zh ? inlineCopy["text_8cf5fe85"] : inlineCopy["Relay_traffic_250c5414"], dataIndex: "bytes", align: "right",
            render: (bytes: number) => formatTrafficBytes(bytes, language) },
          { title: zh ? inlineCopy["text_42a1d9e5"] : inlineCopy["Bytes_4d800030"], dataIndex: "bytes", align: "right",
            render: (bytes: number) => bytes.toLocaleString() },
        ]} />
    </Space>
  </Drawer>;
}
