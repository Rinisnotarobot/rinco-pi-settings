import { randomUUID } from "node:crypto";
import {
	closeSync,
	existsSync,
	fchmodSync,
	fsyncSync,
	lstatSync,
	openSync,
	readFileSync,
	realpathSync,
	renameSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import {
	ICON_GLYPH_KEYS,
	type IconGlyphs,
	type IconMode,
	NERD_DEFAULT_ICONS,
	normalizeIconMode,
	type ResolvedIcons,
	resolveConfiguredIcons,
} from "./icons";
import { isSupportedColorSpec } from "./style";

export type ColorSpec = string;
export type ColorSource = "theme" | "terminal";
export type { IconMode } from "./icons";

export type ContextStyle = "text" | "gauge" | "text+gauge";
export type SeparatorStyle = "pipe" | "dot" | "chevron" | "none";

export type ContextThresholds = {
	warning: number;
	error: number;
};

export type PathDisplayMode = "basename" | "full";

export type PathDisplayConfig = {
	mode: PathDisplayMode;
	/** Trailing directories to show in full mode. 0 = unlimited; clamped to 0..5. */
	depth: number;
};

export type GitBranchMaxLength = "full" | number;

export type GitBranchConfig = {
	maxLength: GitBranchMaxLength;
};

export type ColorSourcesConfig = {
	starship: ColorSource;
};

export type UiFeaturesConfig = {
	statusLine: boolean;
};

export type FooterSegmentsConfig = {
	cwd: boolean;
	gitBranch: boolean;
	gitStatus: boolean;
	gitCounts: boolean;
	gitCommit: boolean;
	gitMetrics: boolean;
	runtime: boolean;
	context: boolean;
	tokens: boolean;
	cost: boolean;
	sessionDuration: boolean;
	username: boolean;
	time: boolean;
	os: boolean;
	packageVersion: boolean;
	sessionName: boolean;
	model: boolean;
	thinking: boolean;
	turnCount: boolean;
	cacheDetails: boolean;
	codexUsage: boolean;
	configCounts: boolean;
	skills: boolean;
	mcp: boolean;
	toolActivity: boolean;
	agentActivity: boolean;
};


export type ExtensionStatusPlacement = "off" | "left" | "middle" | "right";
export type ExtensionStatusColorMode = "zentui" | "original";

/**
 * Starship `git_commit`-style options.
 * See https://starship.rs/config/#git-commit
 */
export type GitCommitConfig = {
	hashLength: number;
	onlyDetached: boolean;
	showTag: boolean;
};

/**
 * Starship `git_metrics`-style options.
 * See https://starship.rs/config/#git-metrics
 */
export type GitMetricsConfig = {
	onlyNonzero: boolean;
	ignoreSubmodules: boolean;
};

const DEFAULT_EXTENSION_STATUS_COLOR_MODE: ExtensionStatusColorMode = "zentui";

export type ExtensionStatusesConfig = {
	defaultPlacement: ExtensionStatusPlacement;
	placements: Record<string, ExtensionStatusPlacement>;
	colorModes: Record<string, ExtensionStatusColorMode>;
};

const DEFAULT_PROJECT_REFRESH_INTERVAL_MS = 30_000;
const MIN_PROJECT_REFRESH_INTERVAL_MS = 5_000;

export type PolishedTuiConfig = {
	projectRefreshIntervalMs: number;
	footerFormat: string;
	separator: SeparatorStyle;
	contextStyle: ContextStyle;
	contextThresholds: ContextThresholds;
	pathDisplay: PathDisplayConfig;
	gitBranch: GitBranchConfig;
	icons: ResolvedIcons;
	colors: {
		cwd: ColorSpec;
		gitBranch: ColorSpec;
		gitStatus: ColorSpec;
		contextNormal: ColorSpec;
		contextWarning: ColorSpec;
		contextError: ColorSpec;
		tokens: ColorSpec;
		cost: ColorSpec;
		separator: ColorSpec;
		runtimePrefix: ColorSpec;
		extensionStatus: ColorSpec;
		sessionDuration: ColorSpec;
		packageVersion: ColorSpec;
		gitCommit: ColorSpec;
		gitMetricsAdded: ColorSpec;
		gitMetricsDeleted: ColorSpec;
		username: ColorSpec;
		time: ColorSpec;
		os: ColorSpec;
		muted: ColorSpec;
	};
	colorSources: ColorSourcesConfig;
	features: UiFeaturesConfig;
	footerSegments: FooterSegmentsConfig;
	gitCommit: GitCommitConfig;
	gitMetrics: GitMetricsConfig;
	extensionStatuses: ExtensionStatusesConfig;
};

/**
 * Canonical footer format variable names. In a `footerFormat` string these
 * are written as `$name` or `${name}`.
 */
export const FOOTER_FORMAT_VARIABLES = [
	"cwd",
	"git_branch",
	"git_status",
	"git_state",
	"runtime",
	"session_duration",
	"username",
	"os",
	"time",
	"context",
	"tokens",
	"cost",
	"package",
	"package_version",
	"git_commit",
	"git_tag",
	"git_metrics",
	"git_added",
	"git_deleted",
	"session_name",
	"model",
	"provider",
	"model_id",
	"thinking",
	"turn",
	"cache_read",
	"cache_write",
	"cache_hit",
	"codex_usage",
	"instruction_files",
	"agents_files",
	"claude_files",
	"skills",
	"active_skills",
	"extensions",
	"mcp",
	"tool_counts",
	"running_tools",
	"active_agents",
	"sep",
] as const;

/**
 * Alias → canonical variable name mapping for `footerFormat`.
 * `$fill` is special (not a variable) and handled by the parser.
 */
export const FOOTER_FORMAT_ALIASES: Record<string, string> = {
	directory: "cwd",
	branch: "git_branch",
	status: "git_status",
	state: "git_state",
	commit: "git_commit",
	tag: "git_tag",
	duration: "session_duration",
	session: "session_name",
	thinking_level: "thinking",
	turn_count: "turn",
	codex: "codex_usage",
	tools: "tool_counts",
	agents: "active_agents",
	separator: "sep",
};

export const configPath = join(getAgentDir(), "sakura-cyberdeck-zentui.json");

export const defaultConfig: PolishedTuiConfig = {
	projectRefreshIntervalMs: DEFAULT_PROJECT_REFRESH_INTERVAL_MS,
	footerFormat: "",
	separator: "chevron",
	contextStyle: "text+gauge",
	contextThresholds: { warning: 70, error: 90 },
	pathDisplay: { mode: "basename", depth: 0 },
	gitBranch: { maxLength: 30 },
	icons: {
		mode: "auto",
		...NERD_DEFAULT_ICONS,
	},
	colors: {
		cwd: "bold #F2A7C6",
		gitBranch: "bold #C7B8F5",
		gitStatus: "bold #F6BC9A",
		contextNormal: "#AEE5C5",
		contextWarning: "bold #F3D98B",
		contextError: "bold #FF8FA3",
		tokens: "#A99BAE",
		cost: "bold #AEE5C5",
		separator: "#716879",
		runtimePrefix: "#9FD3F2",
		extensionStatus: "#EFC3E6",
		sessionDuration: "#F3D98B",
		packageVersion: "#F6BC9A",
		gitCommit: "#AEE5C5",
		gitMetricsAdded: "#AEE5C5",
		gitMetricsDeleted: "#FF8FA3",
		username: "#F3D98B",
		time: "#F3D98B",
		os: "#F7EEF8",
		muted: "#A99BAE",
	},
	colorSources: {
		starship: "terminal",
	},
	features: {
		statusLine: true,
	},
	footerSegments: {
		cwd: true,
		gitBranch: true,
		gitStatus: true,
		gitCounts: false,
		runtime: true,
		context: true,
		tokens: true,
		cost: true,
		sessionDuration: false,
		username: false,
		time: false,
		os: true,
		packageVersion: false,
		gitCommit: false,
		gitMetrics: false,
		sessionName: true,
		model: true,
		thinking: true,
		turnCount: true,
		cacheDetails: true,
		codexUsage: true,
		configCounts: false,
		skills: true,
		mcp: true,
		toolActivity: true,
		agentActivity: true,
	},
	gitCommit: {
		hashLength: 7,
		onlyDetached: true,
		showTag: true,
	},
	gitMetrics: {
		onlyNonzero: true,
		ignoreSubmodules: false,
	},
	extensionStatuses: {
		defaultPlacement: "right",
		placements: {
			"dual-subscription-quota": "left",
			"codex-goal": "middle",
			"xai-usage": "right",
		},
		colorModes: {},
	},
};

type ConfigRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ConfigRecord {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseProjectRefreshIntervalMs(value: unknown): number {
	if (value === 0) return 0;
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return DEFAULT_PROJECT_REFRESH_INTERVAL_MS;
	}

	const interval = Math.round(value);
	if (interval <= 0) return 0;
	return Math.max(MIN_PROJECT_REFRESH_INTERVAL_MS, interval);
}

function clampPercent(value: number): number {
	return Math.max(0, Math.min(100, value));
}

function parseContextStyle(value: unknown): ContextStyle {
	if (value === "text" || value === "gauge" || value === "text+gauge") return value;
	return defaultConfig.contextStyle;
}

export function isSeparatorStyle(value: unknown): value is SeparatorStyle {
	return value === "pipe" || value === "dot" || value === "chevron" || value === "none";
}

function parseSeparatorStyle(value: unknown): SeparatorStyle {
	return isSeparatorStyle(value) ? value : defaultConfig.separator;
}

function parseContextThresholds(value: unknown): ContextThresholds {
	const defaults = defaultConfig.contextThresholds;
	if (!isRecord(value)) return { ...defaults };

	const warningRaw = value.warning;
	const errorRaw = value.error;
	let warning =
		typeof warningRaw === "number" && Number.isFinite(warningRaw)
			? clampPercent(Math.round(warningRaw))
			: defaults.warning;
	let error =
		typeof errorRaw === "number" && Number.isFinite(errorRaw)
			? clampPercent(Math.round(errorRaw))
			: defaults.error;
	if (error < warning) {
		const swapped = warning;
		warning = error;
		error = swapped;
	}
	return { warning, error };
}

function parsePathDisplay(value: unknown): PathDisplayConfig {
	const defaults = defaultConfig.pathDisplay;
	if (!isRecord(value)) return { ...defaults };
	const mode = value.mode === "full" || value.mode === "basename" ? value.mode : defaults.mode;
	const rawDepth = value.depth;
	const depth =
		typeof rawDepth === "number" && Number.isFinite(rawDepth) && rawDepth >= 0
			? Math.min(5, Math.floor(rawDepth))
			: defaults.depth;
	return { mode, depth };
}

function normalizeGitBranchMaxLength(value: unknown): GitBranchMaxLength {
	if (value === "full") return value;
	if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
	return defaultConfig.gitBranch.maxLength;
}

function parseGitBranchConfig(value: unknown): GitBranchConfig {
	const defaults = defaultConfig.gitBranch;
	if (!isRecord(value)) return { ...defaults };
	return {
		maxLength: normalizeGitBranchMaxLength(value.maxLength),
	};
}

function stringValue(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" ? value : undefined;
}

function sanitizeConfigText(value: string, maxLength: number): string {
	return stripVTControlCharacters(value.slice(0, maxLength * 4))
		.replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
		.slice(0, maxLength);
}

function colorValue(record: Record<string, unknown>, key: string): string | undefined {
	const value = stringValue(record, key);
	return value !== undefined && isSupportedColorSpec(value) ? value : undefined;
}

function colorSourceValue(
	record: Record<string, unknown>,
	key: keyof ColorSourcesConfig,
): ColorSource {
	const value = record[key];
	return value === "terminal" || value === "theme" ? value : defaultConfig.colorSources[key];
}

function booleanValue(record: Record<string, unknown>, key: keyof UiFeaturesConfig): boolean {
	const value = record[key];
	return typeof value === "boolean" ? value : defaultConfig.features[key];
}

function footerSegmentValue(
	record: Record<string, unknown>,
	key: keyof FooterSegmentsConfig,
): boolean {
	const value = record[key];
	return typeof value === "boolean" ? value : defaultConfig.footerSegments[key];
}

function definedColors(
	colors: Partial<Record<keyof PolishedTuiConfig["colors"], string | undefined>>,
): Partial<PolishedTuiConfig["colors"]> {
	return Object.fromEntries(
		Object.entries(colors).filter(
			(entry): entry is [keyof PolishedTuiConfig["colors"], string] => typeof entry[1] === "string",
		),
	) as Partial<PolishedTuiConfig["colors"]>;
}

function normalizeIconOverrides(record: Record<string, unknown>): Partial<IconGlyphs> {
	return Object.fromEntries(
		ICON_GLYPH_KEYS.flatMap((key) => {
			const value = stringValue(record, key);
			return value === undefined ? [] : [[key, sanitizeConfigText(value, 64)]];
		}),
	) as Partial<IconGlyphs>;
}

function normalizeColors(record: Record<string, unknown>): Partial<PolishedTuiConfig["colors"]> {
	return definedColors({
		cwd: colorValue(record, "cwd") ?? colorValue(record, "cwdText"),
		gitBranch: colorValue(record, "gitBranch") ?? colorValue(record, "git"),
		gitStatus: colorValue(record, "gitStatus"),
		contextNormal: colorValue(record, "contextNormal"),
		contextWarning: colorValue(record, "contextWarning"),
		contextError: colorValue(record, "contextError"),
		tokens: colorValue(record, "tokens"),
		cost: colorValue(record, "cost"),
		separator: colorValue(record, "separator"),
		runtimePrefix: colorValue(record, "runtimePrefix"),
		extensionStatus: colorValue(record, "extensionStatus"),
		sessionDuration: colorValue(record, "sessionDuration"),
		packageVersion: colorValue(record, "packageVersion"),
		gitCommit: colorValue(record, "gitCommit"),
		gitMetricsAdded: colorValue(record, "gitMetricsAdded"),
		gitMetricsDeleted: colorValue(record, "gitMetricsDeleted"),
		username: colorValue(record, "username"),
		time: colorValue(record, "time"),
		os: colorValue(record, "os"),
		muted: colorValue(record, "muted"),
	});
}

function normalizeColorSources(record: Record<string, unknown>): ColorSourcesConfig {
	return { starship: colorSourceValue(record, "starship") };
}

function normalizeUiFeatures(record: Record<string, unknown>): UiFeaturesConfig {
	return { statusLine: booleanValue(record, "statusLine") };
}

function normalizeFooterSegments(record: Record<string, unknown>): FooterSegmentsConfig {
	return {
		cwd: footerSegmentValue(record, "cwd"),
		gitBranch: footerSegmentValue(record, "gitBranch"),
		gitStatus: footerSegmentValue(record, "gitStatus"),
		gitCounts: footerSegmentValue(record, "gitCounts"),
		runtime: footerSegmentValue(record, "runtime"),
		context: footerSegmentValue(record, "context"),
		tokens: footerSegmentValue(record, "tokens"),
		cost: footerSegmentValue(record, "cost"),
		sessionDuration: footerSegmentValue(record, "sessionDuration"),
		username: footerSegmentValue(record, "username"),
		time: footerSegmentValue(record, "time"),
		os: footerSegmentValue(record, "os"),
		packageVersion: footerSegmentValue(record, "packageVersion"),
		gitCommit: footerSegmentValue(record, "gitCommit"),
		gitMetrics: footerSegmentValue(record, "gitMetrics"),
		sessionName: footerSegmentValue(record, "sessionName"),
		model: footerSegmentValue(record, "model"),
		thinking: footerSegmentValue(record, "thinking"),
		turnCount: footerSegmentValue(record, "turnCount"),
		cacheDetails: footerSegmentValue(record, "cacheDetails"),
		codexUsage: footerSegmentValue(record, "codexUsage"),
		configCounts: footerSegmentValue(record, "configCounts"),
		skills: footerSegmentValue(record, "skills"),
		mcp: footerSegmentValue(record, "mcp"),
		toolActivity: footerSegmentValue(record, "toolActivity"),
		agentActivity: footerSegmentValue(record, "agentActivity"),
	};
}

/** Clamp hashLength to Git's valid abbreviation range [4, 40]. */
function normalizeGitHashLength(value: unknown): number {
	const parsed = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(parsed)) return defaultConfig.gitCommit.hashLength;
	const rounded = Math.round(parsed);
	return Math.min(40, Math.max(4, rounded));
}

