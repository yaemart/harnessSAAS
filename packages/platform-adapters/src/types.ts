export type ReportStatus = 'PENDING' | 'COMPLETED';

export interface FetchPerformanceRequest {
  listingId: string;
  commodityId?: string;
  startDate: string;
  endDate: string;
}

export interface PerformanceMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  normalizedRoas: number;
}

export interface ReportRequest extends FetchPerformanceRequest {}

export interface PerformanceReport {
  reportId: string;
  status: ReportStatus;
  requestedAt: string;
  completedAt?: string;
  rows?: PerformanceMetrics[];
}

export interface IPlatformAdsAdapter {
  fetchListingPerformance(request: FetchPerformanceRequest): Promise<PerformanceMetrics>;
  requestPerformanceReport(request: ReportRequest): Promise<PerformanceReport>;
  getPerformanceReport(reportId: string): Promise<PerformanceReport>;
}

export type PlatformCode = 'amazon' | 'walmart' | 'tiktok' | 'meta';

export interface IPlatformAgent {
  platform: PlatformCode;
  ads: IPlatformAdsAdapter;
}
