import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	formatTokenSwitchBalance,
	isTokenSwitchModel,
	parseTokenSwitchBalance,
	queryTokenSwitchBalance,
} from "../extensions/zentui/token-switch-usage.ts";

describe("Token Switch balance", () => {
	it("recognizes only the token-switch provider", () => {
		assert.equal(isTokenSwitchModel({ provider: "token-switch" }), true);
		assert.equal(isTokenSwitchModel({ provider: "openai-codex" }), false);
		assert.equal(isTokenSwitchModel(undefined), false);
	});

	it("subtracts used USD from the hard limit", () => {
		const balance = parseTokenSwitchBalance(
			{ hard_limit_usd: 1000, soft_limit_usd: 100 },
			{ total_usage: 25000 },
		);

		assert.equal(balance, 750);
		assert.equal(formatTokenSwitchBalance(balance), "token-switch $750.00");
	});

	it("rejects malformed or negative balances", () => {
		assert.throws(() => parseTokenSwitchBalance(null, { total_usage: 0 }), /hard_limit_usd/);
		assert.throws(() => parseTokenSwitchBalance({}, { total_usage: 0 }), /hard_limit_usd/);
		assert.throws(
			() => parseTokenSwitchBalance({ hard_limit_usd: "1000" }, { total_usage: 0 }),
			/hard_limit_usd/,
		);
		assert.throws(
			() => parseTokenSwitchBalance({ hard_limit_usd: 1000 }, { total_usage: "1" }),
			/total_usage/,
		);
		assert.throws(
			() => parseTokenSwitchBalance({ hard_limit_usd: 1000 }, { total_usage: -1 }),
			/total_usage/,
		);
	});

	it("queries the documented endpoint without exposing the key", async () => {
		const requestedUrls: string[] = [];
		let authorization = "";
		const fetchImpl: typeof fetch = async (input, init) => {
			const url = String(input);
			requestedUrls.push(url);
			authorization = new Headers(init?.headers).get("Authorization") ?? "";
			const payload = url.endsWith("/subscription")
				? { hard_limit_usd: 12.345 }
				: { total_usage: 234.5 };
			return new Response(JSON.stringify(payload), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		};

		const balance = await queryTokenSwitchBalance({
			apiKey: "test-key",
			fetchImpl,
			timeoutMs: 1000,
		});

		assert.deepEqual(requestedUrls, [
			"https://neolink.com/backend/v1/dashboard/billing/subscription",
			"https://neolink.com/backend/v1/dashboard/billing/usage",
		]);
		assert.equal(authorization, "Bearer test-key");
		assert.equal(balance, 10);
	});

	it("rejects unsuccessful, oversized, and invalid JSON responses", async () => {
		const responses = [
			new Response("", { status: 401 }),
			new Response("x".repeat(64 * 1024 + 1), { status: 200 }),
			new Response("not json", { status: 200 }),
		];
		for (const response of responses) {
			await assert.rejects(
				queryTokenSwitchBalance({
					apiKey: "test-key",
					fetchImpl: async () => response,
					timeoutMs: 1000,
				}),
				/Token Switch/,
			);
		}
	});

	it("reports external cancellation without leaking credentials", async () => {
		const fetchImpl: typeof fetch = async (_input, init) => {
			assert.equal(init?.signal?.aborted, true);
			throw new Error("aborted");
		};

		await assert.rejects(
			queryTokenSwitchBalance({
				apiKey: "test-key",
				fetchImpl,
				timeoutMs: 1000,
				signal: AbortSignal.abort(),
			}),
			/was cancelled/,
		);
	});

	it("requires TOKEN_SWITCH_API_KEY", async () => {
		await assert.rejects(
			queryTokenSwitchBalance({ apiKey: "", timeoutMs: 1000 }),
			/TOKEN_SWITCH_API_KEY/,
		);
	});
});
