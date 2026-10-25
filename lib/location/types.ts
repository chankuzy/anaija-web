export type LocationSource = "manual" | "campus" | "gps";

export interface LocationInfo {
  country?: string; // Default "NG"
  state?: string | null; // e.g. "Kaduna", "Lagos"
  city?: string | null; // e.g. "Kaduna", "Ikeja"
  campus?: string | null; // e.g. "Air Force Institute of Technology (AFIT)"
  institution_id?: number | null;
  area?: string | null; // e.g. "Main Campus", "Barnawa", "Victoria Island"
  label: string; // Public display string e.g. "AFIT Campus, Kaduna"
  latitude?: number | null;
  longitude?: number | null;
  source?: LocationSource;
}

/** Returns the compact location label suitable for feed cards, preview badges, or pills. */
export function formatCompactLocation(loc: LocationInfo | null | undefined): string {
  if (!loc) return "";
  if (loc.campus) {
    // Shorten campus if it has short_name or format nicely
    return loc.campus.length > 24 ? loc.city ?? loc.state ?? loc.campus : loc.campus;
  }
  if (loc.area && loc.city) {
    return `${loc.area}, ${loc.city}`;
  }
  if (loc.city && loc.state) {
    return loc.city === loc.state ? loc.city : `${loc.city}, ${loc.state}`;
  }
  return loc.label || loc.city || loc.state || "";
}

/** Formats the complete location string for the listing detail page. */
export function formatFullLocation(loc: LocationInfo | null | undefined): string {
  if (!loc) return "";
  const parts: string[] = [];
  if (loc.campus) parts.push(loc.campus);
  if (loc.area && loc.area !== loc.campus) parts.push(loc.area);
  if (loc.city && !parts.includes(loc.city)) parts.push(loc.city);
  if (loc.state && !parts.includes(loc.state)) parts.push(loc.state);
  return parts.length > 0 ? parts.join(", ") : loc.label;
}

/** Strips exact GPS coordinates for public consumption to respect seller privacy. */
export function sanitizeLocationForPublic(loc: LocationInfo | null | undefined): LocationInfo | null {
  if (!loc) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { latitude, longitude, ...rest } = loc;
  return rest;
}
