import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	createTelemetryState,
	getTelemetryStats,
	resetTelemetryState,
	updateTelemetryState,
} from "../extensions/zentui/telemetry.ts";
import { countConfigEntries } from "../extensions/zentui/config-counts.ts";
import { parseMcpStatus } from "../extensions/zentui/mcp-status.ts";
import { __test__ as packageVersionTest } from "../extensions/zentui/package-version.ts";
import {
	formatSkillCounts,
	SkillActivityTracker,
} from "../extensions/zentui/skill-activity.ts";

test("telemetry updates metadata without mutating prior state and resets session data", () => {
	const initial = createTelemetryState();
	const updated = updateTelemetryState(initial, {
		type: "metadata",
		sessionName: "status test",
		turnIndex: 3,
		thinkingLevel: "high",
		modelSupportsReasoning: true,
	});

	assert.deepEqual(initial, {
		sessionName: undefined,
		turnIndex: 0,
		thinkingLevel: "off",
		modelSupportsReasoning: false,
		tools: [],
		agentRuns: [],
	});
	assert.equal(updated.sessionName, "status test");
	assert.equal(updated.turnIndex, 3);
	assert.equal(updated.thinkingLevel, "high");
	assert.equal(updated.modelSupportsReasoning, true);

	const reset = resetTelemetryState(updated, { sessionName: "new session", thinkingLevel: "low" });
	assert.deepEqual(reset, {
		sessionName: "new session",
		turnIndex: 0,
		thinkingLevel: "low",
		modelSupportsReasoning: false,
		tools: [],
		agentRuns: [],
	});
});

test("tool results correlate by toolCallId across concurrent tools with the same name", () => {
	let state = createTelemetryState();
	state = updateTelemetryState(state, {
		type: "tool-call",
		toolCallId: "read-1",
		name: "read",
		args: { path: "first.ts" },
		at: 10,
	});
	state = updateTelemetryState(state, {
		type: "tool-call",
		toolCallId: "read-2",
		name: "read",
		args: { path: "second.ts" },
		at: 20,
	});
	const beforeResult = state;
	state = updateTelemetryState(state, {
		type: "tool-result",
		toolCallId: "read-1",
		isError: false,
		at: 30,
	});

	assert.equal(beforeResult.tools[0]?.status, "running");
	assert.deepEqual(state.tools, [
		{
			toolCallId: "read-1",
			name: "read",
			target: "first.ts",
			status: "completed",
			startTime: 10,
			endTime: 30,
		},
		{
			toolCallId: "read-2",
			name: "read",
			target: "second.ts",
			status: "running",
			startTime: 20,
		},
	]);

	state = updateTelemetryState(state, {
		type: "tool-result",
		toolCallId: "read-2",
		isError: true,
		at: 40,
	});
	assert.equal(state.tools[1]?.status, "error");
	assert.equal(state.tools[1]?.endTime, 40);

	const unchanged = updateTelemetryState(state, {
		type: "tool-result",
		toolCallId: "missing-id",
		isError: false,
		at: 50,
	});
	assert.deepEqual(unchanged, state);
});

test("tool targets prefer path, fall back to filePath, and remove terminal/control characters", () => {
	let state = createTelemetryState();
	state = updateTelemetryState(state, {
		type: "tool-call",
		toolCallId: "edit-1",
		name: "edit",
		args: { path: " src/\u001b[31mred\u001b[0m\nfile.ts\u0000 ", filePath: "ignored.ts" },
		at: 1,
	});
	state = updateTelemetryState(state, {
		type: "tool-call",
		toolCallId: "write-1",
		name: "write",
		args: { filePath: "emoji-🌸\tname.ts" },
		at: 2,
	});
	state = updateTelemetryState(state, {
		type: "tool-call",
		toolCallId: "bash-1",
		name: "bash",
		args: { path: 42 },
		at: 3,
	});

	assert.equal(state.tools[0]?.target, "src/red file.ts");
	assert.equal(state.tools[1]?.target, "emoji-🌸 name.ts");
	assert.equal("target" in state.tools[2]!, false);
});

test("tool history trims from 501 entries to the most recent 400", () => {
	let state = createTelemetryState();
	for (let index = 1; index <= 501; index += 1) {
		state = updateTelemetryState(state, {
			type: "tool-call",
			toolCallId: `tool-${index}`,
			name: "read",
			at: index,
		});
	}

	assert.equal(state.tools.length, 400);
	assert.equal(state.tools[0]?.toolCallId, "tool-102");
	assert.equal(state.tools.at(-1)?.toolCallId, "tool-501");
});

