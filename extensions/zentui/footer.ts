import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { PolishedTuiConfig, SeparatorStyle } from "./config";
import { FOOTER_FORMAT_ALIASES } from "./config";
import {
	collectExtensionStatusSegments,
	sanitizeExtensionStatusText,
	type ExtensionStatusSegment,
} from "./extension-status";
import { parseFooterFormat, renderFormatSplit, stripOrphanSeparators } from "./footer-format";
import {
	buildContextDisplayLabel,
	buildSessionDurationLabel,
	contextColorTier,
	formatCount,
	formatCwdLabel,
	formatGitBranchText,
	formatGitCommitSegment,
	formatGitMetricsSegment,
	formatOsLabel,
	formatPackageVersionSegment,
	formatRuntimeSegment,
	formatTimeLabel,
	formatUsernameHostLabel,
} from "./format";
import { resolveRuntimeSymbol } from "./icons";
import type { LiveContextOverride } from "./live-context";
import { parseMcpStatus } from "./mcp-status";
import type { FooterState } from "./state";
import { renderStyleForSource } from "./style";
import { getTelemetryStats } from "./telemetry";

const separatorText: Record<SeparatorStyle, string> = {
	pipe: " | ",
	dot: " · ",
	chevron: " › ",
	none: " ",
};

function safeStatusText(value: string | null | undefined, maxLength = 256): string {
	if (!value) return "";
	return sanitizeExtensionStatusText(value.slice(0, maxLength * 4)).slice(0, maxLength);
}

function joinStatusTexts(statusTexts: string[], separator: string): string {
	return statusTexts.filter(Boolean).join(separator);
}

function fitStatusTexts(statusTexts: string[], maxWidth: number, separator: string): string {
	if (maxWidth <= 0) return "";

	const fitted: string[] = [];
	for (const text of statusTexts) {
		const candidate = joinStatusTexts([...fitted, text], separator);
		if (visibleWidth(candidate) <= maxWidth) {
			fitted.push(text);
			continue;
		}

		if (fitted.length === 0) {
			return maxWidth > 1 ? truncateToWidth(text, maxWidth, "…") : "";
		}
		break;
	}

	return joinStatusTexts(fitted, separator);
}

function appendStatusArea(base: string, statusText: string, separator: string): string {
	if (!base) return statusText;
	if (!statusText) return base;
	return `${base}${separator}${statusText}`;
}

function prependStatusArea(base: string, statusText: string, separator: string): string {
	if (!base) return statusText;
	if (!statusText) return base;
	return `${statusText}${separator}${base}`;
}

function composeBuiltInFooterContent(left: string, right: string, innerWidth: number): string {
	const leftWidth = visibleWidth(left);
	const rightWidth = visibleWidth(right);
	if (!right) return truncateToWidth(left, innerWidth, "");
	if (!left) {
		const fittedRight = truncateToWidth(right, innerWidth, "");
		return `${" ".repeat(Math.max(0, innerWidth - visibleWidth(fittedRight)))}${fittedRight}`;
	}
	if (leftWidth + 1 + rightWidth <= innerWidth) {
		return `${left}${" ".repeat(innerWidth - leftWidth - rightWidth)}${right}`;
	}

	const gap = innerWidth > 1 ? 1 : 0;
	const available = Math.max(0, innerWidth - gap);
	let rightBudget = Math.min(rightWidth, Math.max(0, Math.floor(available * 0.48)));
	let leftBudget = Math.min(leftWidth, Math.max(0, available - rightBudget));
	let remaining = Math.max(0, available - leftBudget - rightBudget);
	const leftExtra = Math.min(remaining, Math.max(0, leftWidth - leftBudget));
	leftBudget += leftExtra;
	remaining -= leftExtra;
	rightBudget += Math.min(remaining, Math.max(0, rightWidth - rightBudget));
	let fittedLeft = truncateToWidth(left, leftBudget, "");
	let fittedRight = truncateToWidth(right, rightBudget, "");
	for (let pass = 0; pass < 2; pass += 1) {
		let spare = Math.max(
			0,
			available - visibleWidth(fittedLeft) - visibleWidth(fittedRight),
		);
		if (spare === 0) break;
		if (visibleWidth(fittedLeft) < leftWidth) {
			fittedLeft = truncateToWidth(left, visibleWidth(fittedLeft) + spare, "");
			spare = Math.max(
				0,
				available - visibleWidth(fittedLeft) - visibleWidth(fittedRight),
			);
		}
		if (spare > 0 && visibleWidth(fittedRight) < rightWidth) {
			fittedRight = truncateToWidth(right, visibleWidth(fittedRight) + spare, "");
		}
	}
	const padding = Math.max(0, innerWidth - visibleWidth(fittedLeft) - visibleWidth(fittedRight));
	return `${fittedLeft}${" ".repeat(padding)}${fittedRight}`;
}

