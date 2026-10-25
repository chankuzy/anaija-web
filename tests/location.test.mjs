import test from "node:test";
import assert from "node:assert/strict";

// Mirroring the pure functions from lib/location/types.ts
function formatCompactLocation(loc) {
  if (!loc) return "";
  if (loc.campus) {
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

function formatFullLocation(loc) {
  if (!loc) return "";
  const parts = [];
  if (loc.campus) parts.push(loc.campus);
  if (loc.area && loc.area !== loc.campus) parts.push(loc.area);
  if (loc.city && !parts.includes(loc.city)) parts.push(loc.city);
  if (loc.state && !parts.includes(loc.state)) parts.push(loc.state);
  return parts.length > 0 ? parts.join(", ") : loc.label;
}

function sanitizeLocationForPublic(loc) {
  if (!loc) return null;
  const rest = { ...loc };
  delete rest.latitude;
  delete rest.longitude;
  return rest;
}

test("formatCompactLocation - Campus preset", () => {
  const shortCampus = {
    campus: "AFIT Campus",
    city: "Kaduna",
    state: "Kaduna",
    label: "AFIT Campus, Kaduna",
  };
  assert.equal(formatCompactLocation(shortCampus), "AFIT Campus");

  const longCampus = {
    campus: "Air Force Institute of Technology",
    city: "Kaduna",
    state: "Kaduna",
    label: "Air Force Institute of Technology, Kaduna",
  };
  // Longer than 24 chars uses city or state
  assert.equal(formatCompactLocation(longCampus), "Kaduna");
});

test("formatCompactLocation - Area and City", () => {
  const loc = {
    area: "Barnawa",
    city: "Kaduna",
    state: "Kaduna",
    label: "Barnawa, Kaduna",
  };
  assert.equal(formatCompactLocation(loc), "Barnawa, Kaduna");
});

test("formatCompactLocation - City and State (dedup if identical)", () => {
  const diff = {
    city: "Ikeja",
    state: "Lagos",
    label: "Ikeja, Lagos",
  };
  assert.equal(formatCompactLocation(diff), "Ikeja, Lagos");

  const same = {
    city: "Kaduna",
    state: "Kaduna",
    label: "Kaduna",
  };
  assert.equal(formatCompactLocation(same), "Kaduna");
});

test("formatFullLocation - Concatenates hierarchy without duplicate parts", () => {
  const full = {
    campus: "University of Lagos",
    area: "Akoka",
    city: "Lagos",
    state: "Lagos",
  };
  assert.equal(formatFullLocation(full), "University of Lagos, Akoka, Lagos");

  const simple = {
    area: "Maitama",
    city: "Abuja",
    state: "FCT",
  };
  assert.equal(formatFullLocation(simple), "Maitama, Abuja, FCT");
});

test("sanitizeLocationForPublic - Strips latitude and longitude for privacy", () => {
  const privateLoc = {
    country: "NG",
    state: "Kaduna",
    city: "Kaduna",
    campus: "AFIT",
    area: "Main Gate",
    label: "AFIT, Kaduna",
    latitude: 10.510523,
    longitude: 7.416512,
    source: "gps",
  };

  const sanitized = sanitizeLocationForPublic(privateLoc);
  assert.equal(sanitized.latitude, undefined);
  assert.equal(sanitized.longitude, undefined);
  assert.equal(sanitized.campus, "AFIT");
  assert.equal(sanitized.state, "Kaduna");
  assert.equal(sanitized.city, "Kaduna");
  assert.equal(sanitized.label, "AFIT, Kaduna");
  assert.equal(sanitized.source, "gps");
});