function normalizeGitCommitConfig(record: Record<string, unknown>): GitCommitConfig {
	return {
		hashLength: normalizeGitHashLength(record.hashLength),
		onlyDetached:
			typeof record.onlyDetached === "boolean"
				? record.onlyDetached
				: defaultConfig.gitCommit.onlyDetached,
		showTag: typeof record.showTag === "boolean" ? record.showTag : defaultConfig.gitCommit.showTag,
	};
}

function normalizeGitMetricsConfig(record: Record<string, unknown>): GitMetricsConfig {
	return {
		onlyNonzero:
			typeof record.onlyNonzero === "boolean"
				? record.onlyNonzero
				: defaultConfig.gitMetrics.onlyNonzero,
		ignoreSubmodules:
			typeof record.ignoreSubmodules === "boolean"
				? record.ignoreSubmodules
				: defaultConfig.gitMetrics.ignoreSubmodules,
	};
}

export function isExtensionStatusPlacement(value: unknown): value is ExtensionStatusPlacement {
	return value === "off" || value === "left" || value === "middle" || value === "right";
}

export function isExtensionStatusColorMode(value: unknown): value is ExtensionStatusColorMode {
	return value === "zentui" || value === "original";
}

function normalizeExtensionStatuses(record: Record<string, unknown>): ExtensionStatusesConfig {
	const defaultPlacement = isExtensionStatusPlacement(record.defaultPlacement)
		? record.defaultPlacement
		: defaultConfig.extensionStatuses.defaultPlacement;
	const placements = isRecord(record.placements)
		? Object.fromEntries(
				Object.entries(record.placements).filter(
					(entry): entry is [string, ExtensionStatusPlacement] =>
						isExtensionStatusPlacement(entry[1]),
				),
			)
		: {};
	const colorModes = isRecord(record.colorModes)
		? Object.fromEntries(
				Object.entries(record.colorModes).filter(
					(entry): entry is [string, ExtensionStatusColorMode] =>
						isExtensionStatusColorMode(entry[1]),
				),
			)
		: {};

	return {
		defaultPlacement,
		placements,
		colorModes,
	};
}