function composeFooterContent(
	builtInLeft: string,
	builtInRight: string,
	extensionLeft: string[],
	extensionMiddle: string[],
	extensionRight: string[],
	separator: string,
	innerWidth: number,
): string {
	const builtInLeftWidth = visibleWidth(builtInLeft);
	const builtInRightWidth = visibleWidth(builtInRight);
	const minimumGap = builtInLeft && builtInRight ? 1 : 0;

	if (builtInLeftWidth + minimumGap + builtInRightWidth > innerWidth) {
		return composeBuiltInFooterContent(builtInLeft, builtInRight, innerWidth);
	}

	const available = Math.max(0, innerWidth - builtInLeftWidth - builtInRightWidth - minimumGap);
	const reservedMiddle = fitStatusTexts(
		extensionMiddle,
		Math.max(0, Math.floor(available * 0.4)),
		separator,
	);
	const sideAvailable = Math.max(0, available - visibleWidth(reservedMiddle));
	let remaining = sideAvailable;
	const leftConnectorWidth = builtInLeft && extensionLeft.length > 0 ? visibleWidth(separator) : 0;
	const rightConnectorWidth =
		builtInRight && extensionRight.length > 0 ? visibleWidth(separator) : 0;
	let leftStatus = "";
	let rightStatus = "";

	if (extensionLeft.length > 0 && extensionRight.length > 0) {
		const leftBudget = Math.max(0, Math.floor(sideAvailable / 2) - leftConnectorWidth);
		leftStatus = fitStatusTexts(extensionLeft, leftBudget, separator);
		remaining -= leftStatus ? leftConnectorWidth + visibleWidth(leftStatus) : 0;

		const rightBudget = Math.max(0, remaining - rightConnectorWidth);
		rightStatus = fitStatusTexts(extensionRight, rightBudget, separator);
		remaining -= rightStatus ? rightConnectorWidth + visibleWidth(rightStatus) : 0;

		const expandedLeftBudget = Math.max(0, remaining + visibleWidth(leftStatus));
		const expandedLeftStatus = fitStatusTexts(extensionLeft, expandedLeftBudget, separator);
		if (visibleWidth(expandedLeftStatus) > visibleWidth(leftStatus)) {
			remaining += leftStatus ? leftConnectorWidth + visibleWidth(leftStatus) : 0;
			leftStatus = expandedLeftStatus;
			remaining -= leftStatus ? leftConnectorWidth + visibleWidth(leftStatus) : 0;
		}
	} else if (extensionLeft.length > 0) {
		leftStatus = fitStatusTexts(
			extensionLeft,
			Math.max(0, sideAvailable - leftConnectorWidth),
			separator,
		);
		remaining -= leftStatus ? leftConnectorWidth + visibleWidth(leftStatus) : 0;
	} else if (extensionRight.length > 0) {
		rightStatus = fitStatusTexts(
			extensionRight,
			Math.max(0, sideAvailable - rightConnectorWidth),
			separator,
		);
		remaining -= rightStatus ? rightConnectorWidth + visibleWidth(rightStatus) : 0;
	}

	const left = appendStatusArea(builtInLeft, leftStatus, separator);
	const right = prependStatusArea(builtInRight, rightStatus, separator);
	const gapWidth = Math.max(0, innerWidth - visibleWidth(left) - visibleWidth(right));
	const middle = fitStatusTexts(extensionMiddle, gapWidth, separator);
	const middleWidth = visibleWidth(middle);

	if (!middle || middleWidth <= 0) {
		return `${left}${" ".repeat(gapWidth)}${right}`;
	}

	const leftPadding = Math.floor((gapWidth - middleWidth) / 2);
	const rightPadding = gapWidth - middleWidth - leftPadding;
	return `${left}${" ".repeat(leftPadding)}${middle}${" ".repeat(rightPadding)}${right}`;
}

