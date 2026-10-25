import test from "node:test";
import assert from "node:assert/strict";

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function getAudioExtension(mimeType) {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("aac")) return "aac";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

test("formatDuration - converts seconds to mm:ss correctly", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(7), "0:07");
  assert.equal(formatDuration(45), "0:45");
  assert.equal(formatDuration(60), "1:00");
  assert.equal(formatDuration(75), "1:15");
  assert.equal(formatDuration(125), "2:05");
});

test("getAudioExtension - maps audio mime types to appropriate file extensions", () => {
  assert.equal(getAudioExtension("audio/webm;codecs=opus"), "webm");
  assert.equal(getAudioExtension("audio/webm"), "webm");
  assert.equal(getAudioExtension("audio/mp4"), "m4a");
  assert.equal(getAudioExtension("audio/aac"), "aac");
  assert.equal(getAudioExtension("audio/ogg"), "ogg");
});
