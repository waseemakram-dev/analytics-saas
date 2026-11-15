import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/server/database/prisma";
import {
  OverviewReport,
  RealtimeReport,
  TrafficReport,
  AudienceReport,
  TechnologyReport,
  PagesReport,
  EventsReport,
} from "../types/ga4.types";
import { analyticsCacheService } from "../caching/analyticsCacheService";
import { generateQueryHash } from "../security/queryHash";
import { createAuthenticatedClient } from "../oauth/googleOAuthClient";
import { integrationRepository } from "../repositories/integrationRepository";
import { propertyRepository } from "../repositories/propertyRepository";

export interface DateRangeResolution {
  startDate: string;
  endDate: string;
  label: string;
}

export function resolveDateRange(range = "30d"): DateRangeResolution {
  const normalized = range.toLowerCase().trim();

  switch (normalized) {
    case "today":
      return { startDate: "today", endDate: "today", label: "today" };
    case "yesterday":
      return { startDate: "yesterday", endDate: "yesterday", label: "yesterday" };
    case "7d":
    case "last7days":
      return { startDate: "7daysAgo", endDate: "today", label: "7d" };
    case "90d":
    case "last90days":
      return { startDate: "90daysAgo", endDate: "today", label: "90d" };
    case "30d":
    case "last30days":
    default:
      if (normalized.includes(":")) {
        const [start, end] = normalized.split(":");
        if (start && end) {
          return { startDate: start, endDate: end, label: normalized };
        }
      }
      return { startDate: "30daysAgo", endDate: "today", label: "30d" };
  }
}

export class GA4DataService {
  /**
   * Helper to get an authenticated OAuth2Client for a property.
   */
  private async getClientForProperty(property: any): Promise<OAuth2Client> {
    const tokens = await integrationRepository.getValidTokens(property.integrationAccountId);
    return createAuthenticatedClient(tokens);
  }

  /**
   * Safe number parser for GA4 metric strings.
   */
  private num(val: string | null | undefined): number {
    if (!val) return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  }

  /**
   * Normalizes rate metric (decimal 0-1) to percentage (0-100).
   * Avoids double-multiplying if already on 0-100 scale.
   */
  private normalizeRate(val: string | null | undefined): number | undefined {
    if (val === null || val === undefined || val === "") return undefined;
    const n = Number(val);
    if (isNaN(n)) return undefined;
    const pct = n <= 1 && n >= 0 ? n * 100 : n;
    return Math.round(pct * 100) / 100;
  }

