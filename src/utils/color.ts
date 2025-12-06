/**
 * Color utility functions.
 */

/**
 * Converts HSV color to RGB hex value.
 *
 * @param h - Hue (0-1)
 * @param s - Saturation (0-1)
 * @param v - Value/Brightness (0-1)
 * @returns RGB hex color (0xRRGGBB)
 */
export function hsvToHex(h: number, s: number, v: number): number {
	let r = 0,
		g = 0,
		b = 0;

	const i = Math.floor(h * 6);
	const f = h * 6 - i;
	const p = v * (1 - s);
	const q = v * (1 - f * s);
	const t = v * (1 - (1 - f) * s);

	switch (i % 6) {
		case 0:
			r = v;
			g = t;
			b = p;
			break;
		case 1:
			r = q;
			g = v;
			b = p;
			break;
		case 2:
			r = p;
			g = v;
			b = t;
			break;
		case 3:
			r = p;
			g = q;
			b = v;
			break;
		case 4:
			r = t;
			g = p;
			b = v;
			break;
		case 5:
			r = v;
			g = p;
			b = q;
			break;
	}

	const R = Math.round(r * 255);
	const G = Math.round(g * 255);
	const B = Math.round(b * 255);

	return (R << 16) | (G << 8) | B;
}

/**
 * Converts RGB hex to HSV.
 *
 * @param hex - RGB hex color (0xRRGGBB)
 * @returns [h, s, v] tuple with values in 0-1 range
 */
export function hexToHsv(hex: number): [number, number, number] {
	const r = ((hex >> 16) & 0xff) / 255;
	const g = ((hex >> 8) & 0xff) / 255;
	const b = (hex & 0xff) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;

	let h = 0;
	const s = max === 0 ? 0 : d / max;
	const v = max;

	if (max !== min) {
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}

	return [h, s, v];
}

/**
 * Linearly interpolates between two colors.
 *
 * @param color1 - First color (0xRRGGBB)
 * @param color2 - Second color (0xRRGGBB)
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated color
 */
export function lerpColor(color1: number, color2: number, t: number): number {
	const r1 = (color1 >> 16) & 0xff;
	const g1 = (color1 >> 8) & 0xff;
	const b1 = color1 & 0xff;

	const r2 = (color2 >> 16) & 0xff;
	const g2 = (color2 >> 8) & 0xff;
	const b2 = color2 & 0xff;

	const r = Math.round(r1 + (r2 - r1) * t);
	const g = Math.round(g1 + (g2 - g1) * t);
	const b = Math.round(b1 + (b2 - b1) * t);

	return (r << 16) | (g << 8) | b;
}

/**
 * Clamps a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
	if (value <= min) return min;
	if (value >= max) return max;
	return value;
}

