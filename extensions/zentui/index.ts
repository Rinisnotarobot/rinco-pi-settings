import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import registerCodexUsage from "./codex-usage/index";
import { countConfigEntries } from "./config-counts";
import { registerEffortCommand } from "./effort-command";
import {
	type ColorSourcesConfig,
	type ContextStyle,
	type ExtensionStatusColorMode,
	type ExtensionStatusPlacement,
	ensureConfigExists,
	type FooterSegmentsConfig,
	type GitBranchConfig,
	type IconMode,
	loadConfig,
	type PathDisplayConfig,
	type PolishedTuiConfig,
	type SeparatorStyle,
	saveColorSourcesPatch,
	saveContextStylePatch,
	saveExtensionStatusColorMode,
	saveExtensionStatusPlacement,
	saveFooterFormatPatch,
	saveFooterSegmentsPatch,
	saveGitBranchPatch,
	saveIconsModePatch,
	savePathDisplayPatch,
	saveSeparatorPatch,
	saveUiFeaturesPatch,
	type UiFeaturesConfig,
} from "./config";
import { installFooter } from "./footer";
import { buildSessionDurationLabel, invalidateUsageTotalsCache } from "./format";
import { emptyGitStatus, readGitStatus } from "./git";
import { LiveContextController } from "./live-context";
import { readPackageVersionResult } from "./package-version";
import {
	createProjectRefreshScheduler,
	type ScheduleProjectRefreshOptions,
	type StopProjectRefreshInterval,
	startProjectRefreshInterval,
} from "./project-refresh";
import { applyProjectRefreshToState } from "./project-state";
import { readRuntimeInfo } from "./runtime";
import { SessionLifecycle } from "./session-lifecycle";
import { registerZentuiSettingsCommand } from "./settings-command";
import { createInitialState, type FooterState, syncState } from "./state";
import { resetTelemetryState, updateTelemetryState } from "./telemetry";

function isTuiContext(ctx: ExtensionContext): boolean {
	try {
		const mode = (ctx as ExtensionContext & { mode?: string }).mode;
		return ctx.hasUI && (mode === undefined || mode === "tui");
	} catch {
		return false;
	}
}

