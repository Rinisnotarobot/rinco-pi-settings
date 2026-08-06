import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));

assert.equal(manifest.name, "pi-sakura-cyberdeck");
assert.equal(manifest.keywords.includes("pi-package"), true);
assert.deepEqual(manifest.pi.extensions, [
  "./extensions/header/index.ts",
  "./extensions/zentui/index.ts",
]);

for (const path of [
  ...manifest.pi.extensions,
  ...manifest.pi.themes,
  "licenses/pi-shannon-statusline-MIT.txt",
  "extensions/zentui/codex-usage/LICENSE",
]) {
  await access(resolve(root, path));
}

const removedPaths = [
  "extensions/matrix",
  "extensions/zentui/fixed-editor",
  "extensions/zentui/ui.ts",
  "extensions/zentui/gradient.ts",
  "extensions/zentui/selector-border.ts",
  "extensions/zentui/prototype-patch-registry.ts",
  "extensions/zentui/thinking-message.ts",
  "extensions/zentui/effort-command.ts",
  "extensions/zentui/effort-level.ts",
  "extensions/zentui/tool-execution.ts",
  "extensions/zentui/user-message.ts",
];
for (const path of removedPaths) {
  await assert.rejects(
    access(resolve(root, path), constants.F_OK),
    (error) => error?.code === "ENOENT",
    `removed feature must not be packaged: ${path}`,
  );
}

const zentuiEntry = await readFile(resolve(root, "extensions/zentui/index.ts"), "utf8");
for (const forbidden of ["setEditorComponent", "getEditorComponent", "fixed-editor", "PrototypePatch"]) {
  assert.equal(zentuiEntry.includes(forbidden), false, `obsolete Zentui lifecycle found: ${forbidden}`);
}

const theme = JSON.parse(await readFile(resolve(root, "themes/sakura-macaron.json"), "utf8"));
const requiredColors = [
  "accent", "border", "borderAccent", "borderMuted", "success", "error", "warning",
  "muted", "dim", "text", "thinkingText", "selectedBg", "userMessageBg",
  "userMessageText", "customMessageBg", "customMessageText", "customMessageLabel",
  "toolPendingBg", "toolSuccessBg", "toolErrorBg", "toolTitle", "toolOutput", "mdHeading",
  "mdLink", "mdLinkUrl", "mdCode", "mdCodeBlock", "mdCodeBlockBorder", "mdQuote",
  "mdQuoteBorder", "mdHr", "mdListBullet", "toolDiffAdded", "toolDiffRemoved",
  "toolDiffContext", "syntaxComment", "syntaxKeyword", "syntaxFunction", "syntaxVariable",
  "syntaxString", "syntaxNumber", "syntaxType", "syntaxOperator", "syntaxPunctuation",
  "thinkingOff", "thinkingMinimal", "thinkingLow", "thinkingMedium", "thinkingHigh",
  "thinkingXhigh", "bashMode",
];

assert.equal(theme.name, "sakura-macaron");
for (const color of requiredColors) assert.ok(color in theme.colors, `missing theme color: ${color}`);

console.log("pi-sakura-cyberdeck package check passed");