function isColorSourceKey(value: string): value is keyof ColorSourcesConfig {
	return value === "starship";
}

function isUiFeatureKey(value: string): value is keyof UiFeaturesConfig {
	return value === "statusLine";
}

function isFooterSegmentKey(value: string): value is keyof FooterSegmentsConfig {
	return (
		value === "cwd" ||
		value === "gitBranch" ||
		value === "gitStatus" ||
		value === "gitCounts" ||
		value === "runtime" ||
		value === "context" ||
		value === "tokens" ||
		value === "cost" ||
		value === "sessionDuration" ||
		value === "username" ||
		value === "time" ||
		value === "os" ||
		value === "packageVersion" ||
		value === "gitCommit" ||
		value === "gitMetrics" ||
		value === "sessionName" ||
		value === "model" ||
		value === "thinking" ||
		value === "turnCount" ||
		value === "cacheDetails" ||
		value === "codexUsage" ||
		value === "configCounts" ||
		value === "skills" ||
		value === "mcp" ||
		value === "toolActivity" ||
		value === "agentActivity"
	);
}

function validColorSourceEntries(record: Record<string, unknown>): Partial<ColorSourcesConfig> {
	return Object.fromEntries(
		Object.entries(record).filter((entry): entry is [keyof ColorSourcesConfig, ColorSource] => {
			const [key, value] = entry;
			return isColorSourceKey(key) && (value === "theme" || value === "terminal");
		}),
	) as Partial<ColorSourcesConfig>;
}

