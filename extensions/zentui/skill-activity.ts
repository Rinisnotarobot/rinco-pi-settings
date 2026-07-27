import { isAbsolute, normalize, resolve } from "node:path";

export interface SkillReference {
	name: string;
	filePath: string;
}

export interface SkillCounts {
	total: number;
	active: number;
}

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeSkillPath(path: string, cwd: string): string | undefined {
	const withoutAt = path.startsWith("@") ? path.slice(1) : path;
	if (!withoutAt || withoutAt.includes("\0")) return undefined;
	return normalize(isAbsolute(withoutAt) ? withoutAt : resolve(cwd, withoutAt));
}

function messageText(message: RecordLike): string {
	const content = message.content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((item): item is RecordLike => isRecord(item) && item.type === "text")
		.map((item) => (typeof item.text === "string" ? item.text : ""))
		.join("\n");
}

function toolCalls(message: RecordLike): RecordLike[] {
	if (!Array.isArray(message.content)) return [];
	return message.content.filter(
		(item): item is RecordLike => isRecord(item) && item.type === "toolCall",
	);
}

function readPathFromToolCall(toolCall: RecordLike): string | undefined {
	if (toolCall.name !== "read" || !isRecord(toolCall.arguments)) return undefined;
	const path = toolCall.arguments.path;
	return typeof path === "string" ? path : undefined;
}

const SKILL_BLOCK_PATTERN = /<skill\s+name="[^"\r\n]{1,128}"\s+location="([^"\r\n]{1,4096})">/g;

export class SkillActivityTracker {
	private availableByName = new Map<string, string>();
	private activatedPaths = new Set<string>();
	private synced = false;

	reset(): void {
		this.availableByName.clear();
		this.activatedPaths.clear();
		this.synced = false;
	}

	syncAvailable(skills: readonly SkillReference[], cwd: string): boolean {
		const before = this.counts();
		const next = new Map<string, string>();
		for (const skill of skills) {
			if (!skill.name || next.has(skill.name)) continue;
			const path = normalizeSkillPath(skill.filePath, cwd);
			if (path) next.set(skill.name, path);
		}
		this.availableByName = next;
		this.synced = true;
		return !sameCounts(before, this.counts());
	}

	activateFromPrompt(prompt: string, cwd: string): boolean {
		const before = this.counts();
		SKILL_BLOCK_PATTERN.lastIndex = 0;
		let match = SKILL_BLOCK_PATTERN.exec(prompt);
		while (match) {
			const path = match[1] ? normalizeSkillPath(match[1], cwd) : undefined;
			if (path) this.activatedPaths.add(path);
			match = SKILL_BLOCK_PATTERN.exec(prompt);
		}
		return !sameCounts(before, this.counts());
	}

	activateFromRead(path: string, cwd: string): boolean {
		const before = this.counts();
		const normalized = normalizeSkillPath(path, cwd);
		if (normalized) this.activatedPaths.add(normalized);
		return !sameCounts(before, this.counts());
	}

	restoreFromEntries(entries: readonly unknown[], cwd: string): boolean {
		const before = this.counts();
		this.activatedPaths.clear();
		const pendingReads = new Map<string, string>();

		for (const entry of entries) {
			if (!isRecord(entry) || entry.type !== "message" || !isRecord(entry.message)) continue;
			const message = entry.message;
			if (message.role === "user") {
				this.activateFromPrompt(messageText(message), cwd);
				continue;
			}
			if (message.role === "assistant") {
				for (const toolCall of toolCalls(message)) {
					const id = typeof toolCall.id === "string" ? toolCall.id : undefined;
					const path = readPathFromToolCall(toolCall);
					if (id && path) pendingReads.set(id, path);
				}
				continue;
			}
			if (message.role !== "toolResult" || message.toolName !== "read" || message.isError === true) {
				continue;
			}
			const id = typeof message.toolCallId === "string" ? message.toolCallId : undefined;
			const path = id ? pendingReads.get(id) : undefined;
			if (path) this.activateFromRead(path, cwd);
		}

		return !sameCounts(before, this.counts());
	}

	counts(): SkillCounts | undefined {
		if (!this.synced) return undefined;
		const activeNames = new Set<string>();
		for (const [name, path] of this.availableByName) {
			if (this.activatedPaths.has(path)) activeNames.add(name);
		}
		return { total: this.availableByName.size, active: activeNames.size };
	}
}

function sameCounts(left: SkillCounts | undefined, right: SkillCounts | undefined): boolean {
	return left?.total === right?.total && left?.active === right?.active;
}

export function formatSkillCounts(counts: SkillCounts): string {
	if (counts.total <= 0) return "";
	const total = Math.max(0, Math.trunc(counts.total));
	const active = Math.min(total, Math.max(0, Math.trunc(counts.active)));
	return `★ ${active}/${total}`;
}
