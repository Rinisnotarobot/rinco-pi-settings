import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Pi builds a fresh ctx object for every extension event, so comparing a ctx by
 * identity against the one captured at `session_start` drops every later update
 * (model switches, tree navigation, async usage refreshes).
 *
 * A ctx belongs to the live session as long as it is not stale: stale contexts
 * throw on property access after a session replacement or reload.
 */
export function isLiveExtensionContext(ctx: ExtensionContext | undefined): boolean {
	if (!ctx) return false;
	try {
		void ctx.hasUI;
		return true;
	} catch {
		return false;
	}
}
