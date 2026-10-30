import { downloadLabels as labels, downloadExplanation } from '@remoteai/i18n/copy/adminDownloadStatistics';
import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/UpdateDownloadStatistics';
import { interpolate as interpolateCopy } from '@remoteai/i18n';
import { Alert, Button, Card, Drawer, Select, Space, Table, Tag, Typography } from 'antd';
import { useI18n } from '../i18n-context';
import { useUpdateDownloadStatistics, type DailyDownloads, type FailureReport } from '../hooks/useUpdateDownloadStatistics';
import type { UpdateSharingSettingsProps } from '../hooks/useUpdateSharingSettings';



function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  return `${(value / 1024 ** 3).toFixed(2)} GiB`;
}

export function UpdateDownloadStatistics({ api }: Pick<UpdateSharingSettingsProps, 'api'>) {
  const { language } = useI18n();
  const zh = language === 'zh';
  const state = useUpdateDownloadStatistics(api);
  const label = (value: string) => labels[value]?.[zh ? 0 : 1] ?? value;
  const error = <Alert type="error" showIcon message={zh
    ? inlineCopy["text_b9415fa5"] : inlineCopy["Unable_to_load_download_statistics_2ee9b816"]} />;
  return <Card title={zh ? inlineCopy["text_fbacd955"] : inlineCopy["Daily_download_statistics_fe5288d8"]} extra={<Space wrap>
    <Select aria-label={zh ? inlineCopy["text_878000ec"] : inlineCopy["Date_range_8061bfb2"]} value={state.days} onChange={state.setDays}
      options={[7, 30, 90].map(value => ({ value, label: zh ? interpolateCopy(inlineCopy["value1_5b4964ca"], { value1: String(value) }) : interpolateCopy(inlineCopy["Last_value1_days_13c1d01c"], { value1: String(value) }) }))} />
    <Button onClick={state.reload} disabled={state.daily.loading}>{zh ? inlineCopy["text_aee88743"] : inlineCopy["Refresh_0e916101"]}</Button>
  </Space>}>
    <Typography.Paragraph type="secondary">{downloadExplanation[zh ? "zh" : "en"]}</Typography.Paragraph>
    {state.daily.failed && error}
    <Table<DailyDownloads> rowKey="date" size="small" loading={state.daily.loading}
      dataSource={state.daily.data?.items ?? []} pagination={{ pageSize: 15, showSizeChanger: false }}
      scroll={{ x: 1050 }} columns={[
        { title: zh ? inlineCopy["text_70d0c1b3"] : inlineCopy["Date_99c40ab4"], dataIndex: 'date', width: 120 },
        { title: zh ? inlineCopy["text_4ba60f8c"] : inlineCopy["Shared_downloads_16eeca9b"], dataIndex: 'peerDownloads' },
        { title: zh ? inlineCopy["text_473574e1"] : inlineCopy["Server_downloads_6973064b"], dataIndex: 'serverDownloads' },
        { title: zh ? inlineCopy["text_043929b6"] : inlineCopy["Server_users_d38e1d02"], dataIndex: 'serverUsers' },
        { title: zh ? inlineCopy["text_ad335906"] : inlineCopy["Shared_traffic_36840f3e"], dataIndex: 'peerBytes', render: bytes },
        { title: zh ? inlineCopy["text_9ef601c2"] : inlineCopy["Server_traffic_9bda8e66"], dataIndex: 'serverBytes', render: bytes },
        { title: zh ? inlineCopy["text_d9ebe4dd"] : inlineCopy["Unfinished_e1acaab9"], dataIndex: 'failedDownloads' },
        { title: zh ? inlineCopy["text_2004490e"] : inlineCopy["Failure_logs_59602151"], dataIndex: 'reportsWithFailures',
          render: (count: number, row) => <Button type="link" disabled={!count}
            onClick={() => state.showFailures(row.date)}>{count}</Button> },
      ]} />
    <Drawer title={`${state.date ?? ''} · ${zh ? inlineCopy["text_2004490e"] : inlineCopy["Failure_logs_59602151"]}`}
      open={state.date !== null} onClose={() => state.showFailures(null)} width={1000}>
      <Typography.Paragraph type="secondary">{zh
        ? inlineCopy["text_9d3b2415"]
        : inlineCopy["Includes_failures_recovered_by_switching_9f1b098c"]}</Typography.Paragraph>
      {state.failures.failed && error}
      <Table<FailureReport> rowKey={row => `${row.userId}:${row.id}`} loading={state.failures.loading}
        dataSource={state.failures.data?.items ?? []} size="small" scroll={{ x: 850 }}
        pagination={{ current: state.page, pageSize: 20, total: state.failures.data?.total ?? 0,
          showSizeChanger: false, onChange: state.setPage }} columns={[
          { title: zh ? inlineCopy["text_8b6ff498"] : inlineCopy["Time_33b93476"], dataIndex: 'createdAt', width: 170,
            render: (value: string) => new Date(value).toLocaleString(zh ? 'zh-CN' : 'en-GB',
              { timeZone: 'Asia/Shanghai', hour12: false }) },
          { title: zh ? inlineCopy["text_91088770"] : inlineCopy["Platform_c78ffe19"], dataIndex: 'platform', width: 90 },
          { title: zh ? inlineCopy["text_0d0e1a86"] : inlineCopy["User_b512d97e"], dataIndex: 'userId', width: 150, ellipsis: true },
          { title: zh ? inlineCopy["text_1095d89c"] : inlineCopy["Result_6e7d50e8"], dataIndex: 'outcome', width: 110,
            render: (value: string) => <Tag color={value === 'success' ? 'green' : 'red'}>{value === 'success'
              ? (zh ? inlineCopy["text_f28461bb"] : inlineCopy["Completed_22a970d2"]) : (zh ? inlineCopy["text_6707de42"] : inlineCopy["Unfinished_e1acaab9"])}</Tag> },
          { title: zh ? inlineCopy["text_f029d9cb"] : inlineCopy["Reason_f81ab834"], dataIndex: 'failures',
            render: (failures: FailureReport['failures']) => <Space direction="vertical" size={2}>
              {failures.map((failure, index) => <span key={index}>{label(failure.source)} · {label(failure.stage)} ·{' '}
                {label(failure.code)} × {failure.count}</span>)}
            </Space> },
        ]} />
    </Drawer>
  </Card>;
}