function validUiFeatureEntries(record: Record<string, unknown>): Partial<UiFeaturesConfig> {
	return Object.fromEntries(
		Object.entries(record).filter((entry): entry is [keyof UiFeaturesConfig, boolean] => {
			const [key, value] = entry;
			return isUiFeatureKey(key) && typeof value === "boolean";
		}),
	) as Partial<UiFeaturesConfig>;
}

function validFooterSegmentEntries(record: Record<string, unknown>): Partial<FooterSegmentsConfig> {
	return Object.fromEntries(
		Object.entries(record).filter((entry): entry is [keyof FooterSegmentsConfig, boolean] => {
			const [key, value] = entry;
			return isFooterSegmentKey(key) && typeof value === "boolean";
		}),
	) as Partial<FooterSegmentsConfig>;
}

type ConfigFileState =
	| { kind: "missing"; record: ConfigRecord; writePath: string }
	| { kind: "valid"; record: ConfigRecord; writePath: string; mode: number }
	| { kind: "corrupt"; error: unknown };

function errorCode(error: unknown): string | undefined {
	return typeof error === "object" && error !== null && "code" in error
		? String(error.code)
		: undefined;
}

function readConfigFileState(path: string): ConfigFileState {
	let writePath = path;
	try {
		const pathStat = lstatSync(path);
		if (pathStat.isSymbolicLink()) writePath = realpathSync(path);
		const targetStat = statSync(writePath);
		const parsed = JSON.parse(readFileSync(writePath, "utf8"));
		return isRecord(parsed)
			? { kind: "valid", record: parsed, writePath, mode: targetStat.mode & 0o7777 }
			: { kind: "corrupt", error: new Error("top-level value must be a JSON object") };
	} catch (error) {
		if (errorCode(error) === "ENOENT") {
			try {
				lstatSync(path);
			} catch (pathError) {
				if (errorCode(pathError) === "ENOENT")
					return { kind: "missing", record: {}, writePath: path };
			}
		}
		return { kind: "corrupt", error };
	}
}

