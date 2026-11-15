import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { GA4Account, GA4PropertyMetadata } from "../types/ga4.types";

export class GA4AdminService {
  /**
   * Lists all Google Analytics accounts accessible to the authorized Google identity.
   */
  async listAccounts(auth: OAuth2Client): Promise<GA4Account[]> {
    const admin = google.analyticsadmin({ version: "v1beta", auth });
    const accounts: GA4Account[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const res: any = await admin.accounts.list({
        pageSize: 100,
        pageToken,
      });

      if (res.data.accounts) {
        for (const acc of res.data.accounts) {
          if (acc.name) {
            const accountId = acc.name.replace(/^accounts\//, "");
            accounts.push({
              name: acc.name,
              accountId,
              displayName: acc.displayName || `Account ${accountId}`,
              regionCode: acc.regionCode || undefined,
            });
          }
        }
      }

      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    return accounts;
  }

  /**
   * Lists all GA4 properties accessible to the authorized Google identity across all accounts.
   */
  async listProperties(
    auth: OAuth2Client,
    accountFilter?: string
  ): Promise<GA4PropertyMetadata[]> {
    const admin = google.analyticsadmin({ version: "v1beta", auth });
    const properties: GA4PropertyMetadata[] = [];

    // If an accountFilter is provided, list for that specific parent account
    if (accountFilter) {
      const parent = accountFilter.startsWith("accounts/")
        ? accountFilter
        : `accounts/${accountFilter}`;

      let pageToken: string | undefined = undefined;
      do {
        const res: any = await admin.properties.list({
          filter: `parent:${parent}`,
          pageSize: 100,
          pageToken,
        });

        if (res.data.properties) {
          for (const prop of res.data.properties) {
            if (prop.name) {
              const propertyId = prop.name.replace(/^properties\//, "");
              properties.push({
                name: prop.name,
                propertyId,
                displayName: prop.displayName || `Property ${propertyId}`,
                parentAccount: prop.parent || parent,
                currencyCode: prop.currencyCode || "USD",
                timeZone: prop.timeZone || "UTC",
                createTime: prop.createTime || undefined,
              });
            }
          }
        }
        pageToken = res.data.nextPageToken || undefined;
      } while (pageToken);

      return properties;
    }

    // Otherwise, discover accessible accounts first and enumerate properties for each
    const accounts = await this.listAccounts(auth);

    for (const acc of accounts) {
      try {
        const accountProperties = await this.listProperties(auth, acc.name);
        properties.push(...accountProperties);
      } catch (err: any) {
        // Individual account might lack property-list permissions, continue with others
        console.warn(`Could not list properties for account ${acc.name}:`, err.message);
      }
    }

    return properties;
  }

  /**
   * Retrieves metadata for a specific GA4 property.
   */
  async getProperty(auth: OAuth2Client, propertyId: string): Promise<GA4PropertyMetadata> {
    const admin = google.analyticsadmin({ version: "v1beta", auth });
    const formattedName = propertyId.startsWith("properties/")
      ? propertyId
      : `properties/${propertyId}`;

    const res = await admin.properties.get({ name: formattedName });
    const prop = res.data;

    if (!prop.name) {
      throw new Error(`Property ${propertyId} not found.`);
    }

    const numericId = prop.name.replace(/^properties\//, "");

    return {
      name: prop.name,
      propertyId: numericId,
      displayName: prop.displayName || `Property ${numericId}`,
      parentAccount: prop.parent || undefined,
      currencyCode: prop.currencyCode || "USD",
      timeZone: prop.timeZone || "UTC",
      createTime: prop.createTime || undefined,
    };
  }
}

export const ga4AdminService = new GA4AdminService();
