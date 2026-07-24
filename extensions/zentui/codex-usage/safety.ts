import { stripVTControlCharacters } from "node:util";

const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_FIELD_PATTERN =
	/("?(?:access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?token|client[_-]?secret|api[_-]?key|authorization|password)"?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;
const COOKIE_PATTERN = /((?:set-)?cookie\s*[:=]\s*)[^\r\n]*/gi;
const SECRET_QUERY_PATTERN =
	/([?&](?:access_token|refresh_token|id_token|session_token|client_secret|api_key|password)=)[^&#\s]+/gi;

export function sanitizeCodexText(value: unknown, maxChars = 600): string {
	let text = typeof value === "string" ? value : value instanceof Error ? value.message : String(value);
	text = stripVTControlCharacters(text.slice(0, Math.max(maxChars * 4, maxChars)))
		.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
	text = text
		.replace(BEARER_PATTERN, "Bearer <redacted>")
		.replace(SECRET_FIELD_PATTERN, "$1<redacted>")
		.replace(COOKIE_PATTERN, "$1<redacted>")
		.replace(SECRET_QUERY_PATTERN, "$1<redacted>");
	return text
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, maxChars);
}

export function safeCodexErrorMessage(error: unknown): string {
	return sanitizeCodexText(error instanceof Error ? error.message : error);
}
