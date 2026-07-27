import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export type CategorizedFooterRows = {
	project: string[];
	session: string[];
	usage: string[];
};

function joinStatusTexts(statusTexts: string[], separator: string): string {
	return statusTexts.filter(Boolean).join(separator);
}

function fitStatusTexts(statusTexts: string[], maxWidth: number, separator: string): string {
	if (maxWidth <= 0) return "";

	const fitted: string[] = [];
	for (const text of statusTexts) {
		const candidate = joinStatusTexts([...fitted, text], separator);
		if (visibleWidth(candidate) <= maxWidth) {
			fitted.push(text);
			continue;
		}

		if (fitted.length === 0) {
			return maxWidth > 1 ? truncateToWidth(text, maxWidth, "…") : "";
		}
		break;
	}

	return joinStatusTexts(fitted, separator);
}

function appendStatusArea(base: string, statusText: string, separator: string): string {
	if (!base) return statusText;
	if (!statusText) return base;
	return `${base}${separator}${statusText}`;
}

function prependStatusArea(base: string, statusText: string, separator: string): string {
	if (!base) return statusText;
	if (!statusText) return base;
	return `${statusText}${separator}${base}`;
}

export function composeBuiltInFooterContent(left: string, right: string, innerWidth: number): string {
	const leftWidth = visibleWidth(left);
	const rightWidth = visibleWidth(right);
	if (!right) return truncateToWidth(left, innerWidth, "");
	if (!left) {
		const fittedRight = truncateToWidth(right, innerWidth, "");
		return `${" ".repeat(Math.max(0, innerWidth - visibleWidth(fittedRight)))}${fittedRight}`;
	}
	if (leftWidth + 1 + rightWidth <= innerWidth) {
		return `${left}${" ".repeat(innerWidth - leftWidth - rightWidth)}${right}`;
	}

	const gap = innerWidth > 1 ? 1 : 0;
	const available = Math.max(0, innerWidth - gap);
	let rightBudget = Math.min(rightWidth, Math.max(0, Math.floor(available * 0.48)));
	let leftBudget = Math.min(leftWidth, Math.max(0, available - rightBudget));
	let remaining = Math.max(0, available - leftBudget - rightBudget);
	const leftExtra = Math.min(remaining, Math.max(0, leftWidth - leftBudget));
	leftBudget += leftExtra;
	remaining -= leftExtra;
	rightBudget += Math.min(remaining, Math.max(0, rightWidth - rightBudget));
	let fittedLeft = truncateToWidth(left, leftBudget, "");
	let fittedRight = truncateToWidth(right, rightBudget, "");
	for (let pass = 0; pass < 2; pass += 1) {
		let spare = Math.max(
			0,
			available - visibleWidth(fittedLeft) - visibleWidth(fittedRight),
		);
		if (spare === 0) break;
		if (visibleWidth(fittedLeft) < leftWidth) {
			fittedLeft = truncateToWidth(left, visibleWidth(fittedLeft) + spare, "");
			spare = Math.max(
				0,
				available - visibleWidth(fittedLeft) - visibleWidth(fittedRight),
			);
		}
		if (spare > 0 && visibleWidth(fittedRight) < rightWidth) {
			fittedRight = truncateToWidth(right, visibleWidth(fittedRight) + spare, "");
		}
	}
	const padding = Math.max(0, innerWidth - visibleWidth(fittedLeft) - visibleWidth(fittedRight));
	return `${fittedLeft}${" ".repeat(padding)}${fittedRight}`;
}

