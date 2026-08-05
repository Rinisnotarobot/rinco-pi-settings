import { strict as assert } from "node:assert";
import { it } from "node:test";
import registerCodexUsage from "../extensions/zentui/codex-usage/index.ts";

type Handler = (event: any, ctx: any) => unknown;

async function waitFor(predicate: () => boolean, timeoutMs = 200): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() >= deadline) throw new Error("Timed out waiting for usage refresh");
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

it("forces a status refresh whenever /model selects a model", async () => {
	const handlers = new Map<string, Handler>();
	const pi = {
		registerCommand() {},
		on(event: string, handler: Handler) {
			handlers.set(event, handler);
		},
	};
	const statuses: Array<string | undefined> = [];
	registerCodexUsage(pi as never, (_ctx, value) => statuses.push(value));

	const model = { provider: "token-switch", id: "gpt-5.4", name: "GPT-5.4" };
	const ctx = { model };
	const originalFetch = globalThis.fetch;
	const originalKey = process.env.TOKEN_SWITCH_API_KEY;
	let requestCount = 0;
	process.env.TOKEN_SWITCH_API_KEY = "test-key";
	globalThis.fetch = async (input) => {
		requestCount += 1;
		const payload = String(input).endsWith("/usage")
			? { total_usage: 100 }
			: { hard_limit_usd: 10 };
		return new Response(JSON.stringify(payload), { status: 200 });
	};

	try {
		handlers.get("session_start")?.({}, ctx);
		await waitFor(() => requestCount === 2);
		await waitFor(() => statuses.at(-1) === "token-switch $9.00");

		handlers.get("model_select")?.(
			{ model, previousModel: model, source: "set" },
			ctx,
		);
		await waitFor(() => requestCount === 4);
		await waitFor(() => statuses.at(-1) === "token-switch $9.00");
	} finally {
		handlers.get("session_shutdown")?.({}, ctx);
		globalThis.fetch = originalFetch;
		if (originalKey === undefined) delete process.env.TOKEN_SWITCH_API_KEY;
		else process.env.TOKEN_SWITCH_API_KEY = originalKey;
	}

	assert.equal(requestCount, 4);
});

it("refreshes the Token Switch balance via /usage-refresh without a Codex query", async () => {
	const handlers = new Map<string, Handler>();
	const commands = new Map<string, (args: string, ctx: any) => unknown>();
	const pi = {
		registerCommand(name: string, spec: { handler: (args: string, ctx: any) => unknown }) {
			commands.set(name, spec.handler);
		},
		on(event: string, handler: Handler) {
			handlers.set(event, handler);
		},
	};
	const statuses: Array<string | undefined> = [];
	registerCodexUsage(pi as never, (_ctx, value) => statuses.push(value));

	const model = { provider: "token-switch", id: "gpt-5.4", name: "GPT-5.4" };
	const notifications: string[] = [];
	const ctx = { model, hasUI: true, ui: { notify: (text: string) => notifications.push(text) } };
	const originalFetch = globalThis.fetch;
	const originalKey = process.env.TOKEN_SWITCH_API_KEY;
	const requestedUrls: string[] = [];
	process.env.TOKEN_SWITCH_API_KEY = "test-key";
	globalThis.fetch = async (input) => {
		const url = String(input);
		requestedUrls.push(url);
		const payload = url.endsWith("/usage") ? { total_usage: 100 } : { hard_limit_usd: 10 };
		return new Response(JSON.stringify(payload), { status: 200 });
	};

	let balanceAfterRefresh: string | undefined;
	try {
		handlers.get("session_start")?.({}, ctx);
		await waitFor(() => statuses.at(-1) === "token-switch $9.00");

		await commands.get("usage-refresh")?.("", ctx);
		await waitFor(() => requestedUrls.length === 4);
		balanceAfterRefresh = statuses.at(-1);
	} finally {
		handlers.get("session_shutdown")?.({}, ctx);
		globalThis.fetch = originalFetch;
		if (originalKey === undefined) delete process.env.TOKEN_SWITCH_API_KEY;
		else process.env.TOKEN_SWITCH_API_KEY = originalKey;
	}

	// Only the billing endpoints are hit; the balance survives and no Codex report appears.
	assert.equal(requestedUrls.every((url) => url.includes("/dashboard/billing/")), true);
	assert.equal(balanceAfterRefresh, "token-switch $9.00");
	assert.equal(notifications.length, 0);
});
