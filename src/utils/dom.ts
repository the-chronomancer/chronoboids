/**
 * DOM utility functions with O(1) caching.
 */

/** Cache for DOM element lookups */
const elementCache = new Map<string, Element | null>();

/**
 * Selects a DOM element with caching for O(1) repeated lookups.
 *
 * @param selector - CSS selector
 * @returns The element or null if not found
 */
export function select(selector: string): Element | null {
	if (elementCache.has(selector)) {
		return elementCache.get(selector) ?? null;
	}

	const element = document.querySelector(selector);
	elementCache.set(selector, element);
	return element;
}

/**
 * Clears the element cache.
 * Call this if the DOM structure changes significantly.
 */
export function clearElementCache(): void {
	elementCache.clear();
}

/**
 * Adds a click handler to elements matching a data attribute.
 *
 * @param dataAttribute - The data attribute name (without 'data-' prefix)
 * @param handlers - Map of attribute values to handler functions
 */
export function bindClickHandlers(
	dataAttribute: string,
	handlers: Record<string, () => void>
): void {
	const elements = document.querySelectorAll(`[data-${dataAttribute}]`);

	for (const element of elements) {
		const value = element.getAttribute(`data-${dataAttribute}`);
		if (value !== null && value in handlers) {
			const handler = handlers[value];
			if (handler !== undefined) {
				element.addEventListener('click', handler);
			}
		}
	}
}

/**
 * Gets the value of an input element.
 */
export function getInputValue(selector: string): string {
	const element = select(selector) as HTMLInputElement | null;
	return element?.value ?? '';
}

/**
 * Sets the value of an input element.
 */
export function setInputValue(selector: string, value: string | number): void {
	const element = select(selector) as HTMLInputElement | null;
	if (element !== null) {
		element.value = String(value);
	}
}

/**
 * Gets the checked state of a checkbox.
 */
export function isChecked(selector: string): boolean {
	const element = select(selector) as HTMLInputElement | null;
	return element?.checked ?? false;
}

/**
 * Sets the checked state of a checkbox.
 */
export function setChecked(selector: string, checked: boolean): void {
	const element = select(selector) as HTMLInputElement | null;
	if (element !== null) {
		element.checked = checked;
	}
}

/**
 * Sets the text content of an element.
 */
export function setText(selector: string, text: string | number): void {
	const element = select(selector);
	if (element !== null) {
		element.textContent = String(text);
	}
}

/**
 * Toggles a class on an element.
 */
export function toggleClass(selector: string, className: string, force?: boolean): void {
	const element = select(selector);
	element?.classList.toggle(className, force);
}

/**
 * Adds a class to an element.
 */
export function addClass(selector: string, className: string): void {
	const element = select(selector);
	element?.classList.add(className);
}

/**
 * Removes a class from an element.
 */
export function removeClass(selector: string, className: string): void {
	const element = select(selector);
	element?.classList.remove(className);
}
