import test from "node:test";
import assert from "node:assert/strict";

// Helper functions mirroring client & edge service logic
function canEditMessage(message, userId, now = Date.now()) {
  if (message.sender_id !== userId) return false;
  if (message.is_deleted) return false;
  if (message.type !== "text") return false;
  if (!message.id || message.id <= 0) return false;
  const createdMs = Date.parse(message.created_at);
  const diffMinutes = (now - createdMs) / 60000;
  return diffMinutes >= 0 && diffMinutes <= 15;
}

function canDeleteForEveryone(message, userId, now = Date.now()) {
  if (message.sender_id !== userId) return false;
  if (message.is_deleted) return false;
  if (!message.id || message.id <= 0) return false;
  const createdMs = Date.parse(message.created_at);
  const diffMinutes = (now - createdMs) / 60000;
  return diffMinutes >= 0 && diffMinutes <= 5;
}

function canDeleteForMe(message) {
  return message.id > 0 && !message.is_deleted;
}

function replyBodyFor(message) {
  if (!message) return null;
  if (message.is_deleted) return "Original message deleted";
  if (message.type === "audio") return "🎤 Voice message";
  if (message.type === "image") return "📷 Photo";
  if (message.type === "video") return "📹 Video";
  if (message.type === "file") return "📎 File";
  const body = (message.body ?? "").trim();
  if (!body) return "Original message";
  return body.length > 140 ? `${body.slice(0, 137)}…` : body;
}

test("Message Edit Eligibility - own text within 15 minutes", () => {
  const now = Date.now();
  const recent = {
    id: 101,
    sender_id: 42,
    type: "text",
    body: "Hello world",
    is_deleted: false,
    created_at: new Date(now - 5 * 60 * 1000).toISOString(),
  };

  assert.equal(canEditMessage(recent, 42, now), true);
});

test("Message Edit Eligibility - own text older than 15 minutes rejected", () => {
  const now = Date.now();
  const old = {
    id: 102,
    sender_id: 42,
    type: "text",
    body: "Old text",
    is_deleted: false,
    created_at: new Date(now - 16 * 60 * 1000).toISOString(),
  };

  assert.equal(canEditMessage(old, 42, now), false);
});

test("Message Edit Eligibility - other user's message cannot be edited", () => {
  const now = Date.now();
  const otherMsg = {
    id: 103,
    sender_id: 99,
    type: "text",
    body: "Hey there",
    is_deleted: false,
    created_at: new Date(now - 2 * 60 * 1000).toISOString(),
  };

  assert.equal(canEditMessage(otherMsg, 42, now), false);
});

test("Message Edit Eligibility - deleted or non-text messages cannot be edited", () => {
  const now = Date.now();
  const deletedMsg = {
    id: 104,
    sender_id: 42,
    type: "text",
    body: "Deleted",
    is_deleted: true,
    created_at: new Date(now - 1 * 60 * 1000).toISOString(),
  };
  const audioMsg = {
    id: 105,
    sender_id: 42,
    type: "audio",
    media_url: "https://example.com/voice.webm",
    is_deleted: false,
    created_at: new Date(now - 1 * 60 * 1000).toISOString(),
  };

  assert.equal(canEditMessage(deletedMsg, 42, now), false);
  assert.equal(canEditMessage(audioMsg, 42, now), false);
});

test("Message Deletion - Delete for everyone allowed within 5 minutes for sender only", () => {
  const now = Date.now();
  const ownMsg = {
    id: 201,
    sender_id: 42,
    type: "text",
    body: "Accidental message",
    is_deleted: false,
    created_at: new Date(now - 2 * 60 * 1000).toISOString(),
  };

  assert.equal(canDeleteForEveryone(ownMsg, 42, now), true);
  assert.equal(canDeleteForEveryone(ownMsg, 99, now), false); // not author
});

test("Message Deletion - Delete for everyone disallowed after 5 minutes", () => {
  const now = Date.now();
  const ownMsgOld = {
    id: 202,
    sender_id: 42,
    type: "text",
    body: "Accidental message from 6 min ago",
    is_deleted: false,
    created_at: new Date(now - 6 * 60 * 1000).toISOString(),
  };

  assert.equal(canDeleteForEveryone(ownMsgOld, 42, now), false);
});

test("Message Deletion - Delete for me allowed for any non-deleted message", () => {
  const msgFromOther = {
    id: 203,
    sender_id: 99,
    type: "text",
    body: "Some message",
    is_deleted: false,
    created_at: new Date().toISOString(),
  };

  assert.equal(canDeleteForMe(msgFromOther), true);
  assert.equal(canDeleteForMe({ ...msgFromOther, is_deleted: true }), false);
});

test("Reply Body Formatter - generates appropriate previews", () => {
  assert.equal(replyBodyFor({ type: "audio", is_deleted: false }), "🎤 Voice message");
  assert.equal(replyBodyFor({ type: "image", is_deleted: false }), "📷 Photo");
  assert.equal(replyBodyFor({ type: "video", is_deleted: false }), "📹 Video");
  assert.equal(replyBodyFor({ type: "file", is_deleted: false }), "📎 File");
  assert.equal(replyBodyFor({ type: "text", body: "Short reply", is_deleted: false }), "Short reply");
  assert.equal(
    replyBodyFor({
      type: "text",
      body: "A".repeat(150),
      is_deleted: false,
    }),
    `${"A".repeat(137)}…`,
  );
  assert.equal(replyBodyFor({ type: "text", body: "Deleted text", is_deleted: true }), "Original message deleted");
});
