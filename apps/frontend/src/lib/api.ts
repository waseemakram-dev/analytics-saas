export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Universal JSON fetch helper with credentials included.
 */
async function fetchJson<T = any>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Essential for cross-origin / proxy session cookies
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      if (!response.ok && data.success === undefined) {
        return {
          success: false,
          error: {
            code: "HTTP_ERROR",
            message: data.message || `Request failed with status ${response.status}`,
          },
        };
      }
      return data;
    }

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: "HTTP_ERROR",
          message: `Request failed with status ${response.status}`,
        },
      };
    }

    return { success: true } as ApiResponse<T>;
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: err.message || "Failed to communicate with backend server",
      },
    };
  }
}

export const api = {
  // 1. Registration
  async register(data: { name: string; email: string; password: string }) {
    return fetchJson(`${BACKEND_URL}/api/auth/register`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // 2. Auth.js Credentials Login
  async login(data: { email: string; password: string }) {
    // A. Fetch CSRF token from Auth.js
    const csrfRes: any = await fetchJson(`${BACKEND_URL}/api/auth/csrf`);
    const csrfToken = csrfRes?.csrfToken || csrfRes?.data?.csrfToken;

    if (!csrfToken) {
      return {
        success: false,
        error: {
          code: "CSRF_ERROR",
          message: "Failed to retrieve CSRF token from authentication service.",
        },
      };
    }

    // B. Submit credentials to Auth.js callback
    const form = new URLSearchParams();
    form.append("email", data.email);
    form.append("password", data.password);
    form.append("csrfToken", csrfToken);
    form.append("callbackUrl", "http://localhost:3000/account");
    form.append("redirect", "false");

    const res = await fetch(`${BACKEND_URL}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
      body: form.toString(),
      credentials: "include",
    });

    if (res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json.url && json.url.includes("error=")) {
          return {
            success: false,
            error: {
              code: "INVALID_CREDENTIALS",
              message: "Invalid email or password. Please check your credentials.",
            },
          };
        }
      } catch {
        // Not JSON, normal successful redirect
      }
      return { success: true };
    }

    return {
      success: false,
      error: {
        code: "AUTH_FAILED",
        message: "Invalid email or password",
      },
    };
  },

  // 3. Email Verification
  async verifyEmail(data: { email: string; token: string }) {
    return fetchJson(`${BACKEND_URL}/api/auth/verify-email`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async resendVerification(email: string) {
    return fetchJson(`${BACKEND_URL}/api/auth/verify-email`, {
      method: "PUT",
      body: JSON.stringify({ email }),
    });
  },

  // 4. Password Recovery
  async forgotPassword(email: string) {
    return fetchJson(`${BACKEND_URL}/api/auth/forgot-password`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(data: { email: string; token: string; newPassword: string }) {
    return fetchJson(`${BACKEND_URL}/api/auth/reset-password`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // 5. User Profile
  async getProfile() {
    return fetchJson<{ user: any; workspace?: any; workspaceMembers?: any[] }>(`${BACKEND_URL}/api/users/me`, {
      method: "GET",
    });
  },

  // 6. Logout
  async logout() {
    const csrfRes: any = await fetchJson(`${BACKEND_URL}/api/auth/csrf`);
    const csrfToken = csrfRes?.csrfToken || csrfRes?.data?.csrfToken;

    if (csrfToken) {
      const form = new URLSearchParams();
      form.append("csrfToken", csrfToken);
      await fetch(`${BACKEND_URL}/api/auth/signout`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        credentials: "include",
      });
    }

    return { success: true };
  },

  // 7. Google Sign-In URL
  getGoogleSignInUrl(callbackUrl = "http://localhost:3000/account") {
    return `${BACKEND_URL}/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  },

  // ----------------------------------------------------
  // 8. GA4 Integrations & Property Management
  // ----------------------------------------------------
  async getGa4ConnectUrl(workspaceId?: string) {
    const q = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
    return fetchJson<{ authorizationUrl: string; workspaceId: string }>(
      `${BACKEND_URL}/api/integrations/google/connect${q}`
    );
  },

  async getConnectedGoogleAccounts() {
    return fetchJson<{ accounts: any[] }>(`${BACKEND_URL}/api/integrations/google/accounts`);
  },

  async disconnectGoogleAccount(id: string) {
    return fetchJson<{ disconnected: boolean; integrationAccountId: string }>(
      `${BACKEND_URL}/api/integrations/google/accounts/${id}`,
      { method: "DELETE" }
    );
  },

  async getProperties(integrationAccountId?: string) {
    const q = integrationAccountId
      ? `?integrationAccountId=${encodeURIComponent(integrationAccountId)}`
      : "";
    return fetchJson<{ properties: any[]; integrationAccountId?: string }>(
      `${BACKEND_URL}/api/integrations/google/properties${q}`
    );
  },

  async linkProperty(data: {
    integrationAccountId: string;
    propertyId: string;
    displayName?: string;
    currencyCode?: string;
    timeZone?: string;
    isDefault?: boolean;
  }) {
    return fetchJson<{ linked: boolean; property: any }>(
      `${BACKEND_URL}/api/integrations/google/properties/link`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  async unlinkProperty(id: string) {
    return fetchJson<{ success: boolean; unlinkedPropertyId: string }>(
      `${BACKEND_URL}/api/integrations/google/properties/${id}`,
      { method: "DELETE" }
    );
  },

  async setDefaultProperty(id: string) {
    return fetchJson<{ isDefault: boolean; property: any }>(
      `${BACKEND_URL}/api/integrations/google/properties/${id}/primary`,
      { method: "PATCH" }
    );
  },

  // ----------------------------------------------------
  // 9. GA4 Analytics Reports
  // ----------------------------------------------------
  async getOverviewReport(propertyId?: string, dateRange = "30d", refresh = false) {
    const params = new URLSearchParams();
    if (propertyId) params.append("propertyId", propertyId);
    if (dateRange) params.append("dateRange", dateRange);
    if (refresh) params.append("refresh", "true");
    return fetchJson<any>(`${BACKEND_URL}/api/analytics/overview?${params.toString()}`);
  },

  async getRealtimeReport(propertyId?: string, refresh = false) {
    const params = new URLSearchParams();
    if (propertyId) params.append("propertyId", propertyId);
    if (refresh) params.append("refresh", "true");
    return fetchJson<any>(`${BACKEND_URL}/api/analytics/realtime?${params.toString()}`);
  },

  async getTrafficReport(propertyId?: string, dateRange = "30d", refresh = false) {
    const params = new URLSearchParams();
    if (propertyId) params.append("propertyId", propertyId);
    if (dateRange) params.append("dateRange", dateRange);
    if (refresh) params.append("refresh", "true");
    return fetchJson<any>(`${BACKEND_URL}/api/analytics/traffic?${params.toString()}`);
  },

  async getAudienceReport(propertyId?: string, dateRange = "30d", refresh = false) {
    const params = new URLSearchParams();
    if (propertyId) params.append("propertyId", propertyId);
    if (dateRange) params.append("dateRange", dateRange);
    if (refresh) params.append("refresh", "true");
    return fetchJson<any>(`${BACKEND_URL}/api/analytics/audience?${params.toString()}`);
  },

  async getTechnologyReport(propertyId?: string, dateRange = "30d", refresh = false) {
    const params = new URLSearchParams();
    if (propertyId) params.append("propertyId", propertyId);
    if (dateRange) params.append("dateRange", dateRange);
    if (refresh) params.append("refresh", "true");
    return fetchJson<any>(`${BACKEND_URL}/api/analytics/technology?${params.toString()}`);
  },

  async getPagesReport(propertyId?: string, dateRange = "30d", refresh = false) {
    const params = new URLSearchParams();
    if (propertyId) params.append("propertyId", propertyId);
    if (dateRange) params.append("dateRange", dateRange);
    if (refresh) params.append("refresh", "true");
    return fetchJson<any>(`${BACKEND_URL}/api/analytics/pages?${params.toString()}`);
  },

  async getEventsReport(propertyId?: string, dateRange = "30d", refresh = false) {
    const params = new URLSearchParams();
    if (propertyId) params.append("propertyId", propertyId);
    if (dateRange) params.append("dateRange", dateRange);
    if (refresh) params.append("refresh", "true");
    return fetchJson<any>(`${BACKEND_URL}/api/analytics/events?${params.toString()}`);
  },
};
