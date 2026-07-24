import { stripVTControlCharacters } from "node:util";

export interface McpStatus {
	connected: number;
	total: number;
}

/** Parses the adapter's public status text without intercepting or modifying UI methods. */
export function parseMcpStatus(text: string | undefined): McpStatus | undefined {
	if (typeof text !== "string" || text.length === 0) return undefined;
	const match = stripVTControlCharacters(text.slice(0, 2048)).match(
		/MCP:\s*(\d{1,5})\s*\/\s*(\d{1,5})\s+servers\b/i,
	);
	if (!match) return undefined;
	const connected = Number(match[1]);
	const total = Number(match[2]);
	if (!Number.isSafeInteger(connected) || !Number.isSafeInteger(total)) return undefined;
	if (connected < 0 || total < 0 || connected > total || total > 10_000) return undefined;
	return { connected, total };
}

export const parseMcpAdapterStatus = parseMcpStatus;
