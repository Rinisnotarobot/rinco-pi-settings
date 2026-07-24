import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { queryViaCodexAppServer } from "./app-server-client.ts";
import { normalizeBackendPayload } from "./normalize.ts";
import { safeCodexErrorMessage } from "./safety.ts";
import type {
	CodexUsageReport,
	PiModel,
	QueryUsageOptions,
	QueryUsageResult,
	RateLimitStatusPayload,
	UsageQueryError,
} from "./types.ts";

const CODEX_PROVIDER_ID = "openai-codex";
const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const MAX_RESPONSE_BODY_BYTES = 1024 * 1024;

export function isOpenAICodexModel(model: Pick<PiModel, "provider"> | undefined): boolean {
	return model?.provider === CODEX_PROVIDER_ID;
}

export function isStaleExtensionContextError(error: unknown): boolean {
	return (
		error instanceof Error &&
		error.message.includes("This extension ctx is stale after session replacement or reload")
	);
}

export async function queryUsage(
	ctx: ExtensionContext,
	options: Pick<QueryUsageOptions, "timeoutMs">,
	signal?: AbortSignal,
): Promise<QueryUsageResult> {
	const errors: UsageQueryError[] = [];

	try {
		const report = await queryViaPiAuth(ctx, options.timeoutMs, signal);
		return { ok: true, report };
	} catch (cause) {
		if (isStaleExtensionContextError(cause)) throw cause;
		errors.push({ source: "pi-auth", message: safeCodexErrorMessage(cause) });
	}

	try {
		const report = await queryViaCodexAppServer(options.timeoutMs, signal);
		return { ok: true, report };
	} catch (cause) {
		if (isStaleExtensionContextError(cause)) throw cause;
		errors.push({ source: "codex-app-server", message: safeCodexErrorMessage(cause) });
	}

	return { ok: false, errors };
}

async function queryViaPiAuth(
	ctx: ExtensionContext,
	timeoutMs: number,
	signal?: AbortSignal,
): Promise<CodexUsageReport> {
	const auth = await resolvePiCodexAuth(ctx);
	if (!auth) {
		throw new Error(
			"No Pi OpenAI Codex subscription auth was available. Use a Pi OpenAI Codex model or run /login for OpenAI ChatGPT Plus/Pro (Codex).",
		);
	}

	const { response, text } = await fetchTextWithTimeout(
		CODEX_USAGE_URL,
		{ method: "GET", headers: auth.headers, redirect: "error" },
		timeoutMs,
		signal,
	);
	if (!response.ok) {
		throw new Error(`Codex usage endpoint returned HTTP ${response.status}.`);
	}
	const payload = parseJsonObject(text, "Codex usage endpoint response");
	return normalizeBackendPayload(payload as RateLimitStatusPayload, Date.now(), "pi-auth");
}

async function resolvePiCodexAuth(
	ctx: ExtensionContext,
): Promise<{ headers: Record<string, string> } | undefined> {
	const models = codexAuthCandidateModels(ctx);
	const errors: string[] = [];

	for (const model of models) {
		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
		if (!auth.ok) {
			errors.push(auth.error);
			continue;
		}

		const headers = allowedAuthHeaders(auth.headers ?? {});
		if (!hasHeader(headers, "Authorization") && auth.apiKey) {
			headers.Authorization = `Bearer ${auth.apiKey}`;
		}
		if (!hasHeader(headers, "User-Agent")) {
			headers["User-Agent"] = "pi-codex-usage";
		}
		if (hasHeader(headers, "Authorization")) {
			return { headers };
		}
	}

	if (errors.length > 0) {
		throw new Error(errors.join("; "));
	}
	return undefined;
}

function codexAuthCandidateModels(ctx: ExtensionContext): PiModel[] {
	const candidates: PiModel[] = [];
	const seen = new Set<string>();
	const add = (model: PiModel | undefined) => {
		if (!model || model.provider !== CODEX_PROVIDER_ID) return;
		const key = `${model.provider}/${model.id}`;
		if (seen.has(key)) return;
		seen.add(key);
		candidates.push(model);
	};

	add(ctx.model);
	for (const model of ctx.modelRegistry.getAvailable()) add(model);
	for (const model of ctx.modelRegistry.getAll()) add(model);
	return candidates;
}

async function fetchTextWithTimeout(
	url: string,
	init: RequestInit,
	timeoutMs: number,
	externalSignal?: AbortSignal,
): Promise<{ response: Response; text: string }> {
	const controller = new AbortController();
	const abortFromExternal = () => controller.abort();
	if (externalSignal?.aborted) controller.abort();
	else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(url, { ...init, signal: controller.signal });
		const text = response.ok ? await readResponseText(response, MAX_RESPONSE_BODY_BYTES) : "";
		return { response, text };
	} catch (error) {
		if (controller.signal.aborted) {
			throw new Error(
				externalSignal?.aborted
					? "Codex usage query was cancelled."
					: `Timed out after ${Math.round(timeoutMs / 1000)}s while fetching Codex usage.`,
			);
		}
		throw error;
	} finally {
		clearTimeout(timeout);
		externalSignal?.removeEventListener("abort", abortFromExternal);
	}
}

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
	if (!response.body) return "";
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let size = 0;
	let text = "";
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > maxBytes) {
				await reader.cancel("response size limit exceeded");
				throw new Error("Codex usage response exceeded the size limit.");
			}
			text += decoder.decode(value, { stream: true });
		}
		return text + decoder.decode();
	} finally {
		reader.releaseLock();
	}
}

function parseJsonObject(text: string, description: string): Record<string, unknown> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text) as unknown;
	} catch (error) {
		throw new Error(`${description} was not valid JSON: ${errorMessage(error)}`);
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(`${description} was not an object.`);
	}
	return parsed as Record<string, unknown>;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
	return Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());
}

function allowedAuthHeaders(source: Record<string, string>): Record<string, string> {
	const allowed = new Set(["authorization", "chatgpt-account-id", "user-agent", "accept"]);
	return Object.fromEntries(
		Object.entries(source).filter(([key]) => allowed.has(key.toLowerCase())),
	);
}

function errorMessage(error: unknown): string {
	return safeCodexErrorMessage(error);
}
