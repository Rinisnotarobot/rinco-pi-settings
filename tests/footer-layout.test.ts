import assert from "node:assert/strict";
import test from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import { composeCategorizedFooterRows } from "../extensions/zentui/footer-layout.ts";

test("default footer composes three categorized left-aligned rows", () => {
	const rows = composeCategorizedFooterRows(
		{
			project: ["⌂ 项目", "pi-sakura", "main", "Node 24"],
			session: ["λ 会话", "gpt-5.3", "★ 2/3", "⊕ 2/2", "read × 4"],
			usage: ["◉ 用量", "35%/200k", "↑ 4.2k", "↓ 1.1k", "$ 0.030"],
		},
		" · ",
		96,
	);

	assert.deepEqual(rows, [
		"⌂ 项目 · pi-sakura · main · Node 24",
		"λ 会话 · gpt-5.3 · ★ 2/3 · ⊕ 2/2 · read × 4",
		"◉ 用量 · 35%/200k · ↑ 4.2k · ↓ 1.1k · $ 0.030",
	]);
	assert.equal(rows.every((row) => !row.startsWith(" ")), true);
});

test("categorized footer truncates every row at a narrow width", () => {
	const rows = composeCategorizedFooterRows(
		{
			project: ["⌂ 项目", "long project content"],
			session: ["λ 会话", "long session content", "⊕ 2/2"],
			usage: ["◉ 用量", "long usage content"],
		},
		" · ",
		12,
	);

	assert.equal(rows.length, 3);
	for (const row of rows) {
		assert.equal(visibleWidth(row) <= 12, true);
		assert.equal(row.includes("…"), true);
	}
});