export function installFooter(
	ctx: ExtensionContext,
	state: FooterState,
	getConfig: () => PolishedTuiConfig,
	hooks: {
		setRequestRender: (fn: (() => void) | undefined) => void;
		scheduleProjectRefresh: (ctx: ExtensionContext) => void;
		setExtensionStatusesGetter?: (fn: (() => ReadonlyMap<string, string>) | undefined) => void;
		getLiveContext?: () => LiveContextOverride | undefined;
	},
): void {
	ctx.ui.setFooter((tui, theme, footerData) => {
		hooks.setRequestRender(() => tui.requestRender());
		hooks.setExtensionStatusesGetter?.(() => footerData.getExtensionStatuses());
		const unsubscribeBranch = footerData.onBranchChange(() => {
			hooks.scheduleProjectRefresh(ctx);
			tui.requestRender();
		});

		return {
			dispose: () => {
				unsubscribeBranch();
				hooks.setRequestRender(undefined);
				hooks.setExtensionStatusesGetter?.(undefined);
			},
			invalidate() {},
			render(width: number): string[] {
				if (width <= 0) return [""];
				const config = getConfig();
				const colorSource = config.colorSources.starship;
				const iconMode = config.icons.mode;
				const rawExtensionStatuses = footerData.getExtensionStatuses();
				const mcpStatus = parseMcpStatus(rawExtensionStatuses.get("mcp"));
				const safeCwd = safeStatusText(ctx.cwd, 1024);
				const safeRuntime = state.runtime
					? {
							...state.runtime,
							name: safeStatusText(state.runtime.name, 64),
							symbol: safeStatusText(state.runtime.symbol, 32),
							version: safeStatusText(state.runtime.version, 128) || undefined,
						}
					: undefined;
				const safePackageVersion = state.packageVersion
					? {
							ecosystem: safeStatusText(state.packageVersion.ecosystem, 64),
							version: safeStatusText(state.packageVersion.version, 160),
						}
					: undefined;
				const safeCommit = state.commit
					? {
							...state.commit,
							oid: safeStatusText(state.commit.oid, 64) || null,
							tag: safeStatusText(state.commit.tag, 160) || null,
						}
					: undefined;
				const separator = renderStyleForSource(
					theme,
					colorSource,
					config.colors.separator,
					separatorText[config.separator],
				);
				const innerWidth = Math.max(1, width - 2);
				const cwdLabel = renderStyleForSource(
					theme,
					colorSource,
					config.colors.cwd,
					formatCwdLabel(safeCwd, config.icons.cwd, {
						mode: config.pathDisplay.mode,
						depth: config.pathDisplay.depth,
					}),
				);
				const branch = safeStatusText(state.branch, 256) || undefined;
				const branchText = branch
					? formatGitBranchText(branch, config.gitBranch.maxLength)
					: undefined;
				const contextUsage = ctx.getContextUsage();
				const liveContext = hooks.getLiveContext?.();
				const contextWindow = ctx.model?.contextWindow ?? contextUsage?.contextWindow;
				const useLiveContext =
					liveContext !== undefined && contextWindow !== undefined && contextWindow > 0;
				const contextPercent = useLiveContext
					? (liveContext.tokens / contextWindow) * 100
					: contextUsage?.percent;
				const contextLabel = buildContextDisplayLabel({
					percent: contextPercent,
					contextWindow,
					style: config.contextStyle,
					asciiGauge: iconMode === "ascii",
				});
				const tier = contextColorTier(contextPercent, config.contextThresholds);
				const contextColor =
					tier === "error"
						? config.colors.contextError
						: tier === "warning"
							? config.colors.contextWarning
							: config.colors.contextNormal;
				const gitColor = (text: string) =>
					renderStyleForSource(theme, colorSource, config.colors.gitBranch, text);
				const gitStatusColor = (text: string) =>
					renderStyleForSource(theme, colorSource, config.colors.gitStatus, text);
				const gitIcon = config.icons.git ? gitColor(config.icons.git) : "";
				const gitCounts = config.footerSegments.gitCounts;
				const stashLabel =
					state.stashed > 0
						? gitCounts
							? `${config.icons.stashed}${state.stashed}`
							: config.icons.stashed
						: "";
				const allStatus = [
					state.conflicted > 0 ? config.icons.conflicted : "",
					stashLabel,
					state.deleted > 0 ? config.icons.deleted : "",
					state.renamed > 0 ? config.icons.renamed : "",
					state.modified > 0 ? config.icons.modified : "",
					state.typechanged > 0 ? config.icons.typechanged : "",
					state.staged > 0 ? config.icons.staged : "",
					state.untracked > 0 ? config.icons.untracked : "",
				].join("");
				const aheadBehind = (() => {
					if (state.ahead > 0 && state.behind > 0) {
						return gitCounts
							? `${config.icons.ahead}${state.ahead}${config.icons.behind}${state.behind}`
							: config.icons.diverged;
					}
					if (state.ahead > 0)
						return gitCounts ? `${config.icons.ahead}${state.ahead}` : config.icons.ahead;
					if (state.behind > 0)
						return gitCounts ? `${config.icons.behind}${state.behind}` : config.icons.behind;
					return "";
				})();
				const statusBlock =
					allStatus || aheadBehind ? gitStatusColor(`[${allStatus}${aheadBehind}]`) : "";
				const gitStateLabel = safeStatusText(state.gitStateLabel, 64);
				const gitStateBlock = gitStateLabel ? gitStatusColor(gitStateLabel) : "";
				const statusStyle = (style: string, text: string) =>
					text ? renderStyleForSource(theme, colorSource, style, text) : "";
				const sessionName = safeStatusText(state.telemetry.sessionName, 256);
				const sessionNameLabel = statusStyle(config.colors.gitBranch, sessionName ? `◈ ${sessionName}` : "");
				const providerId = safeStatusText(ctx.model?.provider, 128);
				const modelId = safeStatusText(ctx.model?.id, 256);
				const modelText = providerId && modelId ? `${providerId}/${modelId}` : modelId || providerId;
				const modelStatusLabel = statusStyle(config.colors.runtimePrefix, modelText ? `λ ${modelText}` : "");
				const thinkingLabel = state.telemetry.modelSupportsReasoning
					? statusStyle(
							config.colors.extensionStatus,
							`◈ ${state.telemetry.thinkingLevel === "off" ? "thinking off" : state.telemetry.thinkingLevel}`,
						)
					: "";
				const turnLabel =
					state.telemetry.turnIndex > 0
						? statusStyle(config.colors.extensionStatus, `↺×${state.telemetry.turnIndex}`)
						: "";
				const cacheReadLabel = state.usageTotals.cacheRead > 0
					? statusStyle(config.colors.tokens, `R${formatCount(state.usageTotals.cacheRead)}`)
					: "";
				const cacheWriteLabel = state.usageTotals.cacheWrite > 0
					? statusStyle(config.colors.tokens, `W${formatCount(state.usageTotals.cacheWrite)}`)
					: "";
				const cacheHitLabel = state.usageTotals.latestCacheHitRate !== undefined
					? statusStyle(config.colors.contextNormal, `CH${state.usageTotals.latestCacheHitRate.toFixed(1)}%`)
					: "";
				const cacheDetailsLabel = [cacheReadLabel, cacheWriteLabel].filter(Boolean).join(" ");
				const codexStyle = state.codexUsageStatus === "checking"
					? config.colors.contextWarning
					: state.codexUsageStatus === "usage error"
						? config.colors.contextError
						: config.colors.contextNormal;
				const codexUsageLabel = statusStyle(
					codexStyle,
					state.codexUsageStatus ? `◉ ${safeStatusText(state.codexUsageStatus, 256)}` : "",
				);
				const instructionFilesLabel = state.configCounts.instructionFiles.total > 0
					? statusStyle(config.colors.runtimePrefix, `※×${state.configCounts.instructionFiles.total}`)
					: "";
				const agentsFilesLabel = state.configCounts.instructionFiles.agentsMd > 0
					? statusStyle(config.colors.runtimePrefix, String(state.configCounts.instructionFiles.agentsMd))
					: "";
				const claudeFilesLabel = state.configCounts.instructionFiles.claudeMd > 0
					? statusStyle(config.colors.runtimePrefix, String(state.configCounts.instructionFiles.claudeMd))
					: "";
				const skillsLabel = state.configCounts.skills > 0
					? statusStyle(config.colors.extensionStatus, `★×${state.configCounts.skills}`)
					: "";
				const extensionsLabel = state.configCounts.packages > 0
					? statusStyle(config.colors.sessionDuration, `◈×${state.configCounts.packages}`)
					: "";
				const configCountsLabel = [instructionFilesLabel, skillsLabel, extensionsLabel]
					.filter(Boolean)
					.join(" ");
				const mcpLabel = mcpStatus
					? statusStyle(config.colors.gitStatus, `⊕ ${mcpStatus.connected}/${mcpStatus.total}`)
					: "";
				const telemetryStats = getTelemetryStats(state.telemetry);
				const toolCountsText = Object.entries(telemetryStats.completedToolCounts)
					.filter(([, count]) => count > 0)
					.map(([tool, count]) => `${tool}${count > 1 ? `×${count}` : ""}`)
					.join(" ");
				const toolCountsLabel = statusStyle(config.colors.contextNormal, toolCountsText);
				const runningToolsText = telemetryStats.recentRunningTools
					.map((tool) => {
						const target = tool.target ? `:${truncateToWidth(tool.target, 18, "…")}` : "";
						return `↻ ${tool.name}${target}(${buildSessionDurationLabel(tool.startTime)})`;
					})
					.join(" ");
				const runningToolsLabel = statusStyle(config.colors.contextWarning, runningToolsText);
				const activeAgentsLabel = telemetryStats.activeAgentRuns > 0
					? statusStyle(config.colors.extensionStatus, `↻ agent×${telemetryStats.activeAgentRuns}`)
					: statusStyle(config.colors.muted, "agent idle");
				const renderVariable = (name: string): string => {
					const canonical = FOOTER_FORMAT_ALIASES[name] ?? name;
					switch (canonical) {
						case "cwd":
							return cwdLabel;
						case "git_branch":
							return branchText
								? gitIcon
									? `${gitIcon} ${gitColor(branchText)}`
									: gitColor(branchText)
								: "";
						case "git_status":
							return statusBlock;
						case "git_state":
							return gitStateBlock;
						case "runtime": {
							if (!safeRuntime) return "";
							const symbol = resolveRuntimeSymbol(
								safeRuntime.name,
								safeRuntime.symbol,
								iconMode,
							);
							const label = safeRuntime.version ? `${symbol} ${safeRuntime.version}` : symbol;
							return renderStyleForSource(theme, colorSource, safeRuntime.style, label);
						}
						case "session_duration":
							return state.sessionStartEpoch
								? renderStyleForSource(
										theme,
										colorSource,
										config.colors.sessionDuration,
										buildSessionDurationLabel(state.sessionStartEpoch),
									)
								: "";
						case "username":
							return renderStyleForSource(
								theme,
								colorSource,
								config.colors.username,
								formatUsernameHostLabel(config.icons.username),
							);
						case "os":
							return renderStyleForSource(
								theme,
								colorSource,
								config.colors.os,
								formatOsLabel(config.icons.os, iconMode),
							);
						case "time":
							return renderStyleForSource(
								theme,
								colorSource,
								config.colors.time,
								formatTimeLabel(config.icons.time),
							);
						case "context":
							return renderStyleForSource(theme, colorSource, contextColor, contextLabel);
						case "tokens":
							return renderStyleForSource(
								theme,
								colorSource,
								config.colors.tokens,
								state.tokenLabel,
							);
						case "cost":
							return renderStyleForSource(theme, colorSource, config.colors.cost, state.costLabel);
						case "package":
							return formatPackageVersionSegment(
								theme,
								safePackageVersion,
								colorSource,
								iconMode,
								config.icons.package,
								config.colors.packageVersion,
							);
						case "package_version":
							return safePackageVersion?.version
								? renderStyleForSource(
										theme,
										colorSource,
										config.colors.packageVersion,
										safePackageVersion.version,
									)
								: "";
						case "sep":
							return renderStyleForSource(theme, colorSource, config.colors.separator, " | ");
						case "git_commit":
							return formatGitCommitSegment(
								theme,
								safeCommit,
								config.gitCommit,
								colorSource,
								config.colors.gitCommit,
							);
						case "git_tag":
							return config.gitCommit.showTag && safeCommit?.tag
								? renderStyleForSource(
										theme,
										colorSource,
										config.colors.gitCommit,
										safeCommit.tag,
									)
								: "";
						case "git_metrics":
							return formatGitMetricsSegment(
								theme,
								state.metrics,
								config.gitMetrics,
								colorSource,
								config.colors.gitMetricsAdded,
								config.colors.gitMetricsDeleted,
							);
						case "git_added":
							return state.metrics
								? renderStyleForSource(
										theme,
										colorSource,
										config.colors.gitMetricsAdded,
										`+${state.metrics.added}`,
									)
								: "";
						case "git_deleted":
							return state.metrics
								? renderStyleForSource(
										theme,
										colorSource,
										config.colors.gitMetricsDeleted,
										`−${state.metrics.deleted}`,
									)
								: "";
						case "session_name":
							return sessionNameLabel;
						case "model":
							return modelStatusLabel;
						case "provider":
							return statusStyle(config.colors.runtimePrefix, providerId);
						case "model_id":
							return statusStyle(config.colors.runtimePrefix, modelId);
						case "thinking":
							return thinkingLabel;
						case "turn":
							return turnLabel;
						case "cache_read":
							return cacheReadLabel;
						case "cache_write":
							return cacheWriteLabel;
						case "cache_hit":
							return cacheHitLabel;
						case "codex_usage":
							return codexUsageLabel;
						case "instruction_files":
							return instructionFilesLabel;
						case "agents_files":
							return agentsFilesLabel;
						case "claude_files":
							return claudeFilesLabel;
						case "skills":
							return skillsLabel;
						case "extensions":
							return extensionsLabel;
						case "mcp":
							return mcpLabel;
						case "tool_counts":
							return toolCountsLabel;
						case "running_tools":
							return runningToolsLabel;
						case "active_agents":
							return activeAgentsLabel;
						default:
							return "";
					}
				};
				const branchParts: string[] = [];
				if (config.footerSegments.gitBranch) {
					if (branchText) {
						branchParts.push("on", gitIcon, gitColor(branchText));
					} else if (safeCommit?.detached) {
						// `HEAD` uses git-branch style; `(hash)` uses git-commit style
						// (bold green) per Starship `git_commit` format.
						branchParts.push("on", gitIcon, gitColor("HEAD"));
						if (config.footerSegments.gitCommit && safeCommit.oid) {
							const shortHash = safeCommit.oid.slice(0, config.gitCommit.hashLength);
							const tag = config.gitCommit.showTag && safeCommit.tag ? safeCommit.tag : "";
							const inner = [shortHash, tag].filter(Boolean).join(" ");
							branchParts.push(
								renderStyleForSource(theme, colorSource, config.colors.gitCommit, `(${inner})`),
							);
						}
					}
				}
				const gitStatusParts = config.footerSegments.gitStatus && statusBlock ? [statusBlock] : [];
				const showGitState = config.footerSegments.gitBranch || config.footerSegments.gitStatus;
				const gitStateParts = showGitState && gitStateBlock ? [gitStateBlock] : [];
				const branchLabel = [...branchParts, ...gitStatusParts, ...gitStateParts]
					.filter(Boolean)
					.join(" ");
				const runtimeLabel = config.footerSegments.runtime
					? formatRuntimeSegment(
							theme,
							safeRuntime,
							config.colors.runtimePrefix,
							colorSource,
							iconMode,
						)
					: "";
				const packageVersionLabel = config.footerSegments.packageVersion
					? formatPackageVersionSegment(
							theme,
							safePackageVersion,
							colorSource,
							iconMode,
							config.icons.package,
							config.colors.packageVersion,
						)
					: "";
				// Skip standalone gitCommit when hash is already folded into the
				// branch display on detached HEAD.
				const hashFoldedIntoBranch = safeCommit?.detached && config.footerSegments.gitBranch;
				const gitCommitLabel =
					config.footerSegments.gitCommit && !hashFoldedIntoBranch
						? formatGitCommitSegment(
								theme,
								safeCommit,
								config.gitCommit,
								colorSource,
								config.colors.gitCommit,
							)
						: "";
				const gitMetricsLabel = config.footerSegments.gitMetrics
					? formatGitMetricsSegment(
							theme,
							state.metrics,
							config.gitMetrics,
							colorSource,
							config.colors.gitMetricsAdded,
							config.colors.gitMetricsDeleted,
						)
					: "";

				const sessionDurationSegment = (() => {
					if (!config.footerSegments.sessionDuration || !state.sessionStartEpoch) return "";
					const timeLabel = buildSessionDurationLabel(state.sessionStartEpoch);
					const prefix = renderStyleForSource(theme, colorSource, "", "up for");
					const time = renderStyleForSource(
						theme,
						colorSource,
						config.colors.sessionDuration,
						timeLabel,
					);
					return `${prefix} ${time}`;
				})();
				const usernameSegment = config.footerSegments.username
					? renderStyleForSource(
							theme,
							colorSource,
							config.colors.username,
							formatUsernameHostLabel(config.icons.username),
						)
					: "";
				const osSegment = config.footerSegments.os
					? renderStyleForSource(
							theme,
							colorSource,
							config.colors.os,
							formatOsLabel(config.icons.os, iconMode),
						)
					: "";
				const timeSegment = config.footerSegments.time
					? renderStyleForSource(
							theme,
							colorSource,
							config.colors.time,
							formatTimeLabel(config.icons.time),
						)
					: "";
				const upperLeft = [
					osSegment,
					usernameSegment,
					config.footerSegments.cwd ? cwdLabel : "",
					branchLabel,
					gitCommitLabel,
					gitMetricsLabel,
					packageVersionLabel,
					runtimeLabel,
					config.footerSegments.configCounts ? configCountsLabel : "",
				]
					.filter(Boolean)
					.join(" ");
				const upperRight = [
					config.footerSegments.sessionName ? sessionNameLabel : "",
					config.footerSegments.model ? modelStatusLabel : "",
					config.footerSegments.thinking ? thinkingLabel : "",
					config.footerSegments.turnCount ? turnLabel : "",
					sessionDurationSegment,
					timeSegment,
				]
					.filter(Boolean)
					.join(separator);
				const lowerLeft = [
					config.footerSegments.toolActivity ? runningToolsLabel || toolCountsLabel : "",
					config.footerSegments.agentActivity ? activeAgentsLabel : "",
				]
					.filter(Boolean)
					.join(separator);
				const lowerRight = [
					config.footerSegments.context
						? renderStyleForSource(theme, colorSource, contextColor, contextLabel)
						: "",
					config.footerSegments.tokens
						? renderStyleForSource(theme, colorSource, config.colors.tokens, state.tokenLabel)
						: "",
					config.footerSegments.cacheDetails ? cacheDetailsLabel : "",
					config.footerSegments.cost
						? renderStyleForSource(theme, colorSource, config.colors.cost, state.costLabel)
						: "",
					config.footerSegments.codexUsage ? codexUsageLabel : "",
					config.footerSegments.mcp ? mcpLabel : "",
				]
					.filter(Boolean)
					.join(separator);

				const formatNeedsMcp = /\$\{?mcp\b/.test(config.footerFormat);
				const dedicatedMcpVisible = Boolean(
					mcpStatus && (config.footerFormat ? formatNeedsMcp : config.footerSegments.mcp),
				);
				const extensionStatusSource = dedicatedMcpVisible
					? new Map([...rawExtensionStatuses].filter(([key]) => key !== "mcp"))
					: rawExtensionStatuses;
				const extensionStatuses = collectExtensionStatusSegments(extensionStatusSource, config);
				const renderExtensionStatus = (segment: ExtensionStatusSegment) =>
					segment.colorMode === "original"
						? segment.text
						: renderStyleForSource(theme, colorSource, config.colors.extensionStatus, segment.text);
				const extensionLeft = extensionStatuses.left.map(renderExtensionStatus);
				const extensionMiddle = extensionStatuses.middle.map(renderExtensionStatus);
				const extensionRight = extensionStatuses.right.map(renderExtensionStatus);
				const frame = (content: string) => {
					const framed = width > 2 ? ` ${truncateToWidth(content, width - 2, "")} ` : content;
					return truncateToWidth(framed, width, "");
				};

				if (config.footerFormat) {
					const {
						left: fmtLeft,
						middle: fmtMiddle,
						right: fmtRight,
					} = renderFormatSplit(parseFooterFormat(config.footerFormat), renderVariable);
					const templateMiddle = stripOrphanSeparators(fmtMiddle);
					const content = composeFooterContent(
						stripOrphanSeparators(fmtLeft),
						stripOrphanSeparators(fmtRight),
						extensionLeft,
						templateMiddle ? [templateMiddle, ...extensionMiddle] : extensionMiddle,
						extensionRight,
						separator,
						innerWidth,
					);
					return [frame(content)];
				}

				const upperContent = composeBuiltInFooterContent(upperLeft, upperRight, innerWidth);
				const lowerContent = composeFooterContent(
					lowerLeft,
					lowerRight,
					extensionLeft,
					extensionMiddle,
					extensionRight,
					separator,
					innerWidth,
				);
				return [frame(upperContent), frame(lowerContent)];
			},
		};
	});
}
