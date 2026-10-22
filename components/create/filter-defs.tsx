import { IMAGE_FILTERS, svgMatrixValues } from "@/lib/create/presets";

/** CSS filter value for a preset index (0 = Original = none). Needs <FilterDefs/> mounted once. */
export const filterCss = (idx: number) => (idx > 0 ? `url(#anaija-filter-${idx})` : undefined);

// SVG feColorMatrix with sRGB interpolation matches Flutter's ColorFilter.matrix (offsets rescaled 0..255 -> 0..1).
export function FilterDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" className="pointer-events-none absolute">
      <defs>
        {IMAGE_FILTERS.map((f, i) =>
          i === 0 ? null : (
            <filter key={f.label} id={`anaija-filter-${i}`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={svgMatrixValues(f.matrix)} />
            </filter>
          ),
        )}
      </defs>
    </svg>
  );
}
