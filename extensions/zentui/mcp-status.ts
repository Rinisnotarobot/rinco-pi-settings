import { stripVTControlCharacters } from "node:util";

export interface McpStatus {
	connected: number;
	total: number;
}

/** Parses the adapter's public status text without intercepting or modifying UI methods. */
export function parseMcpStatus(text: string | undefined): McpStatus | undefined {
	if (typeof text !== "string" || text.length === 0) return undefined;
	const status = stripVTControlCharacters(text.slice(0, 2048));
	const enabledMatch = status.match(
		/MCP:\s*(\d{1,5})\s+servers?\s+enabled(?:\s*\(\s*(\d{1,5})\s+connected\s*\))?(?:\s*\(\s*(\d{1,5})\s+disabled\s*\))?\s*$/i,
	);
	const legacyMatch = status.match(/MCP:\s*(\d{1,5})\s*\/\s*(\d{1,5})\s+servers\b/i);
	if (!enabledMatch && !legacyMatch) return undefined;
	const connected = Number(enabledMatch ? (enabledMatch[2] ?? 0) : legacyMatch![1]);
	const total = Number(enabledMatch ? enabledMatch[1] : legacyMatch![2]);
	const disabled = enabledMatch?.[3] === undefined ? 0 : Number(enabledMatch[3]);
	if (![connected, total, disabled].every(Number.isSafeInteger)) return undefined;
	if (connected < 0 || total < 0 || connected > total || total > 10_000 || disabled > 10_000) return undefined;
	return { connected, total };
}

export const parseMcpAdapterStatus = parseMcpStatus;
