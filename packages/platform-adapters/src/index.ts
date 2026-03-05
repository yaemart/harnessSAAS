import type {
  FetchPerformanceRequest,
  IPlatformAgent,
  IPlatformAdsAdapter,
  PlatformCode,
  PerformanceMetrics,
  PerformanceReport,
  ReportRequest,
} from './types.js';
export type {
  FetchPerformanceRequest,
  IPlatformAgent,
  IPlatformAdsAdapter,
  PlatformCode,
  PerformanceMetrics,
  PerformanceReport,
  ReportRequest,
} from './types.js';
export { AmazonAdsRealAdapter } from './amazon-real.js';

const reportStore = new Map<string, { requestedAt: number; request: ReportRequest }>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function buildDeterministicMetrics(seedKey: string): PerformanceMetrics {
  const seed = hashString(seedKey);
  const impressions = 800 + (seed % 14000);
  const ctr = 0.018 + ((seed % 40) / 1000);
  const clicks = Math.max(1, Math.floor(impressions * ctr));
  const cpc = 0.35 + ((seed % 120) / 100);
  const spend = Number((clicks * cpc).toFixed(2));
  const cvr = 0.03 + ((seed % 30) / 1000);
  const orders = Math.max(1, Math.floor(clicks * cvr));
  const aov = 18 + (seed % 55);
  const sales = Number((orders * aov).toFixed(2));
  const normalizedRoas = spend === 0 ? 0 : Number((sales / spend).toFixed(4));

  return { impressions, clicks, spend, sales, orders, normalizedRoas };
}

export class MockAmazonAdsAdapter implements IPlatformAdsAdapter {
  private readonly latencyMs: number;

  constructor(options?: { latencyMs?: number }) {
    this.latencyMs = options?.latencyMs ?? 500;
  }

  async fetchListingPerformance(request: FetchPerformanceRequest): Promise<PerformanceMetrics> {
    await sleep(this.latencyMs);
    const seedKey = `${request.commodityId ?? request.listingId}:${request.startDate}:${request.endDate}`;
    return buildDeterministicMetrics(seedKey);
  }

  async requestPerformanceReport(request: ReportRequest): Promise<PerformanceReport> {
    await sleep(this.latencyMs);
    const reportId = `rpt_${hashString(`${request.listingId}:${request.startDate}:${Date.now()}`)}`;
    const requestedAtMs = Date.now();
    reportStore.set(reportId, { requestedAt: requestedAtMs, request });

    return {
      reportId,
      status: 'PENDING',
      requestedAt: new Date(requestedAtMs).toISOString(),
    };
  }

  async getPerformanceReport(reportId: string): Promise<PerformanceReport> {
    await sleep(this.latencyMs);
    const report = reportStore.get(reportId);
    if (!report) {
      return {
        reportId,
        status: 'COMPLETED',
        requestedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        rows: [],
      };
    }

    const now = Date.now();
    if (now - report.requestedAt < this.latencyMs) {
      return {
        reportId,
        status: 'PENDING',
        requestedAt: new Date(report.requestedAt).toISOString(),
      };
    }

    const metrics = await this.fetchListingPerformance(report.request);
    return {
      reportId,
      status: 'COMPLETED',
      requestedAt: new Date(report.requestedAt).toISOString(),
      completedAt: new Date(now).toISOString(),
      rows: [metrics],
    };
  }
}

export class MockWalmartAdsAdapter implements IPlatformAdsAdapter {
  private readonly latencyMs: number;

  constructor(options?: { latencyMs?: number }) {
    this.latencyMs = options?.latencyMs ?? 450;
  }

  async fetchListingPerformance(request: FetchPerformanceRequest): Promise<PerformanceMetrics> {
    await sleep(this.latencyMs);
    const seedKey = `walmart:${request.commodityId ?? request.listingId}:${request.startDate}:${request.endDate}`;
    return buildDeterministicMetrics(seedKey);
  }

  async requestPerformanceReport(request: ReportRequest): Promise<PerformanceReport> {
    await sleep(this.latencyMs);
    const reportId = `wm_rpt_${hashString(`${request.listingId}:${request.startDate}:${Date.now()}`)}`;
    const requestedAtMs = Date.now();
    reportStore.set(reportId, { requestedAt: requestedAtMs, request });
    return {
      reportId,
      status: 'PENDING',
      requestedAt: new Date(requestedAtMs).toISOString(),
    };
  }

  async getPerformanceReport(reportId: string): Promise<PerformanceReport> {
    await sleep(this.latencyMs);
    const report = reportStore.get(reportId);
    if (!report) {
      return {
        reportId,
        status: 'COMPLETED',
        requestedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        rows: [],
      };
    }

    const now = Date.now();
    if (now - report.requestedAt < this.latencyMs) {
      return {
        reportId,
        status: 'PENDING',
        requestedAt: new Date(report.requestedAt).toISOString(),
      };
    }

    const metrics = await this.fetchListingPerformance(report.request);
    return {
      reportId,
      status: 'COMPLETED',
      requestedAt: new Date(report.requestedAt).toISOString(),
      completedAt: new Date(now).toISOString(),
      rows: [metrics],
    };
  }
}

export class PlatformAgentRegistry {
  private readonly map = new Map<PlatformCode, IPlatformAgent>();

  register(agent: IPlatformAgent): void {
    this.map.set(agent.platform, agent);
  }

  get(platform: string): IPlatformAgent | null {
    const key = platform.toLowerCase() as PlatformCode;
    return this.map.get(key) ?? null;
  }

  platforms(): PlatformCode[] {
    return [...this.map.keys()];
  }
}
