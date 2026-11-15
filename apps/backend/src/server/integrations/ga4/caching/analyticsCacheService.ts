import { prisma } from "@/server/database/prisma";

export const CACHE_TTL = {
  REALTIME: 60, // 60 seconds
  CURRENT_DAY: 15 * 60, // 15 minutes
  HISTORICAL: 6 * 60 * 60, // 6 hours
};

export class AnalyticsCacheService {
  /**
   * Calculates the appropriate TTL in seconds based on report type and requested date range.
   */
  getTtl(reportType: string, dateRange?: string): number {
    if (reportType === "realtime") {
      return CACHE_TTL.REALTIME;
    }
    if (dateRange === "today") {
      return CACHE_TTL.CURRENT_DAY;
    }
    return CACHE_TTL.HISTORICAL;
  }

  /**
   * Retrieves a cached report if available.
   */
  async get<T>(params: {
    connectedPropertyId: string;
    reportType: string;
    queryHash: string;
    allowStaleFallback?: boolean;
  }): Promise<{
    data: T;
    fetchedAt: Date;
    isStale: boolean;
    expiresAt: Date;
  } | null> {
    const { connectedPropertyId, reportType, queryHash, allowStaleFallback = false } = params;

    const cached = await prisma.analyticsCache.findUnique({
      where: {
        connectedPropertyId_reportType_queryHash: {
          connectedPropertyId,
          reportType,
          queryHash,
        },
      },
    });

    if (!cached) {
      return null;
    }

    const isExpired = cached.expiresAt.getTime() <= Date.now();

    // If active and not marked stale, return fresh cache
    if (!isExpired && !cached.isStale) {
      return {
        data: cached.data as T,
        fetchedAt: cached.fetchedAt,
        isStale: false,
        expiresAt: cached.expiresAt,
      };
    }

    // If caller allows stale fallback (e.g. when upstream Google API is unavailable)
    if (allowStaleFallback) {
      return {
        data: cached.data as T,
        fetchedAt: cached.fetchedAt,
        isStale: true,
        expiresAt: cached.expiresAt,
      };
    }

    return null;
  }

  /**
   * Stores or updates a report in the PostgreSQL cache.
   */
  async set(params: {
    workspaceId: string;
    connectedPropertyId: string;
    reportType: string;
    queryHash: string;
    dateRange?: string;
    parameters?: any;
    data: any;
    ttlSeconds?: number;
  }): Promise<void> {
    const {
      workspaceId,
      connectedPropertyId,
      reportType,
      queryHash,
      dateRange,
      parameters,
      data,
      ttlSeconds,
    } = params;

    const ttl = ttlSeconds ?? this.getTtl(reportType, dateRange);
    const expiresAt = new Date(Date.now() + ttl * 1000);

    await prisma.analyticsCache.upsert({
      where: {
        connectedPropertyId_reportType_queryHash: {
          connectedPropertyId,
          reportType,
          queryHash,
        },
      },
      create: {
        workspaceId,
        connectedPropertyId,
        reportType,
        queryHash,
        dateRange: dateRange || null,
        parameters: parameters ? JSON.parse(JSON.stringify(parameters)) : null,
        data: JSON.parse(JSON.stringify(data)),
        fetchedAt: new Date(),
        expiresAt,
        isStale: false,
      },
      update: {
        dateRange: dateRange || undefined,
        parameters: parameters ? JSON.parse(JSON.stringify(parameters)) : undefined,
        data: JSON.parse(JSON.stringify(data)),
        fetchedAt: new Date(),
        expiresAt,
        isStale: false,
      },
    });
  }

  /**
   * Manually invalidates cache entries for a property (e.g. after property unlink or manual refresh).
   */
  async invalidate(connectedPropertyId: string, reportType?: string): Promise<void> {
    await prisma.analyticsCache.deleteMany({
      where: {
        connectedPropertyId,
        ...(reportType && { reportType }),
      },
    });
  }
}

export const analyticsCacheService = new AnalyticsCacheService();