export function composeFooterContent(
	builtInLeft: string,
	builtInRight: string,
	extensionLeft: string[],
	extensionMiddle: string[],
	extensionRight: string[],
	separator: string,
	innerWidth: number,
): string {
	const builtInLeftWidth = visibleWidth(builtInLeft);
	const builtInRightWidth = visibleWidth(builtInRight);
	const minimumGap = builtInLeft && builtInRight ? 1 : 0;

	if (builtInLeftWidth + minimumGap + builtInRightWidth > innerWidth) {
		return composeBuiltInFooterContent(builtInLeft, builtInRight, innerWidth);
	}

	const available = Math.max(0, innerWidth - builtInLeftWidth - builtInRightWidth - minimumGap);
	const reservedMiddle = fitStatusTexts(
		extensionMiddle,
		Math.max(0, Math.floor(available * 0.4)),
		separator,
	);
	const sideAvailable = Math.max(0, available - visibleWidth(reservedMiddle));
	let remaining = sideAvailable;
	const leftConnectorWidth = builtInLeft && extensionLeft.length > 0 ? visibleWidth(separator) : 0;
	const rightConnectorWidth =
		builtInRight && extensionRight.length > 0 ? visibleWidth(separator) : 0;
	let leftStatus = "";
	let rightStatus = "";

	if (extensionLeft.length > 0 && extensionRight.length > 0) {
		const leftBudget = Math.max(0, Math.floor(sideAvailable / 2) - leftConnectorWidth);
		leftStatus = fitStatusTexts(extensionLeft, leftBudget, separator);
		remaining -= leftStatus ? leftConnectorWidth + visibleWidth(leftStatus) : 0;

		const rightBudget = Math.max(0, remaining - rightConnectorWidth);
		rightStatus = fitStatusTexts(extensionRight, rightBudget, separator);
		remaining -= rightStatus ? rightConnectorWidth + visibleWidth(rightStatus) : 0;

		const expandedLeftBudget = Math.max(0, remaining + visibleWidth(leftStatus));
		const expandedLeftStatus = fitStatusTexts(extensionLeft, expandedLeftBudget, separator);
		if (visibleWidth(expandedLeftStatus) > visibleWidth(leftStatus)) {
			remaining += leftStatus ? leftConnectorWidth + visibleWidth(leftStatus) : 0;
			leftStatus = expandedLeftStatus;
			remaining -= leftStatus ? leftConnectorWidth + visibleWidth(leftStatus) : 0;
		}
	} else if (extensionLeft.length > 0) {
		leftStatus = fitStatusTexts(
			extensionLeft,
			Math.max(0, sideAvailable - leftConnectorWidth),
			separator,
		);
		remaining -= leftStatus ? leftConnectorWidth + visibleWidth(leftStatus) : 0;
	} else if (extensionRight.length > 0) {
		rightStatus = fitStatusTexts(
			extensionRight,
			Math.max(0, sideAvailable - rightConnectorWidth),
			separator,
		);
		remaining -= rightStatus ? rightConnectorWidth + visibleWidth(rightStatus) : 0;
	}

	const left = appendStatusArea(builtInLeft, leftStatus, separator);
	const right = prependStatusArea(builtInRight, rightStatus, separator);
	const gapWidth = Math.max(0, innerWidth - visibleWidth(left) - visibleWidth(right));
	const middle = fitStatusTexts(extensionMiddle, gapWidth, separator);
	const middleWidth = visibleWidth(middle);

	if (!middle || middleWidth <= 0) {
		return `${left}${" ".repeat(gapWidth)}${right}`;
	}

	const leftPadding = Math.floor((gapWidth - middleWidth) / 2);
	const rightPadding = gapWidth - middleWidth - leftPadding;
	return `${left}${" ".repeat(leftPadding)}${middle}${" ".repeat(rightPadding)}${right}`;
}

function composeLeftAlignedRow(parts: string[], separator: string, innerWidth: number): string {
	const content = joinStatusTexts(parts, separator);
	if (innerWidth <= 1) return truncateToWidth(content, Math.max(0, innerWidth), "");
	return truncateToWidth(content, innerWidth, "…");
}

export function composeCategorizedFooterRows(
	rows: CategorizedFooterRows,
	separator: string,
	innerWidth: number,
): [string, string, string] {
	return [
		composeLeftAlignedRow(rows.project, separator, innerWidth),
		composeLeftAlignedRow(rows.session, separator, innerWidth),
		composeLeftAlignedRow(rows.usage, separator, innerWidth),
	];
}