export default function (pi: ExtensionAPI) {
	const state: FooterState = createInitialState(emptyGitStatus());
	const sessionLifecycle = new SessionLifecycle();

	let currentConfig: PolishedTuiConfig = loadConfig();
	let requestFooterRender: (() => void) | undefined;
	let getActiveExtensionStatuses: () => ReadonlyMap<string, string> = () => new Map();
	let stopRefreshInterval: StopProjectRefreshInterval = () => {};
	let footerInstalled = false;
	let stopSessionTimer: () => void = () => {};
	let activeSessionContext: ExtensionContext | undefined;
	let lastDurationLabel = "";
	let lastProjectCwd: string | undefined;

	const refresh = () => {
		if (sessionLifecycle.isCurrent()) requestFooterRender?.();
	};
	const liveContext = new LiveContextController(sessionLifecycle, refresh);
	const getCurrentConfig = () => currentConfig;
	const syncFooterState = (ctx: ExtensionContext) =>
		syncState(state, ctx, currentConfig.icons.cacheHit);

	type ProjectRefreshTarget = { cwd: string; generation: number };
	const refreshProjectState = async ({ cwd, generation }: ProjectRefreshTarget) => {
		if (!sessionLifecycle.isCurrent(generation)) return;
		const gitCommitConfig = currentConfig.gitCommit;
		const gitMetricsConfig = currentConfig.gitMetrics;
		const segments = currentConfig.footerSegments;
		const fmt = currentConfig.footerFormat;
		const formatNeedsTag = /\$\{?(?:git_tag|tag)\b/.test(fmt);
		const formatNeedsCommit = /\$\{?(?:git_commit|commit)\b/.test(fmt);
		const formatNeedsMetrics = /\$\{?(?:git_metrics|git_added|git_deleted)\b/.test(fmt);
		const formatNeedsPackage = /\$\{?(?:package|package_version)\b/.test(fmt);
		const wantExactTag =
			((segments.gitCommit || formatNeedsCommit) && gitCommitConfig.showTag) || formatNeedsTag;
		const wantMetrics = segments.gitMetrics || formatNeedsMetrics;
		const wantPackage = segments.packageVersion || formatNeedsPackage;
		const [git, runtime, packageVersion, configCounts] = await Promise.all([
			readGitStatus(cwd, {
				readExactTag: wantExactTag,
				readMetrics: wantMetrics,
				ignoreSubmodules: gitMetricsConfig.ignoreSubmodules,
			}),
			readRuntimeInfo(cwd),
			wantPackage ? readPackageVersionResult(cwd) : Promise.resolve(undefined),
			Promise.resolve(countConfigEntries(cwd)),
		]);
		if (!sessionLifecycle.isCurrent(generation)) return;
		state.configCounts = configCounts;
		lastProjectCwd = applyProjectRefreshToState(state, {
			cwd,
			previousCwd: lastProjectCwd,
			git,
			runtime,
			packageVersion,
		});
	};

	const projectRefreshScheduler = createProjectRefreshScheduler(refreshProjectState, refresh);
	const scheduleProjectRefresh = (
		ctx: ExtensionContext,
		options?: ScheduleProjectRefreshOptions,
	) => {
		const generation = sessionLifecycle.currentGeneration();
		if (!sessionLifecycle.isCurrent(generation)) return;
		projectRefreshScheduler.schedule({ cwd: ctx.cwd, generation }, options);
	};

	const refreshInteractiveState = (ctx: ExtensionContext, project = false) => {
		if (!sessionLifecycle.isCurrent() || !ctx.hasUI) return;
		syncFooterState(ctx);
		if (project && currentConfig.features.statusLine) scheduleProjectRefresh(ctx);
		refresh();
	};

	const stopProjectRefresh = () => {
		stopRefreshInterval();
		stopRefreshInterval = () => {};
		projectRefreshScheduler.stop();
	};

	const startSessionTimer = () => {
		stopSessionTimer();
		lastDurationLabel = "";
		const segments = currentConfig.footerSegments;
		const format = currentConfig.footerFormat ?? "";
		const needsWallClock = segments.time || /\$\{?time\b/.test(format);
		const needsDuration =
			segments.sessionDuration || /\$\{?(?:session_duration|duration)\b/.test(format);
		const needsActivityClock =
			segments.toolActivity ||
			segments.agentActivity ||
			/\$\{?(?:running_tools|active_agents|agents)\b/.test(format);
		if (
			!currentConfig.features.statusLine ||
			!(needsWallClock || needsDuration || needsActivityClock)
		) return;

		const timer = setInterval(() => {
			if (!sessionLifecycle.isCurrent()) return;
			if (needsWallClock || needsActivityClock) {
				refresh();
				return;
			}
			const label = state.sessionStartEpoch
				? buildSessionDurationLabel(state.sessionStartEpoch)
				: "";
			if (label === lastDurationLabel) return;
			lastDurationLabel = label;
			refresh();
		}, 1000);
		timer.unref?.();
		stopSessionTimer = () => {
			clearInterval(timer);
			stopSessionTimer = () => {};
		};
	};

	const installStatusLine = (ctx: ExtensionContext) => {
		if (footerInstalled) return;
		installFooter(ctx, state, getCurrentConfig, {
			setRequestRender: (fn) => {
				requestFooterRender = fn;
			},
			scheduleProjectRefresh,
			setExtensionStatusesGetter(fn) {
				getActiveExtensionStatuses = fn ?? (() => new Map());
			},
			getLiveContext: () => liveContext.get(),
		});
		footerInstalled = true;
		stopProjectRefresh();
		stopRefreshInterval = startProjectRefreshInterval(currentConfig.projectRefreshIntervalMs, () =>
			scheduleProjectRefresh(ctx),
		);
		scheduleProjectRefresh(ctx, { force: true });
		refresh();
		startSessionTimer();
	};

	const uninstallStatusLine = (ctx: ExtensionContext) => {
		stopSessionTimer();
		stopProjectRefresh();
		ctx.ui.setFooter(undefined);
		footerInstalled = false;
		requestFooterRender = undefined;
		getActiveExtensionStatuses = () => new Map();
	};

	const applyConfiguredUi = (ctx: ExtensionContext) => {
		if (!isTuiContext(ctx)) return;
		if (currentConfig.features.statusLine) installStatusLine(ctx);
		else if (footerInstalled) uninstallStatusLine(ctx);
	};

	const installUi = (ctx: ExtensionContext) => {
		if (!isTuiContext(ctx)) return;
		footerInstalled = false;
		ensureConfigExists();
		currentConfig = loadConfig();
		syncFooterState(ctx);
		stopProjectRefresh();
		applyConfiguredUi(ctx);
		refresh();
	};

	const cleanupUi = (ctx?: ExtensionContext) => {
		if (!ctx || !sessionLifecycle.isCurrent()) return;
		sessionLifecycle.shutdown();
		stopSessionTimer();
		stopProjectRefresh();
		requestFooterRender = undefined;
		getActiveExtensionStatuses = () => new Map();
		if (isTuiContext(ctx)) ctx.ui.setFooter(undefined);
		footerInstalled = false;
	};

	const syncInteractiveState = (_event: unknown, ctx: ExtensionContext) => {
		refreshInteractiveState(ctx);
	};
	const syncInteractiveAndProjectState = (_event: unknown, ctx: ExtensionContext) => {
		refreshInteractiveState(ctx, true);
	};

	pi.on("session_start", async (_event, ctx) => {
		sessionLifecycle.start();
		activeSessionContext = ctx;
		liveContext.clear();
		state.sessionStartEpoch = Date.now();
		state.codexUsageStatus = undefined;
		state.telemetry = resetTelemetryState(state.telemetry, {
			sessionName: ctx.sessionManager.getSessionName?.(),
			thinkingLevel: pi.getThinkingLevel(),
			modelSupportsReasoning: Boolean(ctx.model?.reasoning),
		});
		invalidateUsageTotalsCache();
		lastProjectCwd = undefined;
		installUi(ctx);
	});

	registerEffortCommand(pi);

	registerZentuiSettingsCommand(pi, {
		getConfig: getCurrentConfig,
		setColorSources(patch: Partial<ColorSourcesConfig>) {
			currentConfig = saveColorSourcesPatch(patch);
		},
		setUiFeatures(patch: Partial<UiFeaturesConfig>, ctx: ExtensionContext) {
			currentConfig = saveUiFeaturesPatch(patch);
			applyConfiguredUi(ctx);
		},
		setFooterSegments(patch: Partial<FooterSegmentsConfig>) {
			currentConfig = saveFooterSegmentsPatch(patch);
			startSessionTimer();
		},
		setFooterFormat(value: string) {
			currentConfig = saveFooterFormatPatch(value);
			startSessionTimer();
		},
		setIconMode(mode: IconMode) {
			currentConfig = saveIconsModePatch(mode);
		},
		setContextStyle(style: ContextStyle) {
			currentConfig = saveContextStylePatch(style);
		},
		setSeparator(separator: SeparatorStyle) {
			currentConfig = saveSeparatorPatch(separator);
		},
		setPathDisplay(patch: Partial<PathDisplayConfig>) {
			currentConfig = savePathDisplayPatch(patch);
		},
		setGitBranch(patch: Partial<GitBranchConfig>) {
			currentConfig = saveGitBranchPatch(patch);
		},
		getActiveExtensionStatuses() {
			return getActiveExtensionStatuses();
		},
		setExtensionStatusPlacement(key: string, placement: ExtensionStatusPlacement) {
			currentConfig = saveExtensionStatusPlacement(key, placement);
		},
		setExtensionStatusColorMode(key: string, colorMode: ExtensionStatusColorMode) {
			currentConfig = saveExtensionStatusColorMode(key, colorMode);
		},
		requestRender() {
			refresh();
		},
	});

	registerCodexUsage(pi, (ctx, value) => {
		if (ctx !== activeSessionContext || !sessionLifecycle.isCurrent()) return;
		state.codexUsageStatus = value;
		refresh();
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		liveContext.clear();
		if (activeSessionContext === ctx) activeSessionContext = undefined;
		state.codexUsageStatus = undefined;
		cleanupUi(ctx);
	});

	const syncInteractiveAndProjectStateWithUsage = (_event: unknown, ctx: ExtensionContext) => {
		invalidateUsageTotalsCache();
		refreshInteractiveState(ctx, true);
	};

	pi.on("agent_start", (event, ctx) => {
		liveContext.clear();
		state.telemetry = updateTelemetryState(state.telemetry, {
			type: "agent-start",
			at: Date.now(),
		});
		syncInteractiveState(event, ctx);
	});
	pi.on("agent_end", (event, ctx) => {
		liveContext.clear();
		state.telemetry = updateTelemetryState(state.telemetry, {
			type: "agent-end",
			at: Date.now(),
		});
		syncInteractiveAndProjectState(event, ctx);
	});
	pi.on("model_select", (event, ctx) => {
		liveContext.clear();
		state.telemetry = updateTelemetryState(state.telemetry, {
			type: "metadata",
			modelSupportsReasoning: Boolean(event.model?.reasoning),
		});
		syncInteractiveState(event, ctx);
	});
	pi.on("thinking_level_select", (event, ctx) => {
		state.telemetry = updateTelemetryState(state.telemetry, {
			type: "metadata",
			thinkingLevel: event.level,
		});
		syncInteractiveState(event, ctx);
	});
	pi.on("session_info_changed", (event, ctx) => {
		state.telemetry = updateTelemetryState(state.telemetry, {
			type: "metadata",
			sessionName: event.name,
		});
		syncInteractiveState(event, ctx);
	});
	pi.on("turn_start", (event, ctx) => {
		state.telemetry = updateTelemetryState(state.telemetry, {
			type: "turn-start",
			turnIndex: event.turnIndex,
		});
		syncInteractiveState(event, ctx);
	});
	pi.on("message_update", (event) => {
		liveContext.update(event.message);
	});
	pi.on("message_end", (event, ctx) => {
		if (
			event.message.role === "assistant" &&
			(event.message.stopReason === "error" || event.message.stopReason === "aborted")
		) {
			liveContext.clear();
		}
		syncInteractiveAndProjectStateWithUsage(event, ctx);
	});
	pi.on("tool_execution_start", (event, ctx) => {
		liveContext.clear();
		state.telemetry = updateTelemetryState(state.telemetry, {
			type: "tool-call",
			toolCallId: event.toolCallId,
			name: event.toolName,
			args:
				event.args && typeof event.args === "object"
					? (event.args as Record<string, unknown>)
					: undefined,
			at: Date.now(),
		});
		syncInteractiveState(event, ctx);
	});
	pi.on("tool_execution_end", (event, ctx) => {
		state.telemetry = updateTelemetryState(state.telemetry, {
			type: "tool-result",
			toolCallId: event.toolCallId,
			isError: event.isError,
			at: Date.now(),
		});
		syncInteractiveAndProjectState(event, ctx);
	});
	pi.on("session_compact", (event, ctx) => {
		liveContext.clear();
		syncInteractiveAndProjectStateWithUsage(event, ctx);
	});
	pi.on("session_tree", (event, ctx) => {
		liveContext.clear();
		syncInteractiveAndProjectStateWithUsage(event, ctx);
	});
}