  // ----------------------------------------------------
  // 1. OVERVIEW REPORT
  // ----------------------------------------------------
  async getOverview(params: {
    workspaceId: string;
    propertyId: string;
    dateRange?: string;
    refresh?: boolean;
  }): Promise<OverviewReport> {
    const { workspaceId, propertyId, dateRange = "30d", refresh = false } = params;
    const property = await propertyRepository.getProperty(workspaceId, propertyId);

    if (!property) {
      throw new Error(`Connected property ${propertyId} not found in workspace.`);
    }

    const { startDate, endDate, label } = resolveDateRange(dateRange);
    const queryHash = generateQueryHash({ propertyId: property.propertyId, type: "overview", startDate, endDate });

    if (!refresh) {
      const cached = await analyticsCacheService.get<OverviewReport>({
        connectedPropertyId: property.id,
        reportType: "overview",
        queryHash,
      });
      if (cached) {
        return {
          ...cached.data,
          metadata: {
            ...cached.data.metadata,
            isCached: true,
            isStale: cached.isStale,
            cacheExpiresAt: cached.expiresAt.toISOString(),
          },
        };
      }
    }

    const auth = await this.getClientForProperty(property);
    const dataApi = google.analyticsdata({ version: "v1beta", auth });
    const formattedProperty = `properties/${property.propertyId}`;

    const startTime = Date.now();
    try {
      // 1. Aggregate Totals
      const summaryRes: any = await dataApi.properties.runReport({
        property: formattedProperty,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: "activeUsers" },
            { name: "totalUsers" },
            { name: "newUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
            { name: "engagementRate" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
            { name: "eventCount" },
            { name: "conversions" },
            { name: "sessionKeyEventRate" },
          ],
        },
      });

      // 2. Trend Breakdown by Date
      const trendRes: any = await dataApi.properties.runReport({
        property: formattedProperty,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "date" }],
          metrics: [
            { name: "activeUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
          ],
          orderBys: [{ dimension: { dimensionName: "date", orderType: "ALPHANUMERIC" } }],
        },
      });

      const row = summaryRes.data?.rows?.[0]?.metricValues || [];
      const summary = {
        activeUsers: this.num(row[0]?.value),
        totalUsers: this.num(row[1]?.value),
        newUsers: this.num(row[2]?.value),
        sessions: this.num(row[3]?.value),
        screenPageViews: this.num(row[4]?.value),
        engagementRate: Math.round(this.num(row[5]?.value) * 10000) / 100,
        bounceRate: Math.round(this.num(row[6]?.value) * 10000) / 100,
        averageSessionDuration: Math.round(this.num(row[7]?.value) * 10) / 10,
        eventCount: this.num(row[8]?.value),
        conversions: this.num(row[9]?.value),
        sessionKeyEventRate: this.normalizeRate(row[10]?.value),
      };

      const trend = (trendRes.data?.rows || []).map((r: any) => ({
        date: r.dimensionValues?.[0]?.value || "",
        activeUsers: this.num(r.metricValues?.[0]?.value),
        sessions: this.num(r.metricValues?.[1]?.value),
        screenPageViews: this.num(r.metricValues?.[2]?.value),
      }));

      const report: OverviewReport = {
        metadata: {
          propertyId: property.propertyId,
          displayName: property.displayName,
          timeZone: property.timeZone || "UTC",
          currencyCode: property.currencyCode || "USD",
          dateRange: label,
          startDate,
          endDate,
          fetchedAt: new Date().toISOString(),
          isCached: false,
          rowCount: trend.length,
        },
        summary,
        trend,
      };

      // Store in cache
      await analyticsCacheService.set({
        workspaceId,
        connectedPropertyId: property.id,
        reportType: "overview",
        queryHash,
        dateRange: label,
        data: report,
      });

      await propertyRepository.updateLastFetched(property.id);

      await prisma.integrationSyncLog.create({
        data: {
          workspaceId,
          propertyId: property.propertyId,
          endpoint: "overview",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
        },
      });

      return report;
    } catch (err: any) {
      await prisma.integrationSyncLog.create({
        data: {
          workspaceId,
          propertyId: property.propertyId,
          endpoint: "overview",
          status: "ERROR",
          errorMessage: err.message,
          durationMs: Date.now() - startTime,
        },
      });

      const stale = await analyticsCacheService.get<OverviewReport>({
        connectedPropertyId: property.id,
        reportType: "overview",
        queryHash,
        allowStaleFallback: true,
      });
      if (stale) {
        return {
          ...stale.data,
          metadata: { ...stale.data.metadata, isCached: true, isStale: true },
        };
      }

      throw err;
    }
  }

  // ----------------------------------------------------
  // 2. REALTIME REPORT (Last 30 Minutes)
  // ----------------------------------------------------
  async getRealtime(params: {
    workspaceId: string;
    propertyId: string;
    refresh?: boolean;
  }): Promise<RealtimeReport> {
    const { workspaceId, propertyId, refresh = false } = params;
    const property = await propertyRepository.getProperty(workspaceId, propertyId);

    if (!property) {
      throw new Error(`Connected property ${propertyId} not found in workspace.`);
    }

    const queryHash = generateQueryHash({ propertyId: property.propertyId, type: "realtime" });

    if (!refresh) {
      const cached = await analyticsCacheService.get<RealtimeReport>({
        connectedPropertyId: property.id,
        reportType: "realtime",
        queryHash,
      });
      if (cached) {
        return {
          ...cached.data,
          metadata: {
            ...cached.data.metadata,
            isCached: true,
            isStale: cached.isStale,
            cacheExpiresAt: cached.expiresAt.toISOString(),
          },
        };
      }
    }

    const auth = await this.getClientForProperty(property);
    const dataApi = google.analyticsdata({ version: "v1beta", auth });
    const formattedProperty = `properties/${property.propertyId}`;

    const startTime = Date.now();
    try {
      const minutesRes: any = await dataApi.properties.runRealtimeReport({
        property: formattedProperty,
        requestBody: {
          dimensions: [{ name: "minutesAgo" }],
          metrics: [{ name: "activeUsers" }],
          orderBys: [{ dimension: { dimensionName: "minutesAgo", orderType: "NUMERIC" } }],
        },
      });

      const countryRes: any = await dataApi.properties.runRealtimeReport({
        property: formattedProperty,
        requestBody: {
          dimensions: [{ name: "country" }],
          metrics: [{ name: "activeUsers" }],
          limit: "10" as any,
        },
      });

      const deviceRes: any = await dataApi.properties.runRealtimeReport({
        property: formattedProperty,
        requestBody: {
          dimensions: [{ name: "deviceCategory" }],
          metrics: [{ name: "activeUsers" }],
        },
      });

      const pageRes: any = await dataApi.properties.runRealtimeReport({
        property: formattedProperty,
        requestBody: {
          dimensions: [{ name: "unifiedScreenName" }],
          metrics: [{ name: "activeUsers" }],
          limit: "10" as any,
        },
      });

      const minuteByMinute = (minutesRes.data?.rows || []).map((r: any) => ({
        minuteAgo: this.num(r.dimensionValues?.[0]?.value),
        activeUsers: this.num(r.metricValues?.[0]?.value),
      }));

      const activeUsersLast30Minutes = minuteByMinute.reduce(
        (sum: number, item: { activeUsers: number }) => sum + item.activeUsers,
        0
      );

      const byCountry = (countryRes.data?.rows || []).map((r: any) => ({
        country: r.dimensionValues?.[0]?.value || "Unknown",
        activeUsers: this.num(r.metricValues?.[0]?.value),
      }));

      const byDevice = (deviceRes.data?.rows || []).map((r: any) => ({
        deviceCategory: r.dimensionValues?.[0]?.value || "Unknown",
        activeUsers: this.num(r.metricValues?.[0]?.value),
      }));

      const topPages = (pageRes.data?.rows || []).map((r: any) => ({
        pageTitle: r.dimensionValues?.[0]?.value || "Untitled",
        pagePath: r.dimensionValues?.[0]?.value || "/",
        activeUsers: this.num(r.metricValues?.[0]?.value),
      }));

      const report: RealtimeReport = {
        metadata: {
          propertyId: property.propertyId,
          displayName: property.displayName,
          timeZone: property.timeZone || "UTC",
          currencyCode: property.currencyCode || "USD",
          dateRange: "realtime_30m",
          fetchedAt: new Date().toISOString(),
          isCached: false,
        },
        activeUsersLast30Minutes,
        minuteByMinute,
        byCountry,
        byDevice,
        topPages,
      };

      await analyticsCacheService.set({
        workspaceId,
        connectedPropertyId: property.id,
        reportType: "realtime",
        queryHash,
        dateRange: "realtime",
        data: report,
      });

      return report;
    } catch (err: any) {
      await prisma.integrationSyncLog.create({
        data: {
          workspaceId,
          propertyId: property.propertyId,
          endpoint: "realtime",
          status: "ERROR",
          errorMessage: err.message,
          durationMs: Date.now() - startTime,
        },
      });

      const stale = await analyticsCacheService.get<RealtimeReport>({
        connectedPropertyId: property.id,
        reportType: "realtime",
        queryHash,
        allowStaleFallback: true,
      });
      if (stale) {
        return {
          ...stale.data,
          metadata: { ...stale.data.metadata, isCached: true, isStale: true },
        };
      }

      throw err;
    }
  }

  // ----------------------------------------------------
  // 3. TRAFFIC ACQUISITION
  // ----------------------------------------------------
  async getTrafficAcquisition(params: {
    workspaceId: string;
    propertyId: string;
    dateRange?: string;
    refresh?: boolean;
  }): Promise<TrafficReport> {
    const { workspaceId, propertyId, dateRange = "30d", refresh = false } = params;
    const property = await propertyRepository.getProperty(workspaceId, propertyId);

    if (!property) {
      throw new Error(`Connected property ${propertyId} not found in workspace.`);
    }

    const { startDate, endDate, label } = resolveDateRange(dateRange);
    const queryHash = generateQueryHash({ propertyId: property.propertyId, type: "traffic", startDate, endDate });

    if (!refresh) {
      const cached = await analyticsCacheService.get<TrafficReport>({
        connectedPropertyId: property.id,
        reportType: "traffic",
        queryHash,
      });
      if (cached) {
        return { ...cached.data, metadata: { ...cached.data.metadata, isCached: true, isStale: cached.isStale } };
      }
    }

    const auth = await this.getClientForProperty(property);
    const dataApi = google.analyticsdata({ version: "v1beta", auth });
    const formattedProperty = `properties/${property.propertyId}`;

    const res: any = await dataApi.properties.runReport({
      property: formattedProperty,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }, { name: "sessionSourceMedium" }],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "newUsers" },
          { name: "engagementRate" },
          { name: "conversions" },
          { name: "eventCount" },
        ],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "25" as any,
      },
    });

    const channels = (res.data?.rows || []).map((r: any) => {
      const dim = r.dimensionValues || [];
      const m = r.metricValues || [];
      return {
        channelGroup: dim[0]?.value || "Unassigned",
        sourceMedium: dim[1]?.value || "(not set)",
        sessions: this.num(m[0]?.value),
        activeUsers: this.num(m[1]?.value),
        newUsers: this.num(m[2]?.value),
        engagementRate: Math.round(this.num(m[3]?.value) * 10000) / 100,
        conversions: this.num(m[4]?.value),
        eventCount: this.num(m[5]?.value),
      };
    });

    const report: TrafficReport = {
      metadata: {
        propertyId: property.propertyId,
        displayName: property.displayName,
        timeZone: property.timeZone || "UTC",
        currencyCode: property.currencyCode || "USD",
        dateRange: label,
        startDate,
        endDate,
        fetchedAt: new Date().toISOString(),
        isCached: false,
        rowCount: channels.length,
      },
      channels,
    };

    await analyticsCacheService.set({
      workspaceId,
      connectedPropertyId: property.id,
      reportType: "traffic",
      queryHash,
      dateRange: label,
      data: report,
    });

    return report;
  }

  // ----------------------------------------------------
  // 4. AUDIENCE BREAKDOWN
  // ----------------------------------------------------
  async getAudience(params: {
    workspaceId: string;
    propertyId: string;
    dateRange?: string;
    refresh?: boolean;
  }): Promise<AudienceReport> {
    const { workspaceId, propertyId, dateRange = "30d", refresh = false } = params;
    const property = await propertyRepository.getProperty(workspaceId, propertyId);

    if (!property) {
      throw new Error(`Connected property ${propertyId} not found in workspace.`);
    }

    const { startDate, endDate, label } = resolveDateRange(dateRange);
    const queryHash = generateQueryHash({ propertyId: property.propertyId, type: "audience", startDate, endDate });

    if (!refresh) {
      const cached = await analyticsCacheService.get<AudienceReport>({
        connectedPropertyId: property.id,
        reportType: "audience",
        queryHash,
      });
      if (cached) {
        return { ...cached.data, metadata: { ...cached.data.metadata, isCached: true, isStale: cached.isStale } };
      }
    }

    const auth = await this.getClientForProperty(property);
    const dataApi = google.analyticsdata({ version: "v1beta", auth });
    const formattedProperty = `properties/${property.propertyId}`;

    const [countryRes, cityRes, userTypeRes]: [any, any, any] = await Promise.all([
      dataApi.properties.runReport({
        property: formattedProperty,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "country" }],
          metrics: [{ name: "activeUsers" }, { name: "sessions" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          limit: "15" as any,
        },
      }),
      dataApi.properties.runReport({
        property: formattedProperty,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "city" }, { name: "country" }],
          metrics: [{ name: "activeUsers" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          limit: "15" as any,
        },
      }),
      dataApi.properties.runReport({
        property: formattedProperty,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "newVsReturning" }],
          metrics: [{ name: "activeUsers" }],
        },
      }),
    ]);

    const countries = (countryRes.data?.rows || []).map((r: any) => ({
      country: r.dimensionValues?.[0]?.value || "Unknown",
      activeUsers: this.num(r.metricValues?.[0]?.value),
      sessions: this.num(r.metricValues?.[1]?.value),
    }));

    const cities = (cityRes.data?.rows || []).map((r: any) => ({
      city: r.dimensionValues?.[0]?.value || "Unknown",
      country: r.dimensionValues?.[1]?.value || "Unknown",
      activeUsers: this.num(r.metricValues?.[0]?.value),
    }));

    const userTypes = (userTypeRes.data?.rows || []).map((r: any) => ({
      userType: r.dimensionValues?.[0]?.value || "Unknown",
      activeUsers: this.num(r.metricValues?.[0]?.value),
    }));

    const report: AudienceReport = {
      metadata: {
        propertyId: property.propertyId,
        displayName: property.displayName,
        timeZone: property.timeZone || "UTC",
        currencyCode: property.currencyCode || "USD",
        dateRange: label,
        startDate,
        endDate,
        fetchedAt: new Date().toISOString(),
        isCached: false,
      },
      countries,
      cities,
      userTypes,
    };

    await analyticsCacheService.set({
      workspaceId,
      connectedPropertyId: property.id,
      reportType: "audience",
      queryHash,
      dateRange: label,
      data: report,
    });

    return report;
  }

  // ----------------------------------------------------
  // 5. TECHNOLOGY BREAKDOWN
  // ----------------------------------------------------
  async getTechnology(params: {
    workspaceId: string;
    propertyId: string;
    dateRange?: string;
    refresh?: boolean;
  }): Promise<TechnologyReport> {
    const { workspaceId, propertyId, dateRange = "30d", refresh = false } = params;
    const property = await propertyRepository.getProperty(workspaceId, propertyId);

    if (!property) {
      throw new Error(`Connected property ${propertyId} not found in workspace.`);
    }

    const { startDate, endDate, label } = resolveDateRange(dateRange);
    const queryHash = generateQueryHash({ propertyId: property.propertyId, type: "technology", startDate, endDate });

    if (!refresh) {
      const cached = await analyticsCacheService.get<TechnologyReport>({
        connectedPropertyId: property.id,
        reportType: "technology",
        queryHash,
      });
      if (cached) {
        return { ...cached.data, metadata: { ...cached.data.metadata, isCached: true, isStale: cached.isStale } };
      }
    }

    const auth = await this.getClientForProperty(property);
    const dataApi = google.analyticsdata({ version: "v1beta", auth });
    const formattedProperty = `properties/${property.propertyId}`;

    const [deviceRes, browserRes, osRes]: [any, any, any] = await Promise.all([
      dataApi.properties.runReport({
        property: formattedProperty,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "deviceCategory" }],
          metrics: [{ name: "activeUsers" }, { name: "sessions" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        },
      }),
      dataApi.properties.runReport({
        property: formattedProperty,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "browser" }],
          metrics: [{ name: "activeUsers" }, { name: "sessions" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          limit: "10" as any,
        },
      }),
      dataApi.properties.runReport({
        property: formattedProperty,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "operatingSystem" }],
          metrics: [{ name: "activeUsers" }, { name: "sessions" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          limit: "10" as any,
        },
      }),
    ]);

    const deviceCategories = (deviceRes.data?.rows || []).map((r: any) => ({
      category: r.dimensionValues?.[0]?.value || "desktop",
      activeUsers: this.num(r.metricValues?.[0]?.value),
      sessions: this.num(r.metricValues?.[1]?.value),
    }));

    const browsers = (browserRes.data?.rows || []).map((r: any) => ({
      browser: r.dimensionValues?.[0]?.value || "Other",
      activeUsers: this.num(r.metricValues?.[0]?.value),
      sessions: this.num(r.metricValues?.[1]?.value),
    }));

    const operatingSystems = (osRes.data?.rows || []).map((r: any) => ({
      os: r.dimensionValues?.[0]?.value || "Other",
      activeUsers: this.num(r.metricValues?.[0]?.value),
      sessions: this.num(r.metricValues?.[1]?.value),
    }));

    const report: TechnologyReport = {
      metadata: {
        propertyId: property.propertyId,
        displayName: property.displayName,
        timeZone: property.timeZone || "UTC",
        currencyCode: property.currencyCode || "USD",
        dateRange: label,
        startDate,
        endDate,
        fetchedAt: new Date().toISOString(),
        isCached: false,
      },
      deviceCategories,
      browsers,
      operatingSystems,
    };

    await analyticsCacheService.set({
      workspaceId,
      connectedPropertyId: property.id,
      reportType: "technology",
      queryHash,
      dateRange: label,
      data: report,
    });

    return report;
  }

  // ----------------------------------------------------
  // 6. PAGES AND CONTENT
  // ----------------------------------------------------
  async getPagesAndContent(params: {
    workspaceId: string;
    propertyId: string;
    dateRange?: string;
    refresh?: boolean;
  }): Promise<PagesReport> {
    const { workspaceId, propertyId, dateRange = "30d", refresh = false } = params;
    const property = await propertyRepository.getProperty(workspaceId, propertyId);

    if (!property) {
      throw new Error(`Connected property ${propertyId} not found in workspace.`);
    }

    const { startDate, endDate, label } = resolveDateRange(dateRange);
    const queryHash = generateQueryHash({ propertyId: property.propertyId, type: "pages", startDate, endDate });

    if (!refresh) {
      const cached = await analyticsCacheService.get<PagesReport>({
        connectedPropertyId: property.id,
        reportType: "pages",
        queryHash,
      });
      if (cached) {
        return { ...cached.data, metadata: { ...cached.data.metadata, isCached: true, isStale: cached.isStale } };
      }
    }

    const auth = await this.getClientForProperty(property);
    const dataApi = google.analyticsdata({ version: "v1beta", auth });
    const formattedProperty = `properties/${property.propertyId}`;

    const res: any = await dataApi.properties.runReport({
      property: formattedProperty,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "pageTitle" }, { name: "pagePath" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "activeUsers" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
        ],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: "25" as any,
      },
    });

    const pages = (res.data?.rows || []).map((r: any) => {
      const dim = r.dimensionValues || [];
      const m = r.metricValues || [];
      return {
        pageTitle: dim[0]?.value || "Untitled",
        pagePath: dim[1]?.value || "/",
        screenPageViews: this.num(m[0]?.value),
        activeUsers: this.num(m[1]?.value),
        averageEngagementTime: Math.round(this.num(m[2]?.value) * 10) / 10,
        bounceRate: Math.round(this.num(m[3]?.value) * 10000) / 100,
      };
    });

    const report: PagesReport = {
      metadata: {
        propertyId: property.propertyId,
        displayName: property.displayName,
        timeZone: property.timeZone || "UTC",
        currencyCode: property.currencyCode || "USD",
        dateRange: label,
        startDate,
        endDate,
        fetchedAt: new Date().toISOString(),
        isCached: false,
        rowCount: pages.length,
      },
      pages,
    };

    await analyticsCacheService.set({
      workspaceId,
      connectedPropertyId: property.id,
      reportType: "pages",
      queryHash,
      dateRange: label,
      data: report,
    });

    return report;
  }

  // ----------------------------------------------------
  // 7. EVENTS AND KEY EVENTS
  // ----------------------------------------------------
  async getEvents(params: {
    workspaceId: string;
    propertyId: string;
    dateRange?: string;
    refresh?: boolean;
  }): Promise<EventsReport> {
    const { workspaceId, propertyId, dateRange = "30d", refresh = false } = params;
    const property = await propertyRepository.getProperty(workspaceId, propertyId);

    if (!property) {
      throw new Error(`Connected property ${propertyId} not found in workspace.`);
    }

    const { startDate, endDate, label } = resolveDateRange(dateRange);
    const queryHash = generateQueryHash({ propertyId: property.propertyId, type: "events", startDate, endDate });

    if (!refresh) {
      const cached = await analyticsCacheService.get<EventsReport>({
        connectedPropertyId: property.id,
        reportType: "events",
        queryHash,
      });
      if (cached) {
        return { ...cached.data, metadata: { ...cached.data.metadata, isCached: true, isStale: cached.isStale } };
      }
    }

    const auth = await this.getClientForProperty(property);
    const dataApi = google.analyticsdata({ version: "v1beta", auth });
    const formattedProperty = `properties/${property.propertyId}`;

    const res: any = await dataApi.properties.runReport({
      property: formattedProperty,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "eventName" }],
        metrics: [
          { name: "eventCount" },
          { name: "totalUsers" },
          { name: "eventCountPerUser" },
        ],
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        limit: "30" as any,
      },
    });

    const events = (res.data?.rows || []).map((r: any) => {
      const dim = r.dimensionValues || [];
      const m = r.metricValues || [];
      return {
        eventName: dim[0]?.value || "unknown",
        eventCount: this.num(m[0]?.value),
        totalUsers: this.num(m[1]?.value),
        eventCountPerUser: Math.round(this.num(m[2]?.value) * 100) / 100,
      };
    });

    const report: EventsReport = {
      metadata: {
        propertyId: property.propertyId,
        displayName: property.displayName,
        timeZone: property.timeZone || "UTC",
        currencyCode: property.currencyCode || "USD",
        dateRange: label,
        startDate,
        endDate,
        fetchedAt: new Date().toISOString(),
        isCached: false,
        rowCount: events.length,
      },
      events,
    };

    await analyticsCacheService.set({
      workspaceId,
      connectedPropertyId: property.id,
      reportType: "events",
      queryHash,
      dateRange: label,
      data: report,
    });

    return report;
  }
}

export const ga4DataService = new GA4DataService();