function writeConfigAtomically(path: string, record: ConfigRecord, mode?: number): void {
	const tempPath = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
	let file: number | undefined;
	try {
		file = openSync(tempPath, "wx", mode ?? 0o666);
		if (mode !== undefined) fchmodSync(file, mode);
		writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
		fsyncSync(file);
		closeSync(file);
		file = undefined;
		renameSync(tempPath, path);
	} catch (error) {
		if (file !== undefined) {
			try {
				closeSync(file);
			} catch {}
		}
		try {
			unlinkSync(tempPath);
		} catch (cleanupError) {
			if (errorCode(cleanupError) !== "ENOENT") {
				// Preserve the persistence failure; the best-effort cleanup error is secondary.
			}
		}
		throw error;
	}
}

function mutateConfig(path: string, mutate: (record: ConfigRecord) => void): PolishedTuiConfig {
	const state = readConfigFileState(path);
	if (state.kind === "corrupt") {
		const detail = state.error instanceof Error ? ` (${state.error.message})` : "";
		throw new Error(
			`Refusing to save Zentui config because ${path} is corrupt or unreadable; fix or remove it first.${detail}`,
		);
	}
	mutate(state.record);
	writeConfigAtomically(
		state.writePath,
		state.record,
		state.kind === "valid" ? state.mode : undefined,
	);
	return mergeConfig(state.record);
}

