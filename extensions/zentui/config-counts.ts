import { createRequire } from "node:module";
import { readFileSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export interface ConfigCounts {
	instructionFiles: {
		agentsMd: number;
		claudeMd: number;
		total: number;
	};
	packages: number;
}

export interface ConfigCountOptions {
	/** Overrides Pi's agent directory; useful for isolated callers and tests. */
	agentDir?: string;
	/** Injection point for the Pi SDK resolver. The SDK resolver remains the default. */
	getAgentDir?: () => string;
}

const require = createRequire(import.meta.url);
const MAX_SETTINGS_BYTES = 1024 * 1024;

function getPiAgentDir(): string {
	try {
		const agentModule = require("@earendil-works/pi-coding-agent") as {
			getAgentDir?: () => string;
		};
		return agentModule.getAgentDir?.() ?? "";
	} catch {
		return "";
	}
}

function resolveAgentDir(options: ConfigCountOptions): string {
	let agentDir = "";
	try {
		agentDir = typeof options.agentDir === "string"
			? options.agentDir
			: options.getAgentDir
				? options.getAgentDir()
				: getPiAgentDir();
	} catch {
		return "";
	}
	return agentDir && isAbsolute(agentDir) ? agentDir : "";
}

function countTopLevelFile(cwd: string, name: string): number {
	try {
		return statSync(join(cwd, name)).isFile() ? 1 : 0;
	} catch {
		return 0;
	}
}

function countPackages(agentDir: string): number {
	if (!agentDir) return 0;
	try {
		const settingsPath = join(agentDir, "settings.json");
		const stats = statSync(settingsPath);
		if (!stats.isFile() || stats.size > MAX_SETTINGS_BYTES) return 0;
		const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
			packages?: unknown;
		};
		return Array.isArray(settings?.packages) ? settings.packages.length : 0;
	} catch {
		return 0;
	}
}

export function countConfigEntries(cwd: string, options: ConfigCountOptions = {}): ConfigCounts {
	const agentDir = resolveAgentDir(options);
	const agentsMd = countTopLevelFile(cwd, "AGENTS.md");
	const claudeMd = countTopLevelFile(cwd, "CLAUDE.md");

	return {
		instructionFiles: {
			agentsMd,
			claudeMd,
			total: agentsMd + claudeMd,
		},
		packages: countPackages(agentDir),
	};
}

export const getConfigCounts = countConfigEntries;
