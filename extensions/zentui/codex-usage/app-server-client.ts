import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { normalizeAppServerResponse } from "./normalize.ts";
import { safeCodexErrorMessage } from "./safety.ts";
import type {
	AppServerRateLimitResponse,
	CodexUsageReport,
	PendingRpc,
	RpcResponse,
} from "./types.ts";

const MAX_ERROR_BODY_CHARS = 600;
const MAX_RPC_LINE_BYTES = 64 * 1024;

export async function queryViaCodexAppServer(
	timeoutMs: number,
	signal?: AbortSignal,
): Promise<CodexUsageReport> {
	const client = new CodexAppServerClient(timeoutMs, signal);
	try {
		await client.start();
		await client.request("initialize", {
			clientInfo: {
				name: "pi_codex_usage",
				title: "Pi Codex Usage",
				version: "0.1.0",
			},
			capabilities: {
				experimentalApi: false,
				requestAttestation: false,
				optOutNotificationMethods: [],
			},
		});
		client.notify("initialized");
		const result = await client.request("account/rateLimits/read", undefined);
		return normalizeAppServerResponse(
			assertObject(result, "account/rateLimits/read result") as AppServerRateLimitResponse,
			Date.now(),
		);
	} finally {
		client.dispose();
	}
}

class CodexAppServerClient {
	private child?: ChildProcessWithoutNullStreams;
	private nextId = 1;
	private stderr = "";
	private stdoutBuffer = "";
	private readonly pending = new Map<number, PendingRpc>();
	private startPromise?: Promise<void>;
	private exitError?: Error;
	private readonly timeoutMs: number;
	private readonly signal?: AbortSignal;
	private readonly abortHandler = () => {
		this.rejectAll(new Error("Codex app-server query was cancelled."));
		this.dispose();
	};

	constructor(timeoutMs: number, signal?: AbortSignal) {
		this.timeoutMs = timeoutMs;
		this.signal = signal;
	}

	start(): Promise<void> {
		if (this.startPromise) return this.startPromise;
		if (this.signal?.aborted) return Promise.reject(new Error("Codex app-server query was cancelled."));
		this.signal?.addEventListener("abort", this.abortHandler, { once: true });

		this.startPromise = new Promise((resolve, reject) => {
			const child = spawn("codex", ["app-server", "--listen", "stdio://"], {
				stdio: ["pipe", "pipe", "pipe"],
			});
			this.child = child;

			const startupTimeout = setTimeout(() => {
				reject(
					new Error(
						`Timed out after ${Math.round(this.timeoutMs / 1000)}s starting codex app-server.`,
					),
				);
			}, this.timeoutMs);

			child.once("spawn", () => {
				clearTimeout(startupTimeout);
				resolve();
			});

			child.once("error", (error) => {
				clearTimeout(startupTimeout);
				reject(new Error(`Failed to start codex app-server: ${error.message}`));
				this.rejectAll(error);
			});

			child.once("exit", (code, signal) => {
				this.exitError = new Error(
					`codex app-server exited before completing the request (code ${code ?? "unknown"}, signal ${signal ?? "none"}).`,
				);
				this.rejectAll(this.exitError);
			});

			child.stderr.setEncoding("utf8");
			child.stderr.on("data", (chunk: string) => {
				this.stderr = truncateEnd(`${this.stderr}${chunk.slice(0, MAX_ERROR_BODY_CHARS)}`, MAX_ERROR_BODY_CHARS);
			});
			child.stderr.on("error", () => undefined);
			child.stdin.on("error", (error) => this.rejectAll(error));
			child.stdout.setEncoding("utf8");
			child.stdout.on("data", (chunk: string) => this.handleChunk(chunk));
			child.stdout.on("error", (error) => this.rejectAll(error));
		});

		return this.startPromise;
	}

	request(method: string, params: unknown): Promise<unknown> {
		const child = this.child;
		if (!child?.stdin.writable) {
			throw new Error("codex app-server is not running.");
		}
		if (this.exitError) throw this.exitError;

		const id = this.nextId++;
		const payload = params === undefined ? { method, id } : { method, id, params };
		const response = new Promise<unknown>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pending.delete(id);
				reject(
					new Error(`Timed out after ${Math.round(this.timeoutMs / 1000)}s waiting for ${method}.`),
				);
			}, this.timeoutMs);

			this.pending.set(id, {
				resolve: (value) => {
					clearTimeout(timeout);
					resolve(value);
				},
				reject: (error) => {
					clearTimeout(timeout);
					reject(error);
				},
			});
		});

		child.stdin.write(`${JSON.stringify(payload)}\n`);
		return response;
	}

	notify(method: string): void {
		const child = this.child;
		if (!child?.stdin.writable) return;
		child.stdin.write(`${JSON.stringify({ method })}\n`);
	}

	dispose(): void {
		this.signal?.removeEventListener("abort", this.abortHandler);
		for (const [id, pending] of this.pending) {
			pending.reject(new Error(`codex app-server request ${id} cancelled.`));
		}
		this.pending.clear();

		const child = this.child;
		if (!child) return;
		child.stdin.end();
		if (child.exitCode === null && child.signalCode === null) {
			child.kill("SIGTERM");
			const forceKill = setTimeout(() => {
				if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
			}, 1000);
			forceKill.unref?.();
		}
		this.child = undefined;
	}

	private handleChunk(chunk: string): void {
		this.stdoutBuffer += chunk.slice(0, MAX_RPC_LINE_BYTES + 1);
		if (this.stdoutBuffer.length > MAX_RPC_LINE_BYTES) {
			this.rejectAll(new Error("codex app-server response exceeded the size limit."));
			this.dispose();
			return;
		}
		let newline = this.stdoutBuffer.indexOf("\n");
		while (newline >= 0) {
			const line = this.stdoutBuffer.slice(0, newline);
			this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
			this.handleLine(line);
			newline = this.stdoutBuffer.indexOf("\n");
		}
	}

	private handleLine(line: string): void {
		let parsed: RpcResponse;
		try {
			parsed = JSON.parse(line) as RpcResponse;
		} catch {
			return;
		}

		if (typeof parsed.id !== "number") return;
		const pending = this.pending.get(parsed.id);
		if (!pending) return;
		this.pending.delete(parsed.id);

		if (parsed.error) {
			const message =
				typeof parsed.error.message === "string"
					? safeCodexErrorMessage(parsed.error.message)
					: "unknown error";
			pending.reject(new Error(`codex app-server request failed: ${message}`));
			return;
		}

		pending.resolve(parsed.result);
	}

	private rejectAll(error: Error): void {
		for (const pending of this.pending.values()) pending.reject(error);
		this.pending.clear();
	}
}

function parseJsonObject(text: string, description: string): Record<string, unknown> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text) as unknown;
	} catch (error) {
		throw new Error(`${description} was not valid JSON: ${errorMessage(error)}`);
	}
	return assertObject(parsed, description);
}

function assertObject(value: unknown, description: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${description} was not an object.`);
	}
	return value as Record<string, unknown>;
}

function truncateEnd(value: string, maxChars: number): string {
	if (value.length <= maxChars) return value;
	return `${value.slice(0, maxChars - 1)}…`;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
