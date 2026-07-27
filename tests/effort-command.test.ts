import assert from "node:assert/strict";
import test from "node:test";

import { visibleWidth } from "@earendil-works/pi-tui";
import { registerEffortCommand } from "../extensions/zentui/effort-command.ts";
import type { EffortLevel } from "../extensions/zentui/effort-level.ts";

type Command = {
	description?: string;
	handler: (args: string, ctx: MockContext) => Promise<void>;
};

type DialogComponent = {
	render(width: number): string[];
	handleInput(data: string): void;
	invalidate(): void;
};

type DialogFactory = (
	tui: { requestRender(): void },
	theme: MockTheme,
	keybindings: { matches(data: string, binding: string): boolean },
	done: (value: EffortLevel | undefined) => void,
) => DialogComponent;

type MockTheme = {
	fg(_color: string, text: string): string;
	bold(text: string): string;
};

type MockContext = {
	hasUI: boolean;
	mode?: string;
	model?: { reasoning?: boolean };
	ui: {
		notify(message: string, level: string): void;
		custom<T>(factory: DialogFactory, options: unknown): Promise<T>;
	};
};

function setup(current: EffortLevel = "medium") {
	let command: Command | undefined;
	const applied: EffortLevel[] = [];
	const notifications: Array<[string, string]> = [];
	let actual = current;
	const pi = {
		registerCommand(name: string, value: Command) {
			assert.equal(name, "effort");
			command = value;
		},
		getThinkingLevel: () => actual,
		setThinkingLevel(level: EffortLevel) {
			applied.push(level);
			actual = level;
		},
	};
	registerEffortCommand(pi as never);

	const ctx: MockContext = {
		hasUI: true,
		mode: "tui",
		model: { reasoning: true },
		ui: {
			notify(message, level) {
				notifications.push([message, level]);
			},
			async custom() {
				throw new Error("custom dialog behavior was not configured");
			},
		},
	};

	return {
		get command() {
			assert.ok(command);
			return command;
		},
		ctx,
		applied,
		notifications,
		setActual(level: EffortLevel) {
			actual = level;
		},
	};
}

const theme: MockTheme = {
	fg: (_color, text) => text,
	bold: (text) => text,
};

function installDialog(
	ctx: MockContext,
	action: (component: DialogComponent) => void,
	onCreated?: (component: DialogComponent, options: unknown) => void,
): { renders: () => number } {
	let renderRequests = 0;
	ctx.ui.custom = async function custom<T>(factory: DialogFactory, options: unknown): Promise<T> {
		let result: EffortLevel | undefined;
		const component = factory(
			{ requestRender: () => renderRequests++ },
			theme,
			{
				matches(data, binding) {
					return (
						(binding === "tui.select.confirm" && data === "custom-confirm") ||
						(binding === "tui.select.cancel" && data === "custom-cancel")
					);
				},
			},
			(value) => {
				result = value;
			},
		);
		onCreated?.(component, options);
		action(component);
		return result as T;
	};
	return { renders: () => renderRequests };
}

test("registers /effort and skips unsupported models", async () => {
	const state = setup();
	assert.equal(state.command.description, "Choose the model thinking effort");
	state.ctx.model = { reasoning: false };

	await state.command.handler("", state.ctx);

	assert.deepEqual(state.applied, []);
	assert.deepEqual(state.notifications, [["The selected model does not support reasoning.", "warning"]]);
});

test("moves right and applies with the configured confirm binding", async () => {
	const state = setup("medium");
	const dialog = installDialog(state.ctx, (component) => {
		component.handleInput("\u001b[C");
		component.handleInput("custom-confirm");
	}, (_component, options) => {
		assert.deepEqual(options, {
			overlay: true,
			overlayOptions: { anchor: "center", width: 76, minWidth: 36 },
		});
	});

	await state.command.handler("", state.ctx);

	assert.deepEqual(state.applied, ["high"]);
	assert.equal(dialog.renders(), 1);
	assert.deepEqual(state.notifications, [["Thinking effort: high", "info"]]);
});

test("cancel leaves the thinking level unchanged", async () => {
	const state = setup("medium");
	installDialog(state.ctx, (component) => {
		component.handleInput("\u001b[F");
		component.handleInput("custom-cancel");
	});

	await state.command.handler("", state.ctx);

	assert.deepEqual(state.applied, []);
	assert.deepEqual(state.notifications, []);
});

test("Home, End, and Space select boundary levels", async () => {
	const high = setup("high");
	installDialog(high.ctx, (component) => {
		component.handleInput("\u001b[H");
		component.handleInput(" ");
	});
	await high.command.handler("", high.ctx);
	assert.deepEqual(high.applied, ["off"]);

	const low = setup("low");
	installDialog(low.ctx, (component) => {
		component.handleInput("\u001b[F");
		component.handleInput(" ");
	});
	await low.command.handler("", low.ctx);
	assert.deepEqual(low.applied, ["max"]);
});

function assertFramedContentIsCentered(line: string, description: string): void {
	const inner = line.slice(1, -1);
	const content = inner.trim();
	const left = inner.indexOf(content);
	const right = visibleWidth(inner) - left - visibleWidth(content);
	assert.ok(Math.abs(left - right) <= 1, `${description} is not centered: ${left} left, ${right} right`);
}

test("renders a centered horizontal gear selector and updates its indicator", async () => {
	const state = setup("medium");
	installDialog(
		state.ctx,
		(component) => component.handleInput("custom-cancel"),
		(component) => {
			const initial = component.render(76);
			assert.match(initial[2], /OFF.*MINIMAL.*LOW.*MEDIUM.*HIGH.*XHIGH.*MAX/);
			assert.match(initial[3], /○─+○─+○─+●─+○─+○─+○/);
			assert.match(initial[4], /GEAR 4 · MEDIUM/);
			assertFramedContentIsCentered(initial[2], "labels");
			assertFramedContentIsCentered(initial[3], "track");
			assertFramedContentIsCentered(initial[4], "gear indicator");

			component.handleInput("\u001b[C");
			const moved = component.render(76);
			assert.match(moved[3], /○─+○─+○─+○─+●─+○─+○/);
			assert.match(moved[4], /GEAR 5 · HIGH/);
		},
	);

	await state.command.handler("", state.ctx);
});

test("dialog preserves all seven gears at very narrow usable widths", async () => {
	const state = setup();
	installDialog(
		state.ctx,
		(component) => component.handleInput("custom-cancel"),
		(component) => {
			const lines = component.render(20);
			assert.equal(lines[2].slice(1, -1).trim(), "O M L M H X M");
			assert.equal((lines[3].match(/[○●]/g) ?? []).length, 7);
			assertFramedContentIsCentered(lines[2], "tiny labels");
			assertFramedContentIsCentered(lines[3], "tiny track");
		},
	);

	await state.command.handler("", state.ctx);
});

test("dialog render stays within narrow and wide widths", async () => {
	const state = setup();
	installDialog(
		state.ctx,
		(component) => component.handleInput("custom-cancel"),
		(component) => {
			for (const width of [1, 2, 8, 20, 36, 76]) {
				const lines = component.render(width);
				assert.equal(lines.length, 7);
				for (const line of lines) {
					assert.ok(visibleWidth(line) <= width, `line width ${visibleWidth(line)} exceeds ${width}`);
				}
			}
		},
	);

	await state.command.handler("", state.ctx);
});
