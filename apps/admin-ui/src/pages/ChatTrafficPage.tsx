import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/ChatTrafficPage';
import { interpolate as interpolateCopy } from '@remoteai/i18n';
import { useState } from "react";
import { Alert, Button, Card, DatePicker, Input, Space, Table, Tag, Typography } from "antd";
import type { TableProps } from "antd";
import dayjs from "dayjs";
import type { TrafficApi, UserChatTraffic, UserChatTrafficList } from "../chat-traffic-types";
import { useTrafficResource } from "../hooks/useTrafficResource";
import { useI18n } from "../i18n-context";
import { formatTrafficBytes } from "./chat-traffic-chart";
import { ChatTrafficDetailDrawer } from "./ChatTrafficDetailDrawer";
import { ChatTrafficLimitModal } from "./ChatTrafficLimitModal";
import { ChatTrafficSummary } from "./ChatTrafficSummary";
import "./chat-traffic.css";

type TrafficSortField = "monthBytes" | "totalBytes" | "monthUsedBytes";
type TrafficSortOrder = "ascend" | "descend";

function currentMonth() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" })
    .format(new Date());
}

export function ChatTrafficPage({ api, canManage, dark }: { api: TrafficApi; canManage: boolean; dark: boolean }) {
  const { language } = useI18n();
  const zh = language === "zh";
  const [month, setMonth] = useState(currentMonth);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<TrafficSortField>("monthBytes");
  const [sortOrder, setSortOrder] = useState<TrafficSortOrder>("descend");
  const [selected, setSelected] = useState<UserChatTraffic>();
  const [editing, setEditing] = useState<UserChatTraffic>();
  const query = new URLSearchParams({
    month, search, page: String(page), pageSize: String(pageSize), sortBy,
    sortOrder: sortOrder === "ascend" ? "asc" : "desc",
  });
  const { data, loading, error, refresh } = useTrafficResource<UserChatTrafficList>(api,
    `/admin/api/chat-traffic/users?${query}`);
  const bytes = (value: number) => formatTrafficBytes(value, language);
  const onTableChange: TableProps<UserChatTraffic>["onChange"] = (_, __, sorter, extra) => {
    if (extra.action !== "sort") return;
    const selectedSort = Array.isArray(sorter) ? sorter[0] : sorter;
    const field = selectedSort.columnKey;
    if (field !== "monthBytes" && field !== "totalBytes" && field !== "monthUsedBytes") return;
    setSortBy(field);
    setSortOrder(selectedSort.order === "ascend" ? "ascend" : "descend");
    setPage(1);
  };
  return <Space direction="vertical" size="large" className="chat-traffic-page" style={{ width: "100%" }}>
    <Typography.Title level={2}>{zh ? inlineCopy["text_b4355c29"] : inlineCopy["Chat_traffic_735b6e7f"]}</Typography.Title>
    <ChatTrafficSummary summary={data?.summary} month={month} loading={loading && !data} />
    <Card>
      <Space wrap style={{ marginBottom: 20 }}>
        <DatePicker picker="month" allowClear={false} value={dayjs(month)}
          aria-label={zh ? inlineCopy["text_76217303"] : inlineCopy["Reporting_month_04bf8d83"]}
          onChange={(value) => { if (value) { setMonth(value.format("YYYY-MM")); setPage(1); } }} />
        <Input.Search placeholder={zh ? inlineCopy["text_80ff0d53"] : inlineCopy["Search_user_email_873093a8"]} allowClear style={{ width: 260 }}
          onSearch={(value) => { setSearch(value.trim()); setPage(1); }} />
        <Button onClick={() => void refresh()} loading={loading}>{zh ? inlineCopy["text_aee88743"] : inlineCopy["Refresh_0e916101"]}</Button>
      </Space>
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }}
        message={zh ? inlineCopy["text_e43acadd"] : inlineCopy["Unable_to_load_traffic_Please_88ffc29f"]} />}
      <Table<UserChatTraffic> rowKey="id" dataSource={data?.items ?? []} loading={loading && !data}
        onChange={onTableChange} sortDirections={["descend", "ascend", "descend"]}
        scroll={{ x: 950 }} pagination={{ current: page, pageSize, total: data?.total ?? 0, showSizeChanger: true,
          onChange: (next, size) => { setPage(size !== pageSize ? 1 : next); setPageSize(size); } }} columns={[
          { title: zh ? inlineCopy["text_0d0e1a86"] : inlineCopy["User_b512d97e"], dataIndex: "email", width: 240, ellipsis: true },
          { title: zh ? interpolateCopy(inlineCopy["value1_e13bcecd"], { value1: String(month) }) : interpolateCopy(inlineCopy["value1_relay_2dd5ac60"], { value1: String(month) }), dataIndex: "monthBytes", key: "monthBytes",
            sorter: true, sortOrder: sortBy === "monthBytes" ? sortOrder : null, render: bytes },
          { title: zh ? inlineCopy["text_24299f67"] : inlineCopy["Total_relay_4fac8003"], dataIndex: "totalBytes", key: "totalBytes",
            sorter: true, sortOrder: sortBy === "totalBytes" ? sortOrder : null, render: bytes },
          { title: zh ? inlineCopy["text_723902bc"] : inlineCopy["Current_month_allowance_f4e61b8c"], key: "monthUsedBytes",
            sorter: true, sortOrder: sortBy === "monthUsedBytes" ? sortOrder : null,
            render: (_, user) => <Space direction="vertical" size={2}>
            <span>{bytes(user.monthUsedBytes)} / {user.monthlyLimitBytes === -1
              ? (zh ? inlineCopy["text_6cf3bcae"] : inlineCopy["Unlimited_11dde17d"]) : bytes(user.monthlyLimitBytes)}</span>
            {user.monthlyLimitBytes !== -1 && user.monthUsedBytes >= user.monthlyLimitBytes &&
              <Tag color="orange">{zh ? inlineCopy["text_38712a56"] : inlineCopy["Allowance_exhausted_b222980b"]}</Tag>}
          </Space> },
          { title: zh ? inlineCopy["text_ed31fbb4"] : inlineCopy["Actions_ff8059dc"], render: (_, user) => <Space>
            <Button type="link" onClick={() => setSelected(user)}>{zh ? inlineCopy["text_a748cc07"] : inlineCopy["Details_45989de4"]}</Button>
            {canManage && <Button type="link" onClick={() => setEditing(user)}>{zh ? inlineCopy["text_18262eec"] : inlineCopy["Set_allowance_8edf0d4f"]}</Button>}
          </Space> },
        ]} />
    </Card>
    {selected && <ChatTrafficDetailDrawer key={`${selected.id}:${month}`} user={selected} month={month}
      api={api} dark={dark} onClose={() => setSelected(undefined)} />}
    {editing && <ChatTrafficLimitModal key={editing.id} user={editing} api={api}
      onClose={() => setEditing(undefined)} onSaved={() => void refresh()} />}
  </Space>;
}
