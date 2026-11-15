/**
 * Google Analytics 4 (GA4) Integration Domain Types
 */

export interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  tokenType?: string;
}

export interface GoogleUserInfo {
  id: string; // Google 'sub'
  email: string;
  name?: string;
  picture?: string;
}

export interface GA4Account {
  name: string; // e.g. "accounts/123456"
  accountId: string; // e.g. "123456"
  displayName: string;
  regionCode?: string;
}

export interface GA4PropertyMetadata {
  name: string; // e.g. "properties/987654321"
  propertyId: string; // numeric digits, e.g. "987654321"
  displayName: string;
  parentAccount?: string; // e.g. "accounts/123456"
  currencyCode?: string; // e.g. "USD", "EUR"
  timeZone?: string; // e.g. "America/New_York", "UTC"
  createTime?: string;
}

// ----------------------------------------------------
// Normalized Report Response Types
// ----------------------------------------------------

export interface ReportMetadata {
  propertyId: string;
  displayName?: string;
  timeZone?: string;
  currencyCode?: string;
  dateRange: string;
  startDate?: string;
  endDate?: string;
  fetchedAt: string;
  isCached: boolean;
  cacheExpiresAt?: string;
  isStale?: boolean;
  rowCount?: number;
}

export interface MetricValue {
  value: number;
  formattedValue?: string;
}

export interface OverviewReport {
  metadata: ReportMetadata;
  summary: {
    activeUsers: number;
    totalUsers: number;
    newUsers: number;
    sessions: number;
    screenPageViews: number;
    engagementRate: number; // Percentage (0-100)
    bounceRate: number; // Percentage (0-100)
    averageSessionDuration: number; // Seconds
    eventCount: number;
    conversions: number;
  };
  trend: Array<{
    date: string;
    activeUsers: number;
    sessions: number;
    screenPageViews: number;
  }>;
}

export interface RealtimeReport {
  metadata: ReportMetadata;
  activeUsersLast30Minutes: number;
  minuteByMinute: Array<{
    minuteAgo: number;
    activeUsers: number;
  }>;
  byCountry: Array<{
    country: string;
    activeUsers: number;
  }>;
  byDevice: Array<{
    deviceCategory: string;
    activeUsers: number;
  }>;
  topPages: Array<{
    pageTitle: string;
    pagePath: string;
    activeUsers: number;
  }>;
}

export interface TrafficChannel {
  channelGroup: string;
  sourceMedium?: string;
  campaign?: string;
  sessions: number;
  activeUsers: number;
  newUsers: number;
  engagementRate: number;
  conversions: number;
  eventCount: number;
}

export interface TrafficReport {
  metadata: ReportMetadata;
  channels: TrafficChannel[];
}

export interface AudienceReport {
  metadata: ReportMetadata;
  countries: Array<{ country: string; activeUsers: number; sessions: number }>;
  cities: Array<{ city: string; country: string; activeUsers: number }>;
  userTypes: Array<{ userType: string; activeUsers: number }>;
}

export interface TechnologyReport {
  metadata: ReportMetadata;
  deviceCategories: Array<{ category: string; activeUsers: number; sessions: number }>;
  browsers: Array<{ browser: string; activeUsers: number; sessions: number }>;
  operatingSystems: Array<{ os: string; activeUsers: number; sessions: number }>;
}

export interface PageContentItem {
  pageTitle: string;
  pagePath: string;
  screenPageViews: number;
  activeUsers: number;
  averageEngagementTime: number;
  bounceRate: number;
}

export interface PagesReport {
  metadata: ReportMetadata;
  pages: PageContentItem[];
}

export interface EventItem {
  eventName: string;
  eventCount: number;
  totalUsers: number;
  eventCountPerUser: number;
}

export interface EventsReport {
  metadata: ReportMetadata;
  events: EventItem[];
}
