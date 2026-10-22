// Port of image_edit_presets.dart. Same matrices, same ratios, so a photo looks identical on both clients.

export interface FilterPreset {
  label: string;
  /** 4x5 row-major, Flutter units: offsets are 0..255. */
  matrix: readonly number[];
}

export const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0] as const;

export const IMAGE_FILTERS: readonly FilterPreset[] = [
  { label: "Original", matrix: IDENTITY_MATRIX },
  { label: "Vivid", matrix: [1.3, 0, 0, 0, -20, 0, 1.3, 0, 0, -20, 0, 0, 1.3, 0, -20, 0, 0, 0, 1, 0] },
  { label: "Warm", matrix: [1.15, 0, 0.05, 0, 10, 0.02, 1.05, 0, 0, 5, 0, 0, 0.9, 0, -5, 0, 0, 0, 1, 0] },
  { label: "Moody", matrix: [0.85, 0, 0, 0, -10, 0, 0.85, 0, 0, -10, 0, 0, 0.95, 0, 0, 0, 0, 0, 1, 0] },
  { label: "Soft", matrix: [0.95, 0.05, 0, 0, 15, 0.03, 0.95, 0.02, 0, 12, 0, 0.02, 0.93, 0, 10, 0, 0, 0, 1, 0] },
  { label: "B&W", matrix: [0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0, 0, 0, 1, 0] },
];

/** Sentinel: lock the crop box to the photo's own aspect ratio. */
export const RATIO_ORIGINAL = -1;

/** Crop shortcuts. ratio null = free. */
export const EDITOR_CROP_RATIOS: readonly { label: string; ratio: number | null }[] = [
  { label: "Free", ratio: null },
  { label: "Original", ratio: RATIO_ORIGINAL },
  { label: "9:16", ratio: 9 / 16 },
  { label: "4:5", ratio: 4 / 5 },
  { label: "1:1", ratio: 1 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "3:4", ratio: 3 / 4 },
];

export const isIdentity = (m: readonly number[]) => m.every((v, i) => v === IDENTITY_MATRIX[i]);

/** Values for an SVG <feColorMatrix>: SVG offsets are 0..1, Flutter's are 0..255. Use colorInterpolationFilters="sRGB". */
export const svgMatrixValues = (m: readonly number[]) =>
  m.map((v, i) => (i % 5 === 4 ? v / 255 : v)).join(" ");

/** In-place, on un-premultiplied RGBA (ImageData), same math as Skia's matrix filter. */
export function applyColorMatrix(img: ImageData, m: readonly number[]) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
    d[i] = m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4];
    d[i + 1] = m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9];
    d[i + 2] = m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14];
    d[i + 3] = m[15] * r + m[16] * g + m[17] * b + m[18] * a + m[19];
  }
}