export function ensureConfigExists(): void {
	// Intentionally left as a no-op. Zentui config is user-owned and
	// compatibility-sensitive: runtime defaults come from `mergeConfig({})`, and
	// the extension should not persist opinionated defaults unless the user
	// explicitly changes a setting.
}

export function mergeConfig(parsed: unknown): PolishedTuiConfig {
	const config = isRecord(parsed) ? parsed : {};
	const iconsRecord = isRecord(config.icons) ? (config.icons as Record<string, unknown>) : {};
	const iconMode = normalizeIconMode(iconsRecord.mode);
	const iconOverrides = normalizeIconOverrides(iconsRecord);
	const colors = isRecord(config.colors)
		? normalizeColors(config.colors as Record<string, unknown>)
		: {};
	const colorSources = isRecord(config.colorSources)
		? normalizeColorSources(config.colorSources as Record<string, unknown>)
		: defaultConfig.colorSources;
	const features = isRecord(config.features)
		? normalizeUiFeatures(config.features as Record<string, unknown>)
		: defaultConfig.features;
	const footerSegments = isRecord(config.footerSegments)
		? normalizeFooterSegments(config.footerSegments as Record<string, unknown>)
		: defaultConfig.footerSegments;
	const extensionStatuses = isRecord(config.extensionStatuses)
		? normalizeExtensionStatuses(config.extensionStatuses as Record<string, unknown>)
		: defaultConfig.extensionStatuses;
	const gitCommit = isRecord(config.gitCommit)
		? normalizeGitCommitConfig(config.gitCommit as Record<string, unknown>)
		: defaultConfig.gitCommit;
	const gitMetrics = isRecord(config.gitMetrics)
		? normalizeGitMetricsConfig(config.gitMetrics as Record<string, unknown>)
		: defaultConfig.gitMetrics;
	const gitBranch = parseGitBranchConfig(config.gitBranch);
	return {
		projectRefreshIntervalMs: parseProjectRefreshIntervalMs(config.projectRefreshIntervalMs),
		footerFormat: sanitizeConfigText(stringValue(config, "footerFormat") ?? "", 4096),
		separator: parseSeparatorStyle(config.separator),
		contextStyle: parseContextStyle(config.contextStyle),
		contextThresholds: parseContextThresholds(config.contextThresholds),
		pathDisplay: parsePathDisplay(config.pathDisplay),
		gitBranch,
		icons: resolveConfiguredIcons(iconMode, iconOverrides),
		colors: {
			...defaultConfig.colors,
			...colors,
		},
		colorSources: { ...colorSources },
		features: { ...features },
		footerSegments: { ...footerSegments },
		gitCommit,
		gitMetrics,
		extensionStatuses: {
			defaultPlacement: extensionStatuses.defaultPlacement,
			placements: { ...extensionStatuses.placements },
			colorModes: { ...extensionStatuses.colorModes },
		},
	};
}

