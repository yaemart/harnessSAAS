import { gunzipSync } from 'node:zlib';
import PQueue from 'p-queue';
import type {
  FetchPerformanceRequest,
  IPlatformAdsAdapter,
  PerformanceMetrics,
  PerformanceReport,
  ReportRequest,
} from './types.js';

interface AmazonCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface AmazonAdsRealAdapterOptions {
  credentials: AmazonCredentials;
  profileId: string;
  apiBaseUrl: string;
  tokenUrl?: string;
  timeoutMs?: number;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

class AmazonLwaTokenManager {
  private cachedToken: string | null = null;
  private expiresAt = 0;
  private refreshInFlight: Promise<string> | null = null;

  constructor(
    private readonly credentials: AmazonCredentials,
    private readonly tokenUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.expiresAt - 30_000) {
      return this.cachedToken;
    }

    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.refreshToken();
    try {
      const token = await this.refreshInFlight;
      return token;
    } finally {
      this.refreshInFlight = null;
    }
  }

  private async refreshToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.credentials.refreshToken,
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`LWA refresh failed: ${res.status}`);
      }

      const token = (await res.json()) as TokenResponse;
      this.cachedToken = token.access_token;
      this.expiresAt = Date.now() + token.expires_in * 1000;
      return token.access_token;
    } finally {
      clearTimeout(timer);
    }
  }
}

function safeNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function aggregateRows(rows: PerformanceMetrics[]): PerformanceMetrics {
  const totals = rows.reduce<{
    impressions: number;
    clicks: number;
    spend: number;
    sales: number;
    orders: number;
  }>(
    (acc, row) => ({
      impressions: acc.impressions + safeNumber(row.impressions),
      clicks: acc.clicks + safeNumber(row.clicks),
      spend: acc.spend + safeNumber(row.spend),
      sales: acc.sales + safeNumber(row.sales),
      orders: acc.orders + safeNumber(row.orders),
    }),
    { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0 },
  );

  const normalizedRoas = totals.spend > 0 ? Number((totals.sales / totals.spend).toFixed(4)) : 0;
  return {
    impressions: Math.round(totals.impressions),
    clicks: Math.round(totals.clicks),
    spend: Number(totals.spend.toFixed(2)),
    sales: Number(totals.sales.toFixed(2)),
    orders: Math.round(totals.orders),
    normalizedRoas,
  };
}

function parseNdjsonGzip(input: Uint8Array): Array<Record<string, unknown>> {
  const unzipped = gunzipSync(input).toString('utf8');
  const lines = unzipped.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

export class AmazonAdsRealAdapter implements IPlatformAdsAdapter {
  private readonly timeoutMs: number;
  private readonly tokenManager: AmazonLwaTokenManager;
  private readonly apiBaseUrl: string;
  private readonly profileId: string;
  private readonly credentials: AmazonCredentials;
  private readonly queues: Record<string, PQueue>;

  constructor(options: AmazonAdsRealAdapterOptions) {
    this.credentials = options.credentials;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.profileId = options.profileId;
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, '');
    this.tokenManager = new AmazonLwaTokenManager(
      options.credentials,
      options.tokenUrl ?? 'https://api.amazon.com/auth/o2/token',
      this.timeoutMs,
    );

    // Grouped rate limits to avoid one API family starving another.
    this.queues = {
      reports: new PQueue({ concurrency: 2, interval: 1000, intervalCap: 4 }),
      profile: new PQueue({ concurrency: 2, interval: 1000, intervalCap: 4 }),
      default: new PQueue({ concurrency: 3, interval: 1000, intervalCap: 6 }),
    };
  }

  async fetchListingPerformance(request: FetchPerformanceRequest): Promise<PerformanceMetrics> {
    const report = await this.requestPerformanceReport(request);
    let latest = report;

    for (let i = 0; i < 8; i += 1) {
      if (latest.status === 'COMPLETED' && latest.rows?.length) {
        return aggregateRows(latest.rows as PerformanceMetrics[]);
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(4000, 500 * (i + 1))));
      latest = await this.getPerformanceReport(report.reportId);
    }

    throw new Error(`Amazon report timeout: ${report.reportId}`);
  }

  async requestPerformanceReport(request: ReportRequest): Promise<PerformanceReport> {
    const payload = {
      name: `listing-${request.listingId}-${Date.now()}`,
      startDate: request.startDate,
      endDate: request.endDate,
      configuration: {
        reportTypeId: 'spCampaigns',
        format: 'GZIP_JSON',
        groupBy: ['campaign'],
        filters: [{ field: 'campaignId', values: [request.listingId] }],
      },
    };

    const data = await this.withRateLimit('reports', async () =>
      this.requestJson<{ reportId: string }>('/reporting/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );

    return {
      reportId: data.reportId,
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
    };
  }

  async getPerformanceReport(reportId: string): Promise<PerformanceReport> {
    const report = await this.withRateLimit('reports', async () =>
      this.requestJson<{ status: string; location?: string; generatedAt?: string }>(
        `/reporting/reports/${reportId}`,
      ),
    );

    const normalizedStatus = report.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING';
    if (normalizedStatus !== 'COMPLETED' || !report.location) {
      return {
        reportId,
        status: 'PENDING',
        requestedAt: new Date().toISOString(),
      };
    }

    const rows = await this.downloadReportRows(report.location);

    return {
      reportId,
      status: 'COMPLETED',
      requestedAt: new Date().toISOString(),
      completedAt: report.generatedAt ?? new Date().toISOString(),
      rows: rows.map((row) => ({
        impressions: safeNumber(row.impressions),
        clicks: safeNumber(row.clicks),
        spend: safeNumber(row.spend),
        sales: safeNumber(row.sales),
        orders: safeNumber(row.orders),
        normalizedRoas:
          safeNumber(row.spend) > 0 ? Number((safeNumber(row.sales) / safeNumber(row.spend)).toFixed(4)) : 0,
      })),
    };
  }

  private async downloadReportRows(location: string): Promise<Array<Record<string, unknown>>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(location, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Report download failed: ${res.status}`);
      }
      const raw = new Uint8Array(await res.arrayBuffer());
      return parseNdjsonGzip(raw);
    } finally {
      clearTimeout(timer);
    }
  }

  private async withRateLimit<T>(group: keyof AmazonAdsRealAdapter['queues'], fn: () => Promise<T>): Promise<T> {
    const queue = this.queues[group] ?? this.queues.default;
    const result = await queue.add(fn);
    if (result === undefined) {
      throw new Error(`Rate-limited task for group ${group} completed without result`);
    }
    return result as T;
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.tokenManager.getAccessToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.apiBaseUrl}${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          'amazon-advertising-api-clientid': this.credentials.clientId,
          'amazon-advertising-api-scope': this.profileId,
          ...(init?.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Amazon API failed: ${res.status} ${body}`);
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
