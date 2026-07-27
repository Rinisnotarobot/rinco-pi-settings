import assert from "node:assert/strict";
import test from "node:test";

import {
	THINKING_LEVELS,
	initializeEffortLevel,
	moveEffortLevel,
} from "../extensions/zentui/effort-level.ts";

test("thinking effort levels use Pi's required order", () => {
	assert.deepEqual(THINKING_LEVELS, [
		"off",
		"minimal",
		"low",
		"medium",
		"high",
		"xhigh",
		"max",
	]);
});

test("initializes and moves between middle effort levels", () => {
	assert.deepEqual(initializeEffortLevel("medium"), { index: 3, level: "medium" });
	assert.deepEqual(moveEffortLevel(3, -1), { index: 2, level: "low" });
	assert.deepEqual(moveEffortLevel(3, 1), { index: 4, level: "high" });
});

test("movement clamps at off and max without wrapping", () => {
	assert.deepEqual(moveEffortLevel(0, -1), { index: 0, level: "off" });
	assert.deepEqual(moveEffortLevel(THINKING_LEVELS.length - 1, 1), {
		index: 6,
		level: "max",
	});
});

test("invalid initial values fall back to off", () => {
	for (const value of [undefined, null, "", "turbo", 3]) {
		assert.deepEqual(initializeEffortLevel(value), { index: 0, level: "off" });
	}
});
