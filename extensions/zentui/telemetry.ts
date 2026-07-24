import { stripVTControlCharacters } from "node:util";

export const TRACKED_TOOL_NAMES = ["read", "write", "edit", "bash", "grep", "ls", "find"] as const;

export type TrackedToolName = (typeof TRACKED_TOOL_NAMES)[number];
export type ToolStatus = "running" | "completed" | "error";
export type AgentRunStatus = "running" | "completed";

export interface ToolRecord {
	toolCallId: string;
	name: string;
	target?: string;
	status: ToolStatus;
	startTime: number;
	endTime?: number;
}

export interface AgentRunRecord {
	status: AgentRunStatus;
	startTime: number;
	endTime?: number;
}

export interface TelemetryState {
	sessionName: string | undefined;
	turnIndex: number;
	thinkingLevel: string;
	modelSupportsReasoning: boolean;
	tools: readonly ToolRecord[];
	agentRuns: readonly AgentRunRecord[];
}

export interface TelemetryInitialValues {
	sessionName?: string;
	turnIndex?: number;
	thinkingLevel?: string;
	modelSupportsReasoning?: boolean;
}

export type TelemetryUpdate =
	| ({ type: "metadata" } & TelemetryInitialValues)
	| { type: "turn-start"; turnIndex?: number }
	| {
			type: "tool-call";
			toolCallId: string;
			name: string;
			args?: Record<string, unknown> | null;
			at: number;
		}
	| { type: "tool-result"; toolCallId: string; isError: boolean; at: number }
	| { type: "agent-start"; at: number }
	| { type: "agent-end"; at: number };

export interface TelemetryStats {
	completedToolCounts: Record<TrackedToolName, number>;
	recentRunningTools: readonly ToolRecord[];
	activeAgentRuns: number;
}

const trackedToolNames = new Set<string>(TRACKED_TOOL_NAMES);
const TOOL_HISTORY_LIMIT = 500;
const TOOL_HISTORY_RETAINED = 400;
const AGENT_HISTORY_LIMIT = 500;
const AGENT_HISTORY_RETAINED = 400;
const MAX_EXTERNAL_TEXT_LENGTH = 2048;
const thinkingLevels = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

function sanitizeExternalText(value: string, maxLength = 256): string {
	return stripVTControlCharacters(value.slice(0, MAX_EXTERNAL_TEXT_LENGTH))
		.replace(/[\r\n\t\f\v]+/g, " ")
		.replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
		.replace(/ +/g, " ")
		.trim()
		.slice(0, maxLength);
}

function normalizeThinkingLevel(value: string | undefined): string {
	return value && thinkingLevels.has(value) ? value : "off";
}

export function createTelemetryState(initial: TelemetryInitialValues = {}): TelemetryState {
	return {
		sessionName: initial.sessionName ? sanitizeExternalText(initial.sessionName) || undefined : undefined,
		turnIndex: initial.turnIndex ?? 0,
		thinkingLevel: normalizeThinkingLevel(initial.thinkingLevel),
		modelSupportsReasoning: initial.modelSupportsReasoning ?? false,
		tools: [],
		agentRuns: [],
	};
}

export function resetTelemetryState(
	_state: TelemetryState,
	initial: TelemetryInitialValues = {},
): TelemetryState {
	return createTelemetryState(initial);
}

export function sanitizeToolTarget(value: string): string | undefined {
	return sanitizeExternalText(value, 512) || undefined;
}

function getToolTarget(args: Record<string, unknown> | null | undefined): string | undefined {
	if (!args) return undefined;
	const value = typeof args.path === "string"
		? args.path
		: typeof args.filePath === "string"
			? args.filePath
			: undefined;
	return value === undefined ? undefined : sanitizeToolTarget(value);
}

