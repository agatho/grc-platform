// AWS Signature V4 signer — verified against the published AWS
// documentation test vectors (docs.aws.amazon.com, "Signature Version 4
// signing process": signing-key derivation example + the GET
// iam.amazonaws.com ListUsers full-request example).

import { describe, it, expect } from "vitest";
import {
  deriveSigningKey,
  encodeRfc3986,
  signRequest,
  sha256Hex,
  toAmzDate,
} from "../src/lib/sigv4";

const AWS_SECRET = "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY";
const AWS_ACCESS_KEY = "AKIDEXAMPLE";
const EMPTY_PAYLOAD_HASH =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("sigv4", () => {
  it("derives the signing key from the AWS documentation example", () => {
    // AWS docs "Task 3" example: 20120215 / us-east-1 / iam
    const key = deriveSigningKey(AWS_SECRET, "20120215", "us-east-1", "iam");
    expect(key.toString("hex")).toBe(
      "f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d",
    );
  });

  it("signs the AWS documentation GET iam ListUsers example request", () => {
    // Full worked example from the AWS SigV4 documentation.
    const result = signRequest({
      method: "GET",
      url: new URL(
        "https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08",
      ),
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8",
        "x-amz-date": "20150830T123600Z",
      },
      payloadHash: EMPTY_PAYLOAD_HASH,
      accessKeyId: AWS_ACCESS_KEY,
      secretAccessKey: AWS_SECRET,
      region: "us-east-1",
      service: "iam",
      date: new Date("2015-08-30T12:36:00Z"),
    });

    // Canonical request hash from the docs
    expect(sha256Hex(result.canonicalRequest)).toBe(
      "f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59",
    );
    expect(result.stringToSign).toBe(
      [
        "AWS4-HMAC-SHA256",
        "20150830T123600Z",
        "20150830/us-east-1/iam/aws4_request",
        "f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59",
      ].join("\n"),
    );
    expect(result.signature).toBe(
      "5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7",
    );
    expect(result.headers["Authorization"]).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, " +
        "SignedHeaders=content-type;host;x-amz-date, " +
        "Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7",
    );
    // fetch() forbids a caller-supplied Host header — it must be signed
    // but not emitted.
    expect(result.headers["host"]).toBeUndefined();
    expect(result.signedHeaders).toBe("content-type;host;x-amz-date");
  });

  it("signs the real payload hash (never UNSIGNED-PAYLOAD)", () => {
    const body = Buffer.from("hello world");
    const payloadHash = sha256Hex(body);
    const result = signRequest({
      method: "PUT",
      url: new URL("http://127.0.0.1:9000/bucket/org/doc/file.pdf"),
      headers: { "x-amz-content-sha256": payloadHash },
      payloadHash,
      accessKeyId: "minio",
      secretAccessKey: "minio123",
      region: "us-east-1",
      service: "s3",
      date: new Date("2026-01-02T03:04:05Z"),
    });
    expect(result.canonicalRequest.endsWith(payloadHash)).toBe(true);
    expect(result.canonicalRequest).not.toContain("UNSIGNED-PAYLOAD");
    expect(result.headers["x-amz-date"]).toBe("20260102T030405Z");
  });

  it("percent-encodes per RFC 3986 (strict)", () => {
    expect(encodeRfc3986("a b")).toBe("a%20b");
    expect(encodeRfc3986("a+b*c(d)'e!")).toBe("a%2Bb%2Ac%28d%29%27e%21");
    expect(encodeRfc3986("safe-._~chars")).toBe("safe-._~chars");
  });

  it("formats AWS dates without separators or millis", () => {
    const { amzDate, dateStamp } = toAmzDate(
      new Date("2015-08-30T12:36:00.123Z"),
    );
    expect(amzDate).toBe("20150830T123600Z");
    expect(dateStamp).toBe("20150830");
  });
});
