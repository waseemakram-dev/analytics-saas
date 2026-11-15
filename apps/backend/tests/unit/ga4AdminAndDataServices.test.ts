import { describe, it, expect, vi } from "vitest";
import { resolveDateRange } from "@/server/integrations/ga4/services/ga4DataService";
import { ga4AdminService } from "@/server/integrations/ga4/services/ga4AdminService";
import { google } from "googleapis";

describe("GA4 Reporting Helpers: Date Range Resolution", () => {
  it("should resolve 'today' to today/today", () => {
    const res = resolveDateRange("today");
    expect(res.startDate).toBe("today");
    expect(res.endDate).toBe("today");
    expect(res.label).toBe("today");
  });

  it("should resolve 'yesterday' to yesterday/yesterday", () => {
    const res = resolveDateRange("yesterday");
    expect(res.startDate).toBe("yesterday");
    expect(res.endDate).toBe("yesterday");
    expect(res.label).toBe("yesterday");
  });

  it("should resolve '7d' to 7daysAgo/today", () => {
    const res = resolveDateRange("7d");
    expect(res.startDate).toBe("7daysAgo");
    expect(res.endDate).toBe("today");
    expect(res.label).toBe("7d");
  });

  it("should resolve '30d' and 'last30days' to 30daysAgo/today", () => {
    expect(resolveDateRange("30d").startDate).toBe("30daysAgo");
    expect(resolveDateRange("last30days").startDate).toBe("30daysAgo");
  });

  it("should resolve '90d' to 90daysAgo/today", () => {
    expect(resolveDateRange("90d").startDate).toBe("90daysAgo");
  });

  it("should parse custom date range formatted as start:end", () => {
    const res = resolveDateRange("2026-10-01:2026-10-31");
    expect(res.startDate).toBe("2026-10-01");
    expect(res.endDate).toBe("2026-10-31");
    expect(res.label).toBe("2026-10-01:2026-10-31");
  });
});

describe("GA4 Admin Service (Mocked API)", () => {
  it("should parse accessible accounts and properties from Google Admin API", async () => {
    const mockAuth = {} as any;

    const mockAccountsList = vi.fn().mockResolvedValue({
      data: {
        accounts: [
          { name: "accounts/111222", displayName: "Test Org Account", regionCode: "US" },
        ],
        nextPageToken: null,
      },
    });

    const mockPropertiesList = vi.fn().mockResolvedValue({
      data: {
        properties: [
          {
            name: "properties/999888",
            displayName: "Production Website",
            parent: "accounts/111222",
            currencyCode: "USD",
            timeZone: "America/New_York",
          },
        ],
        nextPageToken: null,
      },
    });

    vi.spyOn(google, "analyticsadmin").mockReturnValue({
      accounts: { list: mockAccountsList },
      properties: { list: mockPropertiesList },
    } as any);

    const accounts = await ga4AdminService.listAccounts(mockAuth);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].accountId).toBe("111222");
    expect(accounts[0].displayName).toBe("Test Org Account");

    const properties = await ga4AdminService.listProperties(mockAuth, "accounts/111222");
    expect(properties).toHaveLength(1);
    expect(properties[0].propertyId).toBe("999888");
    expect(properties[0].displayName).toBe("Production Website");
    expect(properties[0].currencyCode).toBe("USD");
    expect(properties[0].timeZone).toBe("America/New_York");
  });
});