test("telemetry summary counts only completed whitelisted tools and returns two latest running tools", () => {
	let state = createTelemetryState();
	for (const [index, name] of ["read", "custom", "bash", "grep"] .entries()) {
		state = updateTelemetryState(state, {
			type: "tool-call",
			toolCallId: `${name}-${index}`,
			name,
			at: index,
		});
	}
	state = updateTelemetryState(state, { type: "tool-result", toolCallId: "read-0", isError: false, at: 10 });
	state = updateTelemetryState(state, { type: "tool-result", toolCallId: "custom-1", isError: false, at: 11 });

	const summary = getTelemetryStats(state);
	assert.deepEqual(summary.completedToolCounts, {
		read: 1,
		write: 0,
		edit: 0,
		bash: 0,
		grep: 0,
		ls: 0,
		find: 0,
	});
	assert.deepEqual(summary.recentRunningTools.map(({ toolCallId }) => toolCallId), ["bash-2", "grep-3"]);
});

test("agent end completes the most recently started running agent", () => {
	let state = createTelemetryState();
	state = updateTelemetryState(state, { type: "agent-start", at: 10 });
	state = updateTelemetryState(state, { type: "agent-start", at: 20 });
	state = updateTelemetryState(state, { type: "agent-end", at: 30 });

	assert.deepEqual(state.agentRuns, [
		{ status: "running", startTime: 10 },
		{ status: "completed", startTime: 20, endTime: 30 },
	]);
	assert.equal(getTelemetryStats(state).activeAgentRuns, 1);

	state = updateTelemetryState(state, { type: "agent-end", at: 40 });
	assert.equal(getTelemetryStats(state).activeAgentRuns, 0);
	assert.equal(state.agentRuns[0]?.endTime, 40);
});

test("skill activity tracks distinct available and activated skills", () => {
	const cwd = "/workspace/project";
	const tracker = new SkillActivityTracker();
	tracker.syncAvailable([
		{ name: "alpha", filePath: `${cwd}/.agents/skills/alpha/SKILL.md` },
		{ name: "beta", filePath: `${cwd}/.agents/skills/beta/SKILL.md` },
		{ name: "alpha", filePath: `${cwd}/duplicate/SKILL.md` },
	], cwd);

	assert.deepEqual(tracker.counts(), { total: 2, active: 0 });
	assert.equal(tracker.activateFromRead("@.agents/skills/alpha/SKILL.md", cwd), true);
	assert.deepEqual(tracker.counts(), { total: 2, active: 1 });
	assert.equal(tracker.activateFromRead(".agents/skills/alpha/SKILL.md", cwd), false);
	assert.equal(
		tracker.activateFromPrompt(
			`<skill name="beta" location="${cwd}/.agents/skills/beta/SKILL.md">\nbody\n</skill>`,
			cwd,
		),
		true,
	);
	assert.deepEqual(tracker.counts(), { total: 2, active: 2 });
	assert.equal(formatSkillCounts(tracker.counts()!), "★ 2/2");
	assert.equal(formatSkillCounts({ total: 0, active: 0 }), "");
});

test("skill activity restores successful reads and explicit skill prompts from a session branch", () => {
	const cwd = "/workspace/project";
	const skillPath = (name: string) => `${cwd}/skills/${name}/SKILL.md`;
	const tracker = new SkillActivityTracker();
	tracker.syncAvailable(["alpha", "beta", "gamma"].map((name) => ({
		name,
		filePath: skillPath(name),
	})), cwd);

	tracker.restoreFromEntries([
		{
			type: "message",
			message: {
				role: "assistant",
				content: [
					{ type: "toolCall", id: "read-alpha", name: "read", arguments: { path: skillPath("alpha") } },
					{ type: "toolCall", id: "read-beta", name: "read", arguments: { path: skillPath("beta") } },
				],
			},
		},
		{ type: "message", message: { role: "toolResult", toolCallId: "read-alpha", toolName: "read", isError: false } },
		{ type: "message", message: { role: "toolResult", toolCallId: "read-beta", toolName: "read", isError: true } },
		{
			type: "message",
			message: {
				role: "user",
				content: [{
					type: "text",
					text: `<skill name="gamma" location="${skillPath("gamma")}">\nbody\n</skill>`,
				}],
			},
		},
	], cwd);

	assert.deepEqual(tracker.counts(), { total: 3, active: 2 });
});