export function getExtensionStatusPlacement(
	config: PolishedTuiConfig,
	key: string,
): ExtensionStatusPlacement {
	return config.extensionStatuses.placements[key] ?? config.extensionStatuses.defaultPlacement;
}

export function getExtensionStatusColorMode(
	config: PolishedTuiConfig,
	key: string,
): ExtensionStatusColorMode {
	return config.extensionStatuses.colorModes[key] ?? DEFAULT_EXTENSION_STATUS_COLOR_MODE;
}

export function loadConfig(): PolishedTuiConfig {
	try {
		if (!existsSync(configPath)) return mergeConfig({});
		return mergeConfig(JSON.parse(readFileSync(configPath, "utf8")));
	} catch {
		return mergeConfig({});
	}
}

export function saveColorSourcesPatch(
	patch: Partial<ColorSourcesConfig>,
	path = configPath,
): PolishedTuiConfig {
	return mutateConfig(path, (record) => {
		const existing = isRecord(record.colorSources)
			? { ...(record.colorSources as Record<string, unknown>) }
			: {};
		record.colorSources = {
			...existing,
			...validColorSourceEntries(patch),
		};
	});
}

export function saveUiFeaturesPatch(
	patch: Partial<UiFeaturesConfig>,
	path = configPath,
): PolishedTuiConfig {
	return mutateConfig(path, (record) => {
		const existing = isRecord(record.features)
			? { ...(record.features as Record<string, unknown>) }
			: {};
		record.features = {
			...existing,
			...validUiFeatureEntries(patch),
		};
	});
}

export function saveFooterSegmentsPatch(
	patch: Partial<FooterSegmentsConfig>,
	path = configPath,
): PolishedTuiConfig {
	return mutateConfig(path, (record) => {
		const existing = isRecord(record.footerSegments)
			? { ...(record.footerSegments as Record<string, unknown>) }
			: {};
		record.footerSegments = {
			...existing,
			...validFooterSegmentEntries(patch),
		};
	});
}

