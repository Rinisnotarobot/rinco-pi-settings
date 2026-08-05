import { strict as assert } from "node:assert";
import { it } from "node:test";
import registerCodexUsage from "../extensions/zentui/codex-usage/index.ts";
import { isLiveExtensionContext } from "../extensions/zentui/session-context.ts";

type Handler = (event: any, ctx: any) => unknown;

async function waitFor(predicate: () => boolean, timeoutMs = 200): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() >= deadline) throw new Error("Timed out waiting for usage refresh");
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

const codex = { provider: "openai-codex", id: "gpt-5.3-codex", name: "GPT-5.3 Codex" };
const spark = {
	provider: "openai-codex",
	id: "gpt-5.3-codex-spark",
	name: "GPT-5.3 Codex Spark",
};

function codexPayload() {
	return {
		rate_limit: {
			primary_window: { used_percent: 40, limit_window_seconds: 18_000 },
			secondary_window: { used_percent: 25, limit_window_seconds: 604_800 },
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
	};
}

function setup() {
	const handlers = new Map<string, Handler[]>();
	const pi = {
		registerCommand() {},
		on(event: string, handler: Handler) {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		},
	};
	const statuses: Array<string | undefined> = [];
	registerCodexUsage(pi as never, (_ctx, value) => statuses.push(value));
	const emit = (event: string, payload: unknown, ctx: unknown) => {
		for (const handler of handlers.get(event) ?? []) handler(payload, ctx);
	};
	return { emit, statuses };
}

function codexContext(model: unknown) {
	return {
		model,
		hasUI: true,
		modelRegistry: {
			getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "k", headers: {} }),
			getAvailable: () => [codex, spark],
			getAll: () => [codex, spark],
		},
	};
}

it("keeps the cached reading visible when a model switch cannot reach the network", async () => {
	const { emit, statuses } = setup();
	const ctx = codexContext(codex);
	const originalFetch = globalThis.fetch;
	let online = true;
	globalThis.fetch = async () => {
		if (!online) throw new Error("offline");
		return new Response(JSON.stringify(codexPayload()), { status: 200 });
	};

	try {
		emit("session_start", {}, ctx);
		await waitFor(() => statuses.at(-1) === "codex 75% wk");

		online = false;
		ctx.model = spark;
		emit("model_select", { model: spark, previousModel: codex, source: "set" }, ctx);
		await waitFor(() => statuses.at(-1) === "codex spark 80% wk");
	} finally {
		emit("session_shutdown", {}, ctx);
		globalThis.fetch = originalFetch;
	}

	assert.equal(statuses.includes("usage error"), false);
	assert.equal(statuses.includes("checking"), true);
});

it("treats every live per-event context as part of the active session", () => {
	assert.equal(isLiveExtensionContext({ hasUI: true } as never), true);
	assert.equal(isLiveExtensionContext(undefined), false);
	const stale = {
		get hasUI(): boolean {
			throw new Error("This extension ctx is stale after session replacement or reload");
		},
	};
	assert.equal(isLiveExtensionContext(stale as never), false);
});
