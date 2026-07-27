export const THINKING_LEVELS = [
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
] as const;

export type EffortLevel = (typeof THINKING_LEVELS)[number];

export type EffortSelection = {
	index: number;
	level: EffortLevel;
};

export function initializeEffortLevel(current: unknown): EffortSelection {
	const index = THINKING_LEVELS.findIndex((level) => level === current);
	const safeIndex = index < 0 ? 0 : index;
	return { index: safeIndex, level: THINKING_LEVELS[safeIndex] };
}

export function moveEffortLevel(index: number, direction: -1 | 1): EffortSelection {
	const safeIndex = Number.isInteger(index) ? index : 0;
	const nextIndex = Math.min(
		THINKING_LEVELS.length - 1,
		Math.max(0, safeIndex + direction),
	);
	return { index: nextIndex, level: THINKING_LEVELS[nextIndex] };
}