test("config counts tolerate missing files and use a custom agent directory", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "zentui-counts-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const cwd = join(root, "project");
	const agentDir = join(root, "custom-agent");
	await mkdir(cwd, { recursive: true });
	await mkdir(agentDir, { recursive: true });
	await writeFile(join(cwd, "AGENTS.md"), "agents");
	await writeFile(join(cwd, "CLAUDE.md"), "claude");
	await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: ["one", "two"] }));

	assert.deepEqual(countConfigEntries(cwd, { agentDir }), {
		instructionFiles: { agentsMd: 1, claudeMd: 1, total: 2 },
		packages: 2,
	});
	assert.deepEqual(countConfigEntries(join(root, "missing-project"), { agentDir: join(root, "missing-agent") }), {
		instructionFiles: { agentsMd: 0, claudeMd: 0, total: 0 },
		packages: 0,
	});
});

test("config counts isolate corrupt settings from other counts", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "zentui-corrupt-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const cwd = join(root, "project");
	const agentDir = join(root, "agent");
	await mkdir(cwd, { recursive: true });
	await mkdir(agentDir, { recursive: true });
	await writeFile(join(cwd, "AGENTS.md"), "agents");
	await writeFile(join(agentDir, "settings.json"), "{not-json");

	assert.deepEqual(countConfigEntries(cwd, { agentDir }), {
		instructionFiles: { agentsMd: 1, claudeMd: 0, total: 1 },
		packages: 0,
	});
});

test("config counts call the agent directory provider when no explicit directory is supplied", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "zentui-provider-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(join(root, "settings.json"), JSON.stringify({ packages: ["provided"] }));
	let calls = 0;

	const result = countConfigEntries(root, {
		getAgentDir: () => {
			calls += 1;
			return root;
		},
	});
	assert.equal(calls, 1);
	assert.equal(result.packages, 1);
});

test("package versions reject terminal controls and oversized values", () => {
	assert.equal(packageVersionTest.cleanVersion("1.2.3"), "1.2.3");
	assert.equal(packageVersionTest.cleanVersion("1.2.3\u001b]52;c;evil\u0007"), undefined);
	assert.equal(packageVersionTest.cleanVersion("1".repeat(161)), undefined);
});

test("MCP status parser supports current enabled and legacy fraction formats", () => {
	assert.deepEqual(parseMcpStatus("🔌 MCP: 3 servers enabled (2 connected)"), { connected: 2, total: 3 });
	assert.deepEqual(parseMcpStatus("🔌 MCP: 3 servers enabled"), { connected: 0, total: 3 });
	assert.deepEqual(parseMcpStatus("🔌 MCP: 1 server enabled"), { connected: 0, total: 1 });
	assert.deepEqual(parseMcpStatus("🔌 MCP: 2 servers enabled (1 disabled)"), { connected: 0, total: 2 });
	assert.deepEqual(parseMcpStatus("🔌 MCP: 2 servers enabled (1 connected) (1 disabled)"), {
		connected: 1,
		total: 2,
	});
	assert.deepEqual(parseMcpStatus("\u001b[36m🔌 MCP: 12 servers enabled (4 connected)\u001b[0m"), {
		connected: 4,
		total: 12,
	});
	assert.deepEqual(parseMcpStatus("\u001b[36mMCP:\u001b[0m 2/3 servers"), { connected: 2, total: 3 });
	assert.deepEqual(parseMcpStatus("prefix MCP: 0 / 12 servers suffix"), { connected: 0, total: 12 });
});

test("MCP status parser rejects missing, malformed, or unsafe counts", () => {
	assert.equal(parseMcpStatus("MCP: unavailable"), undefined);
	assert.equal(parseMcpStatus("MCP: 2/3 clients"), undefined);
	assert.equal(parseMcpStatus("MCP: 4/3 servers"), undefined);
	assert.equal(parseMcpStatus("MCP: 2/99999 servers"), undefined);
	assert.equal(parseMcpStatus("🔌 MCP: 3 servers enabled (4 connected)"), undefined);
	assert.equal(parseMcpStatus("🔌 MCP: 10001 servers enabled (1 connected)"), undefined);
	assert.equal(parseMcpStatus("🔌 MCP: 3 servers enabled (99999 connected)"), undefined);
	assert.equal(parseMcpStatus("🔌 MCP: 3 servers enabled (100000 connected)"), undefined);
	assert.equal(parseMcpStatus(undefined), undefined);
});
