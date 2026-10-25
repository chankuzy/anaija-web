"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
  formatCompactLocation,
  formatFullLocation,
  type LocationInfo,
} from "@/lib/location/types";
import {
  NIGERIA_STATES,
  POPULAR_CAMPUSES,
  type CampusPreset,
} from "@/lib/location/nigeria-data";

export interface LocationSelectorProps {
  isOpen: boolean;
  value: LocationInfo | null;
  onClose: () => void;
  onSelect: (loc: LocationInfo | null, formattedLabel: string) => void;
}

export function LocationSelector({
  isOpen,
  value,
  onClose,
  onSelect,
}: LocationSelectorProps) {
  if (!isOpen) return null;
  return (
    <LocationDialogContent
      value={value}
      onClose={onClose}
      onSelect={onSelect}
    />
  );
}

function LocationDialogContent({
  value,
  onClose,
  onSelect,
}: {
  value: LocationInfo | null;
  onClose: () => void;
  onSelect: (loc: LocationInfo | null, formattedLabel: string) => void;
}) {
  const [tab, setTab] = useState<"general" | "campus">(() => (value?.campus ? "campus" : "general"));

  // Form state
  const [selectedState, setSelectedState] = useState<string>(value?.state ?? "");
  const [selectedCity, setSelectedCity] = useState<string>(value?.city ?? "");
  const [area, setArea] = useState<string>(value?.area ?? "");
  const [campus, setCampus] = useState<string>(value?.campus ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    value?.latitude && value?.longitude
      ? { lat: value.latitude, lng: value.longitude }
      : null,
  );
  const [gettingGps, setGettingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const stateCities = useMemo(() => {
    if (!selectedState || !NIGERIA_STATES[selectedState]) return [];
    return NIGERIA_STATES[selectedState];
  }, [selectedState]);

  // Handle campus selection
  function handleSelectCampus(c: CampusPreset) {
    setCampus(c.name);
    setSelectedState(c.state);
    setSelectedCity(c.city);
    setCoords({ lat: c.latitude, lng: c.longitude });
  }

  // Handle GPS detection
  function handleRequestGps() {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setGettingGps(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setGettingGps(false);
      },
      (err) => {
        setGettingGps(false);
        setGpsError(
          err.code === 1
            ? "Location permission denied. You can select your state & city manually."
            : "Could not retrieve GPS position. Please try manual selection.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  // Build draft location info
  const previewLocation: LocationInfo | null = useMemo(() => {
    const s = selectedState.trim();
    const c = selectedCity.trim();
    const a = area.trim();
    const camp = campus.trim();

    if (!s && !c && !camp && !a) return null;

    const draft: LocationInfo = {
      country: "NG",
      state: s || null,
      city: c || null,
      campus: camp || null,
      area: a || null,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      source: coords ? "gps" : camp ? "campus" : "manual",
      label: "",
    };
    draft.label = formatFullLocation(draft);
    return draft;
  }, [selectedState, selectedCity, area, campus, coords]);

  const previewLabel = previewLocation ? previewLocation.label : "";
  const compactLabel = previewLocation ? formatCompactLocation(previewLocation) : "";

  function handleSave() {
    if (!previewLocation) {
      onSelect(null, "");
    } else {
      onSelect(previewLocation, previewLocation.label);
    }
    onClose();
  }

  function handleClear() {
    setSelectedState("");
    setSelectedCity("");
    setArea("");
    setCampus("");
    setCoords(null);
    onSelect(null, "");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-lg rounded-[28px] bg-card-elevated border border-white/10 p-5 md:p-6 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-brand/15 text-brand">
              <Icon name="pointOnMap" className="size-5" />
            </span>
            <div>
              <h2 id="location-dialog-title" className="text-[17px] font-bold text-fg">
                Set Location
              </h2>
              <p className="text-supporting text-muted">
                Help nearby buyers discover your item
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-fg"
          >
            <Icon name="close" className="size-5" />
          </button>
        </div>

        {/* Tab switch: Campus vs State/City */}
        <div className="flex rounded-full bg-surface-subtle p-1 my-4">
          <button
            type="button"
            onClick={() => setTab("campus")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-full py-2 text-[13.5px] font-bold transition ${
              tab === "campus"
                ? "bg-brand text-brand-fg shadow-sm"
                : "text-muted hover:text-fg"
            }`}
          >
            <Icon name="mapPointSchool" className="size-4" />
            <span>Campus / School</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("general")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-full py-2 text-[13.5px] font-bold transition ${
              tab === "general"
                ? "bg-brand text-brand-fg shadow-sm"
                : "text-muted hover:text-fg"
            }`}
          >
            <Icon name="pointOnMap" className="size-4" />
            <span>City & State</span>
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {tab === "campus" ? (
            <div className="space-y-3">
              <p className="text-micro font-semibold uppercase tracking-[0.08em] text-muted">
                Popular Campuses
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {POPULAR_CAMPUSES.map((c) => {
                  const selected = campus === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => handleSelectCampus(c)}
                      className={`flex flex-col items-start p-3 rounded-2xl border text-left transition ${
                        selected
                          ? "bg-brand/15 border-brand text-fg"
                          : "bg-surface-interactive border-transparent text-muted hover:bg-surface-elevated hover:text-fg"
                      }`}
                    >
                      <span className="text-[13.5px] font-bold text-fg leading-tight">
                        {c.shortName}
                      </span>
                      <span className="text-[11.5px] truncate max-w-full text-muted mt-0.5">
                        {c.name}
                      </span>
                      <span className="text-[11px] font-medium text-brand/80 mt-1">
                        {c.city}, {c.state}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block mb-1.5 text-micro font-semibold uppercase tracking-[0.08em] text-muted">
                  Or custom campus / institution
                </label>
                <input
                  type="text"
                  value={campus}
                  onChange={(e) => setCampus(e.target.value)}
                  placeholder="e.g. Covenant University, Ota"
                  className="h-11 w-full rounded-input bg-surface-interactive px-4 text-[14px] text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-brand/60"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block mb-1.5 text-micro font-semibold uppercase tracking-[0.08em] text-muted">
                  State
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setSelectedCity("");
                  }}
                  className="h-11 w-full rounded-input bg-surface-interactive px-3 text-[14px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                >
                  <option value="">Select State</option>
                  {Object.keys(NIGERIA_STATES).map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1.5 text-micro font-semibold uppercase tracking-[0.08em] text-muted">
                  City / Town
                </label>
                {stateCities.length > 0 ? (
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="h-11 w-full rounded-input bg-surface-interactive px-3 text-[14px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                  >
                    <option value="">Select City / LGA</option>
                    {stateCities.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    placeholder="Enter city or town"
                    className="h-11 w-full rounded-input bg-surface-interactive px-4 text-[14px] text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-brand/60"
                  />
                )}
              </div>
            </div>
          )}

          {/* Area / Specific Locality */}
          <div>
            <label className="block mb-1.5 text-micro font-semibold uppercase tracking-[0.08em] text-muted">
              Area / Locality / Neighborhood (Optional)
            </label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g. Barnawa, Victoria Island, Faculty of Science"
              className="h-11 w-full rounded-input bg-surface-interactive px-4 text-[14px] text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-brand/60"
            />
          </div>

          {/* Optional GPS Location section */}
          <div className="rounded-2xl bg-surface-subtle p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
                <Icon name="pointOnMap" className="size-4 text-brand" />
                <span>Exact GPS Coordinates</span>
              </div>
              {coords ? (
                <button
                  type="button"
                  onClick={() => setCoords(null)}
                  className="text-micro font-bold text-danger hover:underline"
                >
                  Clear GPS
                </button>
              ) : (
                <button
                  type="button"
                  disabled={gettingGps}
                  onClick={handleRequestGps}
                  className="flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-micro font-extrabold text-brand hover:bg-brand/25 transition disabled:opacity-50"
                >
                  {gettingGps ? (
                    <span className="size-3 rounded-full border border-brand border-t-transparent animate-spin" />
                  ) : (
                    <Icon name="pointOnMap" className="size-3.5" />
                  )}
                  <span>{gettingGps ? "Locating…" : "Use Current GPS"}</span>
                </button>
              )}
            </div>

            {coords ? (
              <p className="text-[12px] text-brand flex items-center gap-1.5 font-medium">
                <Icon name="checkCircle" className="size-4 shrink-0" />
                <span>
                  GPS coordinates saved ({coords.lat}, {coords.lng}). Coordinates are private and only used for proximity.
                </span>
              </p>
            ) : (
              <p className="text-[11.5px] text-muted leading-relaxed">
                Optional. We never expose your exact GPS or house address. It is strictly used to match you with nearby campus students and buyers.
              </p>
            )}
            {gpsError && (
              <p className="text-[12px] text-danger font-medium">{gpsError}</p>
            )}
          </div>

          {/* Live Preview of Public Appearance */}
          {previewLocation && (
            <div className="rounded-2xl border border-brand/30 bg-brand/5 p-3">
              <p className="text-micro font-bold uppercase tracking-[0.08em] text-brand mb-1">
                How buyers will see your location
              </p>
              <div className="flex items-center gap-2 text-[14px] font-bold text-fg">
                <Icon
                  name={previewLocation.campus ? "mapPointSchool" : "pointOnMap"}
                  className="size-4 text-brand shrink-0"
                />
                <span className="truncate">{previewLabel}</span>
              </div>
              {compactLabel && compactLabel !== previewLabel && (
                <p className="text-supporting text-muted mt-0.5">
                  Feed badge: <span className="font-semibold text-fg">{compactLabel}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-4 flex gap-2 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={handleClear}
            className="h-10 px-4 rounded-full bg-surface-interactive text-secondary font-bold text-muted hover:text-danger hover:bg-danger/10 transition"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-full bg-surface-interactive px-4 text-secondary font-bold text-fg hover:bg-white/10 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="h-10 flex-1 rounded-full bg-brand px-4 text-secondary font-extrabold text-brand-fg hover:brightness-110 active:scale-95 transition"
          >
            Save Location
          </button>
        </div>
      </div>
    </div>
  );
}

/** Trigger component with badge preview to embed cleanly into forms */
export function LocationFieldTrigger({
  value,
  onClick,
  onClear,
}: {
  value: LocationInfo | null;
  onClick: () => void;
  onClear: () => void;
}) {
  if (!value) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex h-12 w-full items-center justify-between rounded-input bg-surface-interactive px-4 text-[14.5px] font-medium text-muted hover:bg-surface-elevated hover:text-fg transition"
      >
        <span className="flex items-center gap-2">
          <Icon name="pointOnMap" className="size-4 text-muted" />
          <span>Add pickup / location (Campus, City, State)</span>
        </span>
        <Icon name="chevronRight" className="size-4 text-muted" />
      </button>
    );
  }

  const isCampus = !!value.campus;

  return (
    <div className="flex items-center justify-between gap-2 rounded-input bg-surface-interactive p-2 px-3 text-[14px]">
      <div
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2.5 cursor-pointer hover:opacity-90"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
          <Icon name={isCampus ? "mapPointSchool" : "pointOnMap"} className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold text-fg leading-tight">
            {value.label}
          </p>
          <p className="text-micro text-muted">
            {isCampus ? "Campus preset" : "City & State"}
            {value.latitude && " • GPS attached"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onClick}
          className="rounded-full px-2.5 py-1 text-micro font-bold text-brand hover:bg-brand/10"
        >
          Change
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Remove location"
          className="grid size-7 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-danger"
        >
          <Icon name="close" className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
