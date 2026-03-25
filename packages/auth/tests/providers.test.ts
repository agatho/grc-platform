// Unit tests for auth provider helpers (S1-07, S1-15)
// Tests isAzureAdConfigured and extractRequestInfo
// These functions can be tested without DB access.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isAzureAdConfigured, extractRequestInfo } from "../src/providers";

// ---------------------------------------------------------------------------
// isAzureAdConfigured
// ---------------------------------------------------------------------------

describe("isAzureAdConfigured", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env after each test
    process.env = { ...originalEnv };
  });

  it("returns false when no Azure AD env vars are set", () => {
    delete process.env.AZURE_AD_CLIENT_ID;
    delete process.env.AZURE_AD_CLIENT_SECRET;
    delete process.env.AZURE_AD_TENANT_ID;
    expect(isAzureAdConfigured()).toBe(false);
  });

  it("returns false when only CLIENT_ID is set", () => {
    process.env.AZURE_AD_CLIENT_ID = "test-client-id";
    delete process.env.AZURE_AD_CLIENT_SECRET;
    delete process.env.AZURE_AD_TENANT_ID;
    expect(isAzureAdConfigured()).toBe(false);
  });

  it("returns false when only CLIENT_SECRET is set", () => {
    delete process.env.AZURE_AD_CLIENT_ID;
    process.env.AZURE_AD_CLIENT_SECRET = "test-secret";
    delete process.env.AZURE_AD_TENANT_ID;
    expect(isAzureAdConfigured()).toBe(false);
  });

  it("returns false when only TENANT_ID is set", () => {
    delete process.env.AZURE_AD_CLIENT_ID;
    delete process.env.AZURE_AD_CLIENT_SECRET;
    process.env.AZURE_AD_TENANT_ID = "test-tenant";
    expect(isAzureAdConfigured()).toBe(false);
  });

  it("returns false when CLIENT_ID and CLIENT_SECRET are set but TENANT_ID is missing", () => {
    process.env.AZURE_AD_CLIENT_ID = "test-client-id";
    process.env.AZURE_AD_CLIENT_SECRET = "test-secret";
    delete process.env.AZURE_AD_TENANT_ID;
    expect(isAzureAdConfigured()).toBe(false);
  });

  it("returns false when CLIENT_ID and TENANT_ID are set but CLIENT_SECRET is missing", () => {
    process.env.AZURE_AD_CLIENT_ID = "test-client-id";
    delete process.env.AZURE_AD_CLIENT_SECRET;
    process.env.AZURE_AD_TENANT_ID = "test-tenant";
    expect(isAzureAdConfigured()).toBe(false);
  });

  it("returns true when all three env vars are set", () => {
    process.env.AZURE_AD_CLIENT_ID = "test-client-id";
    process.env.AZURE_AD_CLIENT_SECRET = "test-secret";
    process.env.AZURE_AD_TENANT_ID = "test-tenant";
    expect(isAzureAdConfigured()).toBe(true);
  });

  it("returns false when an env var is empty string", () => {
    process.env.AZURE_AD_CLIENT_ID = "";
    process.env.AZURE_AD_CLIENT_SECRET = "test-secret";
    process.env.AZURE_AD_TENANT_ID = "test-tenant";
    expect(isAzureAdConfigured()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractRequestInfo
// ---------------------------------------------------------------------------

describe("extractRequestInfo", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.168.1.100" },
    });
    const info = extractRequestInfo(request);
    expect(info.ipAddress).toBe("192.168.1.100");
  });

  it("extracts first IP from comma-separated x-forwarded-for", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "10.0.0.1, 172.16.0.1, 192.168.1.1" },
    });
    const info = extractRequestInfo(request);
    expect(info.ipAddress).toBe("10.0.0.1");
  });

  it("trims whitespace from x-forwarded-for IP", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "  10.0.0.1  , 172.16.0.1" },
    });
    const info = extractRequestInfo(request);
    expect(info.ipAddress).toBe("10.0.0.1");
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    const request = new Request("http://localhost", {
      headers: { "x-real-ip": "203.0.113.50" },
    });
    const info = extractRequestInfo(request);
    expect(info.ipAddress).toBe("203.0.113.50");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "10.0.0.1",
        "x-real-ip": "203.0.113.50",
      },
    });
    const info = extractRequestInfo(request);
    expect(info.ipAddress).toBe("10.0.0.1");
  });

  it("extracts user-agent header", () => {
    const request = new Request("http://localhost", {
      headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64)" },
    });
    const info = extractRequestInfo(request);
    expect(info.userAgent).toBe("Mozilla/5.0 (X11; Linux x86_64)");
  });

  it("returns both IP and user-agent when available", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "192.168.1.1",
        "user-agent": "TestAgent/1.0",
      },
    });
    const info = extractRequestInfo(request);
    expect(info.ipAddress).toBe("192.168.1.1");
    expect(info.userAgent).toBe("TestAgent/1.0");
  });

  it("returns undefined for both when no relevant headers present", () => {
    const request = new Request("http://localhost", {
      headers: { "content-type": "application/json" },
    });
    const info = extractRequestInfo(request);
    expect(info.ipAddress).toBeUndefined();
    expect(info.userAgent).toBeUndefined();
  });

  it("returns undefined for both when request is undefined", () => {
    const info = extractRequestInfo(undefined);
    expect(info.ipAddress).toBeUndefined();
    expect(info.userAgent).toBeUndefined();
  });

  it("returns undefined for both when request has no headers", () => {
    const info = extractRequestInfo({} as Request);
    expect(info.ipAddress).toBeUndefined();
    expect(info.userAgent).toBeUndefined();
  });

  it("handles object with Headers instance", () => {
    const headers = new Headers();
    headers.set("x-forwarded-for", "172.17.0.1");
    headers.set("user-agent", "CustomBot/2.0");
    const info = extractRequestInfo({ headers });
    expect(info.ipAddress).toBe("172.17.0.1");
    expect(info.userAgent).toBe("CustomBot/2.0");
  });

  it("returns undefined IP when x-forwarded-for is empty string", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "" },
    });
    const info = extractRequestInfo(request);
    // Empty x-forwarded-for should not produce a truthy IP
    expect(info.ipAddress).toBeFalsy();
  });

  it("handles IPv6 addresses in x-forwarded-for", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "::1" },
    });
    const info = extractRequestInfo(request);
    expect(info.ipAddress).toBe("::1");
  });

  it("handles IPv6 addresses in x-real-ip", () => {
    const request = new Request("http://localhost", {
      headers: { "x-real-ip": "2001:db8::1" },
    });
    const info = extractRequestInfo(request);
    expect(info.ipAddress).toBe("2001:db8::1");
  });
});
