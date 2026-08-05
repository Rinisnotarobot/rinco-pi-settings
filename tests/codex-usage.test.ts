import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { formatCodexUsageStatusline } from "../extensions/zentui/codex-usage/format.ts";
import { normalizeBackendPayload } from "../extensions/zentui/codex-usage/normalize.ts";
import { sanitizeCodexText } from "../extensions/zentui/codex-usage/safety.ts";

const capturedAt = 1_700_000_000_000;

function samplePayload() {
  return {
    plan_type: "plus",
    rate_limit: {
      primary_window: {
        used_percent: 40,
        limit_window_seconds: 18_000,
        reset_at: 1_700_001_000,
      },
      secondary_window: {
        used_percent: 25,
        limit_window_seconds: 604_800,
        reset_at: 1_700_100_000,
      },
    },
    additional_rate_limits: [
      {
        limit_name: "GPT-5.3-Codex-Spark",
        metered_feature: "gpt-5.3-codex-spark",
        rate_limit: {
          primary_window: { used_percent: 10, limit_window_seconds: 18_000 },
          secondary_window: { used_percent: 20, limit_window_seconds: 604_800 },
        },
      },
    ],
    rate_limit_reset_credits: { available_count: 2 },
  };
}

describe("integrated Codex usage", () => {
  it("formats the primary Codex rate-limit windows", () => {
    const report = normalizeBackendPayload(samplePayload(), capturedAt, "pi-auth");

    assert.equal(report.planType, "plus");
    assert.equal(report.resetCredits?.availableCount, 2);
    assert.equal(formatCodexUsageStatusline(report), "codex 75% wk");
  });

  it("selects a model-specific usage bucket", () => {
    const report = normalizeBackendPayload(samplePayload(), capturedAt, "pi-auth");
    const status = formatCodexUsageStatusline(report, {
      provider: "openai-codex",
      id: "gpt-5.3-codex-spark",
      name: "GPT-5.3 Codex Spark",
    });

    assert.equal(status, "codex spark 80% wk");
  });

  it("falls back to the global weekly limit when a model bucket has no weekly window", () => {
    const payload = samplePayload();
    payload.additional_rate_limits[0]!.rate_limit = {
      primary_window: { used_percent: 10, limit_window_seconds: 18_000 },
      secondary_window: undefined,
    };
    const report = normalizeBackendPayload(payload, capturedAt, "pi-auth");
    const status = formatCodexUsageStatusline(report, {
      provider: "openai-codex",
      id: "gpt-5.3-codex-spark",
      name: "GPT-5.3 Codex Spark",
    });

    assert.equal(status, "codex 75% wk");
  });

  it("uses a weekly-only primary window for the statusline", () => {
    const report = normalizeBackendPayload(
      {
        rate_limit: {
          primary_window: {
            used_percent: 42,
            limit_window_seconds: 604_800,
            reset_at: 1_700_100_000,
          },
        },
        rate_limit_reset_credits: { available_count: 0 },
      },
      capturedAt,
      "pi-auth",
    );

    assert.equal(formatCodexUsageStatusline(report), "codex 58% wk");
  });

  it("reports when a weekly limit is unavailable", () => {
    const report = normalizeBackendPayload(
      {
        rate_limit: {
          primary_window: { used_percent: 40, limit_window_seconds: 18_000 },
        },
      },
      capturedAt,
      "pi-auth",
    );

    assert.equal(formatCodexUsageStatusline(report), "codex weekly unavailable");
  });

  it("rejects payloads without displayable usage", () => {
    assert.throws(
      () => normalizeBackendPayload({}, capturedAt, "pi-auth"),
      /no displayable usage data/,
    );
  });

  it("redacts credentials and terminal controls from external errors", () => {
    const sanitized = sanitizeCodexText(
      '\u001b]8;;https://evil.example\u0007Bearer\u001b[31m secret-token access\u001b[0m_token="abc" refresh_token=def client_secret="ghi,jkl" Cookie\u001b[0m: sid=secret; other=value',
    );
    assert.equal(sanitized.includes("secret-token"), false);
    assert.equal(sanitized.includes("abc"), false);
    assert.equal(sanitized.includes("def"), false);
    assert.equal(sanitized.includes("ghi"), false);
    assert.equal(sanitized.includes("sid=secret"), false);
    assert.equal(sanitized.includes("\u001b"), false);
  });
});
