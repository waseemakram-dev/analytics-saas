import { prisma } from "@/server/database/prisma";
import { PropertyStatus } from "@prisma/client";
import { GA4PropertyMetadata } from "../types/ga4.types";

export class PropertyRepository {
  /**
   * Links a GA4 property to the workspace under a verified integration account.
   */
  async linkProperty(params: {
    workspaceId: string;
    integrationAccountId: string;
    propertyMetadata: GA4PropertyMetadata;
    isDefault?: boolean;
  }) {
    const { workspaceId, integrationAccountId, propertyMetadata, isDefault } = params;

    // Verify integration account belongs to this workspace
    const account = await prisma.integrationAccount.findUnique({
      where: { id: integrationAccountId },
    });

    if (!account || account.workspaceId !== workspaceId) {
      throw new Error("Specified integration account does not belong to this workspace.");
    }

    // Check if this is the first property in the workspace
    const existingCount = await prisma.connectedProperty.count({
      where: { workspaceId },
    });

    const shouldBeDefault = isDefault !== undefined ? isDefault : existingCount === 0;

    // If setting as default, clear default flag on other properties
    if (shouldBeDefault) {
      await prisma.connectedProperty.updateMany({
        where: { workspaceId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Strip "properties/" prefix if present to store numeric propertyId
    const numericPropertyId = propertyMetadata.propertyId.replace(/^properties\//, "");

    const property = await prisma.connectedProperty.upsert({
      where: {
        workspaceId_propertyId: {
          workspaceId,
          propertyId: numericPropertyId,
        },
      },
      create: {
        workspaceId,
        integrationAccountId,
        propertyId: numericPropertyId,
        displayName: propertyMetadata.displayName || `GA4 Property ${numericPropertyId}`,
        accountName: propertyMetadata.parentAccount || null,
        currencyCode: propertyMetadata.currencyCode || "USD",
        timeZone: propertyMetadata.timeZone || "UTC",
        isDefault: shouldBeDefault,
        status: PropertyStatus.ACTIVE,
      },
      update: {
        integrationAccountId,
        displayName: propertyMetadata.displayName || undefined,
        accountName: propertyMetadata.parentAccount || undefined,
        currencyCode: propertyMetadata.currencyCode || undefined,
        timeZone: propertyMetadata.timeZone || undefined,
        isDefault: shouldBeDefault ? true : undefined,
        status: PropertyStatus.ACTIVE,
      },
    });

    return property;
  }

  /**
   * Lists all connected properties in a workspace with their integration account details.
   */
  async listProperties(workspaceId: string) {
    return prisma.connectedProperty.findMany({
      where: { workspaceId },
      include: {
        integrationAccount: {
          select: {
            id: true,
            email: true,
            status: true,
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  /**
   * Retrieves a single connected property by its internal ID or GA4 property ID, enforcing workspace scope.
   */
  async getProperty(workspaceId: string, propertyIdentifier: string) {
    const property = await prisma.connectedProperty.findFirst({
      where: {
        workspaceId,
        OR: [
          { id: propertyIdentifier },
          { propertyId: propertyIdentifier.replace(/^properties\//, "") },
        ],
      },
      include: {
        integrationAccount: true,
      },
    });

    return property;
  }

  /**
   * Sets a property as primary/default for the workspace.
   */
  async setDefaultProperty(workspaceId: string, propertyId: string) {
    return prisma.$transaction(async (tx) => {
      // Find property first
      const property = await tx.connectedProperty.findFirst({
        where: {
          workspaceId,
          OR: [{ id: propertyId }, { propertyId: propertyId.replace(/^properties\//, "") }],
        },
      });

      if (!property) {
        throw new Error("Property not found in this workspace.");
      }

      await tx.connectedProperty.updateMany({
        where: { workspaceId, isDefault: true },
        data: { isDefault: false },
      });

      return tx.connectedProperty.update({
        where: { id: property.id },
        data: { isDefault: true },
      });
    });
  }

  /**
   * Unlinks/disconnects a property and cleans up its cache.
   */
  async unlinkProperty(workspaceId: string, propertyId: string) {
    const property = await this.getProperty(workspaceId, propertyId);

    if (!property) {
      throw new Error("Property not found in this workspace.");
    }

    await prisma.connectedProperty.delete({
      where: { id: property.id },
    });

    return { success: true, unlinkedPropertyId: property.propertyId };
  }

  /**
   * Updates the last fetched timestamp for a property.
   */
  async updateLastFetched(id: string, date = new Date()) {
    return prisma.connectedProperty.update({
      where: { id },
      data: { lastFetchedAt: date },
    });
  }
}

export const propertyRepository = new PropertyRepository();