function updateMetadata(
	state: TelemetryState,
	update: Extract<TelemetryUpdate, { type: "metadata" }>,
): TelemetryState {
	return {
		...state,
		...(Object.hasOwn(update, "sessionName")
			? {
					sessionName: update.sessionName
						? sanitizeExternalText(update.sessionName) || undefined
						: undefined,
				}
			: {}),
		...(Object.hasOwn(update, "turnIndex") ? { turnIndex: update.turnIndex ?? 0 } : {}),
		...(Object.hasOwn(update, "thinkingLevel")
			? { thinkingLevel: normalizeThinkingLevel(update.thinkingLevel) }
			: {}),
		...(Object.hasOwn(update, "modelSupportsReasoning")
			? { modelSupportsReasoning: update.modelSupportsReasoning ?? false }
			: {}),
	};
}

function addTool(
	state: TelemetryState,
	update: Extract<TelemetryUpdate, { type: "tool-call" }>,
): TelemetryState {
	const target = getToolTarget(update.args);
	const record: ToolRecord = {
		toolCallId: sanitizeExternalText(update.toolCallId, 256),
		name: sanitizeExternalText(update.name, 64) || "tool",
		...(target === undefined ? {} : { target }),
		status: "running",
		startTime: update.at,
	};
	let tools = [...state.tools, record];
	if (tools.length > TOOL_HISTORY_LIMIT) tools = tools.slice(-TOOL_HISTORY_RETAINED);
	return { ...state, tools };
}

function finishTool(
	state: TelemetryState,
	update: Extract<TelemetryUpdate, { type: "tool-result" }>,
): TelemetryState {
	const toolCallId = sanitizeExternalText(update.toolCallId, 256);
	let matchIndex = -1;
	for (let index = state.tools.length - 1; index >= 0; index -= 1) {
		const tool = state.tools[index];
		if (tool?.toolCallId === toolCallId && tool.status === "running") {
			matchIndex = index;
			break;
		}
	}
	if (matchIndex < 0) return state;

	const tools = [...state.tools];
	tools[matchIndex] = {
		...tools[matchIndex]!,
		status: update.isError ? "error" : "completed",
		endTime: update.at,
	};
	return { ...state, tools };
}

function finishLatestAgentRun(state: TelemetryState, at: number): TelemetryState {
	let matchIndex = -1;
	for (let index = state.agentRuns.length - 1; index >= 0; index -= 1) {
		if (state.agentRuns[index]?.status === "running") {
			matchIndex = index;
			break;
		}
	}
	if (matchIndex < 0) return state;

	const agentRuns = [...state.agentRuns];
	agentRuns[matchIndex] = { ...agentRuns[matchIndex]!, status: "completed", endTime: at };
	return { ...state, agentRuns };
}

export function updateTelemetryState(state: TelemetryState, update: TelemetryUpdate): TelemetryState {
	switch (update.type) {
		case "metadata":
			return updateMetadata(state, update);
		case "turn-start":
			return { ...state, turnIndex: update.turnIndex ?? state.turnIndex + 1 };
		case "tool-call":
			return addTool(state, update);
		case "tool-result":
			return finishTool(state, update);
		case "agent-start": {
			let agentRuns = [...state.agentRuns, { status: "running" as const, startTime: update.at }];
			if (agentRuns.length > AGENT_HISTORY_LIMIT) {
				agentRuns = agentRuns.slice(-AGENT_HISTORY_RETAINED);
			}
			return { ...state, agentRuns };
		}
		case "agent-end":
			return finishLatestAgentRun(state, update.at);
	}
}

export function getTelemetryStats(state: TelemetryState): TelemetryStats {
	const completedToolCounts: Record<TrackedToolName, number> = {
		read: 0,
		write: 0,
		edit: 0,
		bash: 0,
		grep: 0,
		ls: 0,
		find: 0,
	};

	for (const tool of state.tools) {
		if (tool.status === "completed" && trackedToolNames.has(tool.name)) {
			completedToolCounts[tool.name as TrackedToolName] += 1;
		}
	}

	const recentRunningTools = state.tools
		.filter((tool) => tool.status === "running")
		.slice(-2)
		.map((tool) => ({ ...tool }));
	const activeAgentRuns = state.agentRuns.reduce(
		(count, run) => count + (run.status === "running" ? 1 : 0),
		0,
	);

	return { completedToolCounts, recentRunningTools, activeAgentRuns };
}

export const createTelemetry = createTelemetryState;
export const resetTelemetry = resetTelemetryState;
export const updateTelemetry = updateTelemetryState;
