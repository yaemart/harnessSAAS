'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getReplayAuditReport,
  getReplayAuditSettings,
  saveReplayAuditSettings,
  type ReplayAuditDailyBucket,
  type ReplayAuditRecentEvent,
  type ReplayAuditReport,
} from '../lib/api';
import { useTenant } from './tenant-context';

const DEFAULT_TENANT = '11111111-1111-1111-1111-111111111111';
const DEFAULT_HOURS = 24;
const DEFAULT_THRESHOLD = 5;
const AUTO_REFRESH_SECONDS = 30;

function formatDate(dateLike: string | null): string {
  const date = new Date(dateLike ?? '');
  if (Number.isNaN(date.getTime())) return dateLike ?? '';
  return date.toLocaleString();
}

function eventLabel(eventType: ReplayAuditRecentEvent['eventType']): string {
  if (eventType === 'NONCE_REPLAY_BLOCKED') return '重放拦截';
  if (eventType === 'NONCE_INVALID_BLOCKED') return '非法 nonce 拦截';
  return '缺失 nonce 拦截';
}

function buildPolylinePoints(buckets: ReplayAuditDailyBucket[], width: number, height: number): string {
  if (buckets.length === 0) return '';
  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const step = buckets.length === 1 ? 0 : width / (buckets.length - 1);

  return buckets
    .map((bucket, index) => {
      const x = index * step;
      const y = height - (bucket.count / maxCount) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

function buildBars(
  buckets: ReplayAuditDailyBucket[],
  width: number,
  height: number,
): Array<{ x: number; y: number; w: number; h: number; count: number }> {
  if (buckets.length === 0) return [];
  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const gap = 8;
  const barWidth = Math.max(10, (width - gap * (buckets.length - 1)) / buckets.length);

  return buckets.map((bucket, index) => {
    const h = (bucket.count / maxCount) * height;
    const x = index * (barWidth + gap);
    const y = height - h;
    return { x, y, w: barWidth, h, count: bucket.count };
  });
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, header: string[], rows: Array<Array<unknown>>): void {
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(row.map((item) => csvEscape(item)).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function ReplayAuditDashboard() {
  const { currentTenant, currentTenantId: tenantId, switchTenant } = useTenant();
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [savedThreshold, setSavedThreshold] = useState(DEFAULT_THRESHOLD);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [report, setReport] = useState<ReplayAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const next = await getReplayAuditReport(tenantId, hours);
      setReport(next);
      setLastRefreshedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, hours]);

  const loadSettings = useCallback(async (): Promise<void> => {
    try {
      const settings = await getReplayAuditSettings(tenantId);
      setThreshold(settings.threshold);
      setSavedThreshold(settings.threshold);
    } catch (err) {
      setError(err instanceof Error ? err.message : '阈值加载失败');
      setThreshold(DEFAULT_THRESHOLD);
      setSavedThreshold(DEFAULT_THRESHOLD);
    }
  }, [tenantId]);

  useEffect(() => {
    void (async () => {
      await loadSettings();
      await refresh();
    })();
  }, [loadSettings, refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void refresh();
    }, AUTO_REFRESH_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, refresh]);

  const maxDailyCount = useMemo(() => {
    if (!report || report.dailyBuckets.length === 0) return 0;
    return Math.max(...report.dailyBuckets.map((item) => item.count));
  }, [report]);

  const status = useMemo(() => {
    if (!report) return 'unknown';
    if (report.totalBlocked >= threshold || maxDailyCount >= threshold) return 'critical';
    if (report.totalBlocked >= Math.max(1, Math.floor(threshold * 0.6))) return 'warning';
    return 'normal';
  }, [maxDailyCount, report, threshold]);

  const trendPoints = useMemo(() => {
    if (!report) return '';
    return buildPolylinePoints(report.dailyBuckets, 560, 180);
  }, [report]);

  const bars = useMemo(() => {
    if (!report) return [];
    return buildBars(report.dailyBuckets, 560, 180);
  }, [report]);

  const hasUnsavedThreshold = threshold !== savedThreshold;

  async function handleSaveThreshold(): Promise<void> {
    try {
      setError(null);
      const result = await saveReplayAuditSettings(tenantId, threshold);
      setThreshold(result.threshold);
      setSavedThreshold(result.threshold);
      setMessage(`阈值已保存（${result.threshold}）`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '阈值保存失败');
    }
  }

  function handleExportDailyCsv(): void {
    if (!report) return;
    const rows = report.dailyBuckets.map((item) => [item.date, item.count]);
    downloadCsv(`replay_audit_daily_${tenantId}.csv`, ['date', 'count'], rows);
  }

  function handleExportRecentCsv(): void {
    if (!report) return;
    const rows = report.recent.map((item) => [
      item.id,
      item.eventType,
      item.severity,
      item.createdAt,
      JSON.stringify(item.details ?? {}),
    ]);
    downloadCsv(
      `replay_audit_recent_${tenantId}.csv`,
      ['id', 'event_type', 'severity', 'created_at', 'details_json'],
      rows,
    );
  }

  function handleExportCombinedCsv(): void {
    if (!report) return;
    const rows: Array<Array<unknown>> = [
      ...report.dailyBuckets.map((item) => [
        'daily_bucket',
        item.date,
        item.count,
        '',
        '',
        '',
        '',
      ]),
      ...report.recent.map((item) => [
        'recent_event',
        '',
        '',
        item.id,
        item.eventType,
        item.severity,
        JSON.stringify(item.details ?? {}),
      ]),
    ];
    downloadCsv(
      `replay_audit_combined_${tenantId}.csv`,
      ['dataset', 'date', 'count', 'id', 'event_type', 'severity', 'details_json'],
      rows,
    );
  }

  return (
    <main>
      <div className="header">
        <div>
          <h1 className="ios-title">Replay Audit Panel</h1>
          <p className="ios-subtitle">Simulate historical state drops and review rule execution · {currentTenant?.name}</p>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <label htmlFor="tenant-id" className="small">
              Tenant ID
            </label>
            <select
              className="select"
              value={tenantId || ''}
              onChange={(event) => switchTenant(event.target.value)}
              style={{ display: 'block', width: 360, padding: 8 }}
            >
              {/* Add options here if needed */}
            </select>
          </div>
          <div>
            <label htmlFor="hours" className="small">
              时间窗口 (小时)
            </label>
            <input
              id="hours"
              type="number"
              min={1}
              max={720}
              value={hours}
              onChange={(event) => setHours(Number(event.target.value))}
              style={{ display: 'block', width: 120, padding: 8 }}
            />
          </div>
          <div>
            <label htmlFor="threshold" className="small">
              告警阈值 (拦截次数)
            </label>
            <input
              id="threshold"
              type="number"
              min={1}
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
              style={{ display: 'block', width: 160, padding: 8 }}
            />
            <div className="small" style={{ marginTop: 4 }}>
              {hasUnsavedThreshold ? '未保存变更' : '已同步到租户配置'}
            </div>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading} title="Reload the replay audit events">
            {loading ? '刷新中...' : '刷新'}
          </button>
          <button
            type="button"
            title="Save the new threshold limit to the tenant settings"
            onClick={() => void handleSaveThreshold()}
            disabled={!hasUnsavedThreshold || loading}
          >
            保存阈值
          </button>
          <button type="button" onClick={() => setAutoRefresh((prev) => !prev)} title="Toggle automatic refreshing of events">
            {autoRefresh ? '暂停自动刷新' : '恢复自动刷新'}
          </button>
        </div>
        <div className="small" style={{ marginTop: 10 }}>
          自动刷新：{autoRefresh ? `开启（每 ${AUTO_REFRESH_SECONDS} 秒）` : '已暂停'}
          {lastRefreshedAt ? ` ｜ 最近刷新：${formatDate(lastRefreshedAt)}` : ''}
        </div>
      </div>

      {error ? (
        <div className="card" style={{ padding: 16, color: '#b42318', marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="card" style={{ padding: 16, color: '#067647', marginBottom: 16 }}>
          {message}
        </div>
      ) : null}

      {report ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div className="card" style={{ padding: 16 }}>
              <div className="small">总拦截数</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{report.totalBlocked}</div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div className="small">窗口开始</div>
              <div style={{ fontSize: 14 }}>{formatDate(report.since)}</div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div className="small">日峰值</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{maxDailyCount}</div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div className="small">告警状态</div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: status === 'critical' ? '#b42318' : status === 'warning' ? '#8a5b00' : '#067647',
                }}
              >
                {status === 'critical' ? 'CRITICAL' : status === 'warning' ? 'WARNING' : 'NORMAL'}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div className="header" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>趋势图（按日）</h2>
              <p className="small" style={{ margin: 0 }}>
                阈值：{threshold}，超阈将标红
              </p>
            </div>

            {report.dailyBuckets.length === 0 ? (
              <p className="small">窗口内暂无 replay 拦截事件</p>
            ) : (
              <>
                <svg
                  viewBox="0 0 560 200"
                  width="100%"
                  height="220"
                  role="img"
                  aria-label="Replay blocked trend"
                >
                  <line x1={0} y1={190} x2={560} y2={190} stroke="#cbd5e1" strokeWidth={1} />
                  <line
                    x1={0}
                    y1={190 - (Math.min(threshold, Math.max(maxDailyCount, 1)) / Math.max(maxDailyCount, 1)) * 180}
                    x2={560}
                    y2={190 - (Math.min(threshold, Math.max(maxDailyCount, 1)) / Math.max(maxDailyCount, 1)) * 180}
                    stroke="#b42318"
                    strokeDasharray="6 4"
                    strokeWidth={1}
                  />
                  <g transform="translate(0,10)">
                    {bars.map((bar) => (
                      <rect
                        key={`${bar.x}-${bar.y}`}
                        x={bar.x}
                        y={bar.y}
                        width={bar.w}
                        height={bar.h}
                        fill={bar.count >= threshold ? '#fca5a5' : '#bfdbfe'}
                        rx={3}
                      />
                    ))}
                    <polyline fill="none" stroke="#0b57d0" strokeWidth={2} points={trendPoints} />
                  </g>
                </svg>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: 8,
                  }}
                >
                  {report.dailyBuckets.map((bucket) => (
                    <div
                      key={bucket.date}
                      className="small"
                      style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}
                    >
                      <div>{bucket.date}</div>
                      <strong style={{ color: bucket.count >= threshold ? '#b42318' : undefined }}>
                        {bucket.count}
                      </strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div className="header" style={{ marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>归档导出（CSV）</h2>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={handleExportDailyCsv} title="Export daily anomaly count summary to CSV">
                导出 dailyBuckets.csv
              </button>
              <button type="button" onClick={handleExportRecentCsv} title="Export recent events list to CSV">
                导出 recent.csv
              </button>
              <button type="button" onClick={handleExportCombinedCsv} title="Export combined metrics and events to a single CSV file">
                导出 combined.csv
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>类型分布</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 10,
              }}
            >
              {Object.entries(report.countsByType).map(([type, count]) => (
                <div key={type} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                  <div className="small">{eventLabel(type as ReplayAuditRecentEvent['eventType'])}</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{count}</div>
                </div>
              ))}
              {Object.keys(report.countsByType).length === 0 ? <p className="small">暂无数据</p> : null}
            </div>
          </div>

          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>事件类型</th>
                  <th>级别</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {report.recent.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No recent replay events.</td>
                  </tr>
                ) : null}
                {report.recent.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDate(event.createdAt)}</td>
                    <td>{eventLabel(event.eventType)}</td>
                    <td>
                      <span
                        className={`status ${event.severity === 'CRITICAL' ? 'REJECTED' : event.severity === 'WARNING' ? 'PENDING' : 'APPROVED'}`}
                      >
                        {event.severity}
                      </span>
                    </td>
                    <td>
                      <code style={{ fontSize: 12 }}>
                        {event.details ? JSON.stringify(event.details) : '{}'}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </main>
  );
}
