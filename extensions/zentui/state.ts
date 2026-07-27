import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ConfigCounts } from "./config-counts";
import {
	buildContextLabel,
	buildCostLabel,
	buildTokenLabel,
	formatProviderLabel,
	getUsageTotals,
	type UsageTotals,
} from "./format";
import type { GitStatusSummary } from "./git";
import type { PackageVersionResult } from "./package-version";
import type { RuntimeInfo } from "./runtime";
import type { SkillCounts } from "./skill-activity";
import { createTelemetryState, type TelemetryState } from "./telemetry";

export type FooterState = GitStatusSummary & {
	modelLabel: string;
	providerLabel: string;
	contextLabel: string;
	tokenLabel: string;
	costLabel: string;
	usageTotals: UsageTotals;
	telemetry: TelemetryState;
	configCounts: ConfigCounts;
	skillCounts?: SkillCounts;
	codexUsageStatus?: string;
	runtime?: RuntimeInfo;
	packageVersion?: PackageVersionResult;
	sessionStartEpoch?: number;
};

export function createInitialState(gitDefaults: GitStatusSummary): FooterState {
	return {
		modelLabel: "no-model",
		providerLabel: "Unknown",
		contextLabel: "--",
		tokenLabel: "↑ 0 ↓ 0",
		costLabel: "$ 0.000",
		usageTotals: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
		telemetry: createTelemetryState(),
		configCounts: {
			instructionFiles: { agentsMd: 0, claudeMd: 0, total: 0 },
			packages: 0,
		},
		skillCounts: undefined,
		codexUsageStatus: undefined,
		runtime: undefined,
		packageVersion: undefined,
		sessionStartEpoch: Date.now(),
		...gitDefaults,
	};
}

export function syncState(state: FooterState, ctx: ExtensionContext, cacheHitIcon: string): void {
	const totals = getUsageTotals(ctx);
	state.modelLabel = ctx.model?.id ?? "no-model";
	state.providerLabel = formatProviderLabel(ctx.model?.provider);
	state.usageTotals = totals;
	state.telemetry = {
		...state.telemetry,
		modelSupportsReasoning: Boolean(ctx.model?.reasoning),
	};
	state.contextLabel = buildContextLabel(ctx);
	state.tokenLabel = buildTokenLabel(totals, cacheHitIcon);
	state.costLabel = buildCostLabel(totals);
}