export function saveFooterFormatPatch(value: string, path = configPath): PolishedTuiConfig {
	return mutateConfig(path, (record) => {
		record.footerFormat = typeof value === "string" ? sanitizeConfigText(value, 4096) : "";
	});
}

export function saveIconsModePatch(mode: IconMode, path = configPath): PolishedTuiConfig {
	return mutateConfig(path, (record) => {
		const existing = isRecord(record.icons) ? { ...(record.icons as Record<string, unknown>) } : {};
		record.icons = {
			...existing,
			mode: normalizeIconMode(mode),
		};
	});
}

export function saveContextStylePatch(style: ContextStyle, path = configPath): PolishedTuiConfig {
	return mutateConfig(path, (record) => {
		record.contextStyle = parseContextStyle(style);
	});
}

export function saveSeparatorPatch(
	separator: SeparatorStyle,
	path = configPath,
): PolishedTuiConfig {
	return mutateConfig(path, (record) => {
		record.separator = parseSeparatorStyle(separator);
	});
}

export function saveContextThresholdsPatch(
	thresholds: Partial<ContextThresholds>,
	path = configPath,
): PolishedTuiConfig {
	return mutateConfig(path, (record) => {
		const existing = isRecord(record.contextThresholds)
			? { ...(record.contextThresholds as Record<string, unknown>) }
			: {};
		record.contextThresholds = {
			...existing,
			...thresholds,
		};
	});
}

export function savePathDisplayPatch(
	patch: Partial<PathDisplayConfig>,
	path = configPath,
): PolishedTuiConfig {
	return mutateConfig(path, (record) => {
		const existing = isRecord(record.pathDisplay)
			? { ...(record.pathDisplay as Record<string, unknown>) }
			: {};
		if (patch.mode !== undefined) existing.mode = patch.mode;
		if (patch.depth !== undefined) existing.depth = patch.depth;
		record.pathDisplay = existing;
	});
}

export function saveGitBranchPatch(
	patch: Partial<GitBranchConfig>,
	path = configPath,
): PolishedTuiConfig {
	return mutateConfig(path, (record) => {
		const existing = isRecord(record.gitBranch)
			? { ...(record.gitBranch as Record<string, unknown>) }
			: {};
		if (patch.maxLength !== undefined)
			existing.maxLength = normalizeGitBranchMaxLength(patch.maxLength);
		record.gitBranch = existing;
	});
}

export function saveExtensionStatusPlacement(
	key: string,
	placement: ExtensionStatusPlacement,
	path = configPath,
): PolishedTuiConfig {
	return mutateConfig(path, (record) => {
		const existingExtensionStatuses = isRecord(record.extensionStatuses)
			? { ...(record.extensionStatuses as Record<string, unknown>) }
			: {};
		const existingPlacements = isRecord(existingExtensionStatuses.placements)
			? { ...(existingExtensionStatuses.placements as Record<string, unknown>) }
			: {};

		Object.defineProperty(existingPlacements, key, {
			value: placement,
			enumerable: true,
			configurable: true,
			writable: true,
		});

		record.extensionStatuses = {
			...existingExtensionStatuses,
			placements: existingPlacements,
		};
	});
}

export function saveExtensionStatusColorMode(
	key: string,
	colorMode: ExtensionStatusColorMode,
	path = configPath,
): PolishedTuiConfig {
	return mutateConfig(path, (record) => {
		const existingExtensionStatuses = isRecord(record.extensionStatuses)
			? { ...(record.extensionStatuses as Record<string, unknown>) }
			: {};
		const existingColorModes = isRecord(existingExtensionStatuses.colorModes)
			? { ...(existingExtensionStatuses.colorModes as Record<string, unknown>) }
			: {};

		Object.defineProperty(existingColorModes, key, {
			value: colorMode,
			enumerable: true,
			configurable: true,
			writable: true,
		});

		record.extensionStatuses = {
			...existingExtensionStatuses,
			colorModes: existingColorModes,
		};
	});
}
