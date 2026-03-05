export interface BrandPortalConfig {
  brandId: string;
  brandCode: string;
  brandName: string;
  themeId: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  primaryColor: string | null;
  welcomeMessage: string | null;
  supportEmail: string | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface CommoditySummary {
  id: string;
  marketId: string;
  language: string;
  title: string;
  warrantyPeriodMonths: number | null;
}

export interface ProductSummary {
  id: string;
  sku: string;
  name: string;
  imageUrls: string[];
  category: Category | null;
  commodities: CommoditySummary[];
}

export interface Brand {
  id: string;
  name: string;
  code: string;
}

export interface Market {
  id: string;
  code: string;
  name: string;
  currency: string;
}

export interface CommodityMedia {
  id: string;
  type: string;
  title: string | null;
  url: string;
  platform: string | null;
  language: string | null;
  aiSummary: string | null;
  duration: number | null;
  sortOrder?: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  imageUrls: string[];
  structuredFeatures: Record<string, unknown> | null;
  scenarios: string[];
  targetIntents: string[];
  competitiveEdges: string[];
  category: Category | null;
  brand: Brand;
}

export interface CommodityDetail {
  id: string;
  title: string;
  bulletPoints: string[];
  language: string;
  warrantyPeriodMonths: number | null;
  localSupportContact: string | null;
  product: Product;
  market: Market;
  media: CommodityMedia[];
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  commodityId: string | null;
}

export interface ListingSummary {
  id: string;
  externalListingId: string;
  title: string;
  isPrimary: boolean;
  platform: {
    id: string;
    code: string;
    name: string;
  };
}
