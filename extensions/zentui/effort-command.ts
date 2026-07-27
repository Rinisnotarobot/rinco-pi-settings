import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import {
	type EffortLevel,
	initializeEffortLevel,
	moveEffortLevel,
	THINKING_LEVELS,
} from "./effort-level.ts";
import { safeThemeFg } from "./style.ts";

const FULL_LABELS = ["OFF", "MINIMAL", "LOW", "MEDIUM", "HIGH", "XHIGH", "MAX"];
const SHORT_LABELS = ["O", "MIN", "L", "MED", "H", "XH", "MAX"];
const TINY_LABELS = ["O", "M", "L", "M", "H", "X", "M"];

function fit(text: string, width: number): string {
	const clipped = truncateToWidth(text, Math.max(0, width), "");
	return `${clipped}${" ".repeat(Math.max(0, width - visibleWidth(clipped)))}`;
}

function center(text: string, width: number): string {
	const safeWidth = Math.max(0, width);
	const clipped = truncateToWidth(text, safeWidth, "");
	const leftPadding = Math.max(0, Math.floor((safeWidth - visibleWidth(clipped)) / 2));
	return `${" ".repeat(leftPadding)}${clipped}`;
}

export function registerEffortCommand(pi: ExtensionAPI): void {
	pi.registerCommand("effort", {
		description: "Choose the model thinking effort",
		handler: async (_args, ctx) => {
			const mode = (ctx as typeof ctx & { mode?: string }).mode;
			if (!ctx.hasUI || (mode !== undefined && mode !== "tui")) return;
			if (!ctx.model) {
				ctx.ui.notify("Select a model before choosing thinking effort.", "warning");
				return;
			}
			if (!ctx.model.reasoning) {
				ctx.ui.notify("The selected model does not support reasoning.", "warning");
				return;
			}

			const initial = initializeEffortLevel(pi.getThinkingLevel());
			const selected = await ctx.ui.custom<EffortLevel | undefined>(
				(tui, theme, keybindings, done) => {
					let selectedIndex = initial.index;

					const framedLine = (content: string, width: number): string => {
						if (width <= 0) return "";
						if (width === 1) return safeThemeFg(theme, "border", "│");
						const innerWidth = width - 2;
						return `${safeThemeFg(theme, "border", "│")}${fit(content, innerWidth)}${safeThemeFg(theme, "border", "│")}`;
					};

					return {
						render(width: number) {
							const safeWidth = Math.max(0, width);
							const innerWidth = Math.max(0, safeWidth - 2);
							const useFullLabels = innerWidth >= 49;
							const useTinyLabels = innerWidth < 21;
							const labels = useFullLabels ? FULL_LABELS : useTinyLabels ? TINY_LABELS : SHORT_LABELS;
							const cellWidth = useFullLabels ? 7 : 3;
							const styleLabel = (label: string, index: number) =>
								index === selectedIndex
									? safeThemeFg(theme, "accent", theme.bold(label))
									: safeThemeFg(theme, "muted", label);
							const labelRow = useTinyLabels
								? labels.map(styleLabel).join(innerWidth >= 13 ? " " : "")
								: labels
										.map((label, index) => {
											const left = Math.floor((cellWidth - visibleWidth(label)) / 2);
											const right = Math.max(0, cellWidth - visibleWidth(label) - left);
											return `${" ".repeat(Math.max(0, left))}${styleLabel(label, index)}${" ".repeat(right)}`;
										})
										.join("");
							const connector = safeThemeFg(
								theme,
								"borderMuted",
								useTinyLabels ? (innerWidth >= 13 ? "─" : "") : "─".repeat(cellWidth - 1),
							);
							const trackRow = labels
								.map((_label, index) =>
									index === selectedIndex
										? safeThemeFg(theme, "accent", theme.bold("●"))
										: safeThemeFg(theme, "muted", "○"),
								)
								.join(connector);
							const gear = safeThemeFg(
								theme,
								"accent",
								theme.bold(`GEAR ${selectedIndex + 1} · ${FULL_LABELS[selectedIndex]}`),
							);
							const title = " Thinking Effort ";
							const topMiddle = truncateToWidth(`─${title}`, Math.max(0, safeWidth - 2), "");
							const top = safeThemeFg(
								theme,
								"border",
								safeWidth < 2
									? truncateToWidth("╭", safeWidth, "")
									: `╭${topMiddle}${"─".repeat(Math.max(0, safeWidth - 2 - visibleWidth(topMiddle)))}╮`,
							);
							const bottom = safeThemeFg(
								theme,
								"border",
								safeWidth < 2 ? truncateToWidth("╰", safeWidth, "") : `╰${"─".repeat(safeWidth - 2)}╯`,
							);
							return [
								top,
								framedLine("", safeWidth),
								framedLine(center(labelRow, innerWidth), safeWidth),
								framedLine(center(trackRow, innerWidth), safeWidth),
								framedLine(center(gear, innerWidth), safeWidth),
								framedLine(" ←/→ move · Home/End · confirm/Space · cancel", safeWidth),
								bottom,
							].map((line) => truncateToWidth(line, safeWidth, ""));
						},
						invalidate() {},
						handleInput(data: string) {
							if (keybindings.matches(data, "tui.select.cancel")) {
								done(undefined);
								return;
							}
							if (
								keybindings.matches(data, "tui.select.confirm") ||
								matchesKey(data, Key.space)
							) {
								done(THINKING_LEVELS[selectedIndex]);
								return;
							}
							let nextIndex = selectedIndex;
							if (matchesKey(data, Key.left)) nextIndex = moveEffortLevel(selectedIndex, -1).index;
							else if (matchesKey(data, Key.right)) {
								nextIndex = moveEffortLevel(selectedIndex, 1).index;
							} else if (matchesKey(data, Key.home)) nextIndex = 0;
							else if (matchesKey(data, Key.end)) nextIndex = THINKING_LEVELS.length - 1;
							if (nextIndex !== selectedIndex) {
								selectedIndex = nextIndex;
								tui.requestRender();
							}
						},
					};
				},
				{
					overlay: true,
					overlayOptions: { anchor: "center", width: 76, minWidth: 36 },
				},
			);

			if (selected === undefined) return;
			pi.setThinkingLevel(selected);
			const applied = pi.getThinkingLevel();
			ctx.ui.notify(
				applied === selected
					? `Thinking effort: ${applied}`
					: `Thinking effort requested: ${selected}; applied: ${applied}`,
				"info",
			);
		},
	});
}
