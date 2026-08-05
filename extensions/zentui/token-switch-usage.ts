const TOKEN_SWITCH_PROVIDER_ID = "token-switch";
const TOKEN_SWITCH_SUBSCRIPTION_URL =
	"https://neolink.com/backend/v1/dashboard/billing/subscription";
const TOKEN_SWITCH_USAGE_URL = "https://neolink.com/backend/v1/dashboard/billing/usage";
const MAX_RESPONSE_BODY_BYTES = 64 * 1024;

export type TokenSwitchModel = { provider: string };

type QueryTokenSwitchBalanceOptions = {
	apiKey?: string;
	fetchImpl?: typeof fetch;
	timeoutMs: number;
	signal?: AbortSignal;
};

export function isTokenSwitchModel(
	model: Pick<TokenSwitchModel, "provider"> | undefined,
): boolean {
	return model?.provider === TOKEN_SWITCH_PROVIDER_ID;
}

export function parseTokenSwitchBalance(
	subscriptionPayload: unknown,
	usagePayload: unknown,
): number {
	if (
		!subscriptionPayload ||
		typeof subscriptionPayload !== "object" ||
		Array.isArray(subscriptionPayload)
	) {
		throw new Error("Token Switch subscription response did not contain hard_limit_usd.");
	}
	const hardLimitUsd = (subscriptionPayload as Record<string, unknown>).hard_limit_usd;
	if (typeof hardLimitUsd !== "number" || !Number.isFinite(hardLimitUsd) || hardLimitUsd < 0) {
		throw new Error("Token Switch hard_limit_usd was not a non-negative number.");
	}

	if (!usagePayload || typeof usagePayload !== "object" || Array.isArray(usagePayload)) {
		throw new Error("Token Switch usage response did not contain total_usage.");
	}
	const totalUsage = (usagePayload as Record<string, unknown>).total_usage;
	if (typeof totalUsage !== "number" || !Number.isFinite(totalUsage) || totalUsage < 0) {
		throw new Error("Token Switch total_usage was not a non-negative number.");
	}

	return hardLimitUsd - totalUsage / 100;
}

export function formatTokenSwitchBalance(balance: number): string {
	return `token-switch $${balance.toFixed(2)}`;
}

export async function queryTokenSwitchBalance({
	apiKey = process.env.TOKEN_SWITCH_API_KEY,
	fetchImpl = fetch,
	timeoutMs,
	signal,
}: QueryTokenSwitchBalanceOptions): Promise<number> {
	if (!apiKey?.trim()) {
		throw new Error("TOKEN_SWITCH_API_KEY is not configured.");
	}

	const controller = new AbortController();
	const abortFromExternal = () => controller.abort();
	if (signal?.aborted) controller.abort();
	else signal?.addEventListener("abort", abortFromExternal, { once: true });
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	const fetchPayload = async (url: string, label: string): Promise<unknown> => {
		const response = await fetchImpl(url, {
			method: "GET",
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			redirect: "error",
			signal: controller.signal,
		});
		if (!response.ok) {
			throw new Error(`Token Switch ${label} endpoint returned HTTP ${response.status}.`);
		}

		const text = await response.text();
		if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BODY_BYTES) {
			throw new Error(`Token Switch ${label} response exceeded the size limit.`);
		}
		try {
			return JSON.parse(text) as unknown;
		} catch {
			throw new Error(`Token Switch ${label} response was not valid JSON.`);
		}
	};

	try {
		const subscriptionPayload = await fetchPayload(
			TOKEN_SWITCH_SUBSCRIPTION_URL,
			"subscription",
		);
		const usagePayload = await fetchPayload(TOKEN_SWITCH_USAGE_URL, "usage");
		return parseTokenSwitchBalance(subscriptionPayload, usagePayload);
	} catch (error) {
		if (controller.signal.aborted) {
			throw new Error(
				signal?.aborted
					? "Token Switch balance query was cancelled."
					: `Timed out after ${Math.round(timeoutMs / 1000)}s while fetching Token Switch balance.`,
			);
		}
		throw error;
	} finally {
		clearTimeout(timeout);
		signal?.removeEventListener("abort", abortFromExternal);
	}
}
