import { describe, it, expect } from "vitest";
import { checkWebhookUrl } from "../src/url-safety";
import { checkResolvedHostIsPublic } from "../src/url-safety-server";

describe("checkWebhookUrl — SSRF guard", () => {
  describe("accepts safe URLs", () => {
    it("accepts a normal https URL", () => {
      const r = checkWebhookUrl("https://hooks.example.com/incoming/abc");
      expect(r.ok).toBe(true);
    });

    it("accepts an https URL with port + path + query", () => {
      const r = checkWebhookUrl(
        "https://api.partner.io:8443/webhook?token=xyz",
      );
      expect(r.ok).toBe(true);
    });
  });

  describe("rejects loopback and localhost", () => {
    it("rejects 127.0.0.1", () => {
      const r = checkWebhookUrl("https://127.0.0.1/x");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/private/);
    });

    it("rejects 127.5.5.5", () => {
      const r = checkWebhookUrl("https://127.5.5.5/x");
      expect(r.ok).toBe(false);
    });

    it("rejects localhost", () => {
      const r = checkWebhookUrl("https://localhost/x");
      expect(r.ok).toBe(false);
    });

    it("rejects ::1 (IPv6 loopback)", () => {
      const r = checkWebhookUrl("https://[::1]/x");
      expect(r.ok).toBe(false);
    });
  });

  describe("rejects cloud metadata services", () => {
    it("rejects 169.254.169.254 (AWS/Azure IMDS)", () => {
      const r = checkWebhookUrl("https://169.254.169.254/latest/meta-data/");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/private/);
    });

    it("rejects metadata.google.internal", () => {
      const r = checkWebhookUrl("https://metadata.google.internal/x");
      expect(r.ok).toBe(false);
    });

    it("rejects any 169.254.x.x (link-local)", () => {
      const r = checkWebhookUrl("https://169.254.42.42/x");
      expect(r.ok).toBe(false);
    });
  });

  describe("rejects RFC 1918 private ranges", () => {
    it("rejects 10.0.0.1", () => {
      expect(checkWebhookUrl("https://10.0.0.1/x").ok).toBe(false);
    });
    it("rejects 192.168.1.1", () => {
      expect(checkWebhookUrl("https://192.168.1.1/x").ok).toBe(false);
    });
    it("rejects 172.16.0.1", () => {
      expect(checkWebhookUrl("https://172.16.0.1/x").ok).toBe(false);
    });
    it("rejects 172.31.255.254", () => {
      expect(checkWebhookUrl("https://172.31.255.254/x").ok).toBe(false);
    });
    it("accepts 172.32.0.1 (just outside 172.16/12)", () => {
      expect(checkWebhookUrl("https://172.32.0.1/x").ok).toBe(true);
    });
  });

  describe("rejects internal-style TLDs", () => {
    it("rejects .local", () => {
      expect(checkWebhookUrl("https://printer.local/x").ok).toBe(false);
    });
    it("rejects .internal", () => {
      expect(checkWebhookUrl("https://api.internal/x").ok).toBe(false);
    });
  });

  describe("rejects bad schemes", () => {
    it("rejects file://", () => {
      expect(checkWebhookUrl("file:///etc/passwd").ok).toBe(false);
    });
    it("rejects gopher://", () => {
      expect(checkWebhookUrl("gopher://x.example.com/").ok).toBe(false);
    });
    it("rejects plain http:// without env opt-in", () => {
      expect(checkWebhookUrl("http://hooks.example.com/x").ok).toBe(false);
    });
  });

  describe("rejects garbage input", () => {
    it("rejects empty string", () => {
      expect(checkWebhookUrl("").ok).toBe(false);
    });
    it("rejects not-a-url", () => {
      expect(checkWebhookUrl("definitely not a url").ok).toBe(false);
    });
  });

  describe("rejects CGNAT 100.64.0.0/10", () => {
    it("rejects 100.64.0.1", () => {
      expect(checkWebhookUrl("https://100.64.0.1/x").ok).toBe(false);
    });
    it("accepts 100.128.0.1 (just outside CGNAT)", () => {
      expect(checkWebhookUrl("https://100.128.0.1/x").ok).toBe(true);
    });
  });

  describe("rejects multicast / broadcast", () => {
    it("rejects 255.255.255.255", () => {
      expect(checkWebhookUrl("https://255.255.255.255/x").ok).toBe(false);
    });
    it("rejects 224.0.0.1 (multicast)", () => {
      expect(checkWebhookUrl("https://224.0.0.1/x").ok).toBe(false);
    });
  });
});

describe("checkResolvedHostIsPublic — DNS rebinding defense", () => {
  it("rejects an unresolvable hostname", async () => {
    // Use a TLD reserved by RFC 6761 so the lookup deterministically fails.
    const r = await checkResolvedHostIsPublic(
      "this-host-does-not-exist.invalid",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/DNS lookup failed/);
  });

  it("opt-out via WEBHOOK_ALLOW_PRIVATE_HOSTS=1", async () => {
    const prev = process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS;
    process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS = "1";
    try {
      // Even a guaranteed-fail host returns ok=true when the override is set.
      const r = await checkResolvedHostIsPublic(
        "this-host-does-not-exist.invalid",
      );
      expect(r.ok).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS;
      else process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS = prev;
    }
  });
});
