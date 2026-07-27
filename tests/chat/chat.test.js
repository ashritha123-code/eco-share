'use strict';

/**
 * EcoShare - Chat System Test Suite
 * Tests: Messages, storage, persistence, clearing, validation
 * Total: ~30 tests
 */

// ── Helpers ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'ecocircle_chat_messages';

function createMessage(text, sender, type = 'text') {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { success: false, error: 'Message cannot be empty' };
  }
  if (!sender || typeof sender !== 'string' || sender.trim().length === 0) {
    return { success: false, error: 'Sender is required' };
  }
  if (text.trim().length > 2000) {
    return { success: false, error: 'Message too long (max 2000 chars)' };
  }
  return {
    success: true,
    message: {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      sender: sender.trim(),
      type,
      timestamp: new Date().toISOString(),
      read: false
    }
  };
}

function saveMessages(messages, storage) {
  try {
    storage[STORAGE_KEY] = JSON.stringify(messages);
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Storage failed' };
  }
}

function loadMessages(storage) {
  try {
    const raw = storage[STORAGE_KEY];
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function clearMessages(storage) {
  delete storage[STORAGE_KEY];
  return { success: true };
}

function filterMessagesBySender(messages, sender) {
  return messages.filter(m => m.sender === sender);
}

function markAsRead(messages, senderId) {
  return messages.map(m => m.sender !== senderId ? { ...m, read: true } : m);
}

function getUnreadCount(messages, currentUserId) {
  return messages.filter(m => !m.read && m.sender !== currentUserId).length;
}

function validateChatroom(roomId) {
  if (!roomId || typeof roomId !== 'string') return false;
  return roomId.trim().length >= 3;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('[CHAT] Message Creation', () => {
  test('TC-CHAT-01: valid message is created successfully', () => {
    const r = createMessage('Hello community!', 'Alice');
    expect(r.success).toBe(true);
    expect(r.message.text).toBe('Hello community!');
  });

  test('TC-CHAT-02: created message has a unique id', () => {
    const r = createMessage('Hello!', 'Alice');
    expect(r.success).toBe(true);
    expect(r.message.id).toBeTruthy();
    expect(r.message.id.startsWith('msg_')).toBe(true);
  });

  test('TC-CHAT-03: created message has timestamp', () => {
    const r = createMessage('Hello!', 'Alice');
    expect(r.message.timestamp).toBeTruthy();
    expect(new Date(r.message.timestamp).getFullYear()).toBeGreaterThanOrEqual(2024);
  });

  test('TC-CHAT-04: created message is unread by default', () => {
    const r = createMessage('Hello!', 'Alice');
    expect(r.message.read).toBe(false);
  });

  test('TC-CHAT-05: created message has correct sender', () => {
    const r = createMessage('Hello!', 'Bob');
    expect(r.message.sender).toBe('Bob');
  });

  test('TC-CHAT-06: empty message text fails', () => {
    const r = createMessage('', 'Alice');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/empty/i);
  });

  test('TC-CHAT-07: whitespace-only message fails', () => {
    const r = createMessage('   ', 'Alice');
    expect(r.success).toBe(false);
  });

  test('TC-CHAT-08: null message text fails', () => {
    const r = createMessage(null, 'Alice');
    expect(r.success).toBe(false);
  });

  test('TC-CHAT-09: empty sender fails', () => {
    const r = createMessage('Hello!', '');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/sender/i);
  });

  test('TC-CHAT-10: null sender fails', () => {
    const r = createMessage('Hello!', null);
    expect(r.success).toBe(false);
  });

  test('TC-CHAT-11: message longer than 2000 chars fails', () => {
    const r = createMessage('A'.repeat(2001), 'Alice');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/too long/i);
  });

  test('TC-CHAT-12: message exactly 2000 chars passes', () => {
    const r = createMessage('A'.repeat(2000), 'Alice');
    expect(r.success).toBe(true);
  });

  test('TC-CHAT-13: message type defaults to text', () => {
    const r = createMessage('Hello!', 'Alice');
    expect(r.message.type).toBe('text');
  });

  test('TC-CHAT-14: image message type is preserved', () => {
    const r = createMessage('image.jpg', 'Alice', 'image');
    expect(r.message.type).toBe('image');
  });

  test('TC-CHAT-15: two messages have different ids', () => {
    const r1 = createMessage('First', 'Alice');
    const r2 = createMessage('Second', 'Bob');
    expect(r1.message.id).not.toBe(r2.message.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[CHAT] Message Persistence', () => {
  let storage;

  beforeEach(() => {
    storage = {};
  });

  test('TC-CHAT-16: messages saved to storage correctly', () => {
    const msgs = [createMessage('Hi!', 'Alice').message];
    saveMessages(msgs, storage);
    expect(storage[STORAGE_KEY]).toBeTruthy();
  });

  test('TC-CHAT-17: messages loaded back from storage correctly', () => {
    const msgs = [createMessage('Hi!', 'Alice').message, createMessage('Hey!', 'Bob').message];
    saveMessages(msgs, storage);
    const loaded = loadMessages(storage);
    expect(loaded.length).toBe(2);
  });

  test('TC-CHAT-18: loaded messages preserve sender field', () => {
    const msgs = [createMessage('Hi!', 'Alice').message];
    saveMessages(msgs, storage);
    const loaded = loadMessages(storage);
    expect(loaded[0].sender).toBe('Alice');
  });

  test('TC-CHAT-19: loaded messages preserve text field', () => {
    const msgs = [createMessage('Community meeting at 5pm', 'Charlie').message];
    saveMessages(msgs, storage);
    const loaded = loadMessages(storage);
    expect(loaded[0].text).toBe('Community meeting at 5pm');
  });

  test('TC-CHAT-20: empty storage returns empty array', () => {
    const loaded = loadMessages(storage);
    expect(loaded).toEqual([]);
  });

  test('TC-CHAT-21: corrupted storage returns empty array gracefully', () => {
    storage[STORAGE_KEY] = '{ this is not json !!!';
    const loaded = loadMessages(storage);
    expect(loaded).toEqual([]);
  });

  test('TC-CHAT-22: 50 messages persist correctly', () => {
    const msgs = Array.from({ length: 50 }, (_, i) => createMessage(`Message ${i}`, 'User').message);
    saveMessages(msgs, storage);
    const loaded = loadMessages(storage);
    expect(loaded.length).toBe(50);
  });

  test('TC-CHAT-23: clearing messages removes from storage', () => {
    const msgs = [createMessage('Hi!', 'Alice').message];
    saveMessages(msgs, storage);
    clearMessages(storage);
    expect(storage[STORAGE_KEY]).toBeUndefined();
    expect(loadMessages(storage)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[CHAT] Message Filtering & Read Status', () => {
  const messages = [
    createMessage('Hello from Alice', 'Alice').message,
    createMessage('Hi from Bob', 'Bob').message,
    createMessage('Another from Alice', 'Alice').message,
    createMessage('From Charlie', 'Charlie').message,
  ];

  test('TC-CHAT-24: filter messages by sender returns correct count', () => {
    const aliceMsgs = filterMessagesBySender(messages, 'Alice');
    expect(aliceMsgs.length).toBe(2);
  });

  test('TC-CHAT-25: filter messages by non-existent sender returns empty array', () => {
    const msgs = filterMessagesBySender(messages, 'Dave');
    expect(msgs.length).toBe(0);
  });

  test('TC-CHAT-26: markAsRead marks other users messages as read', () => {
    const updated = markAsRead(messages, 'Alice');
    const bobMsg = updated.find(m => m.sender === 'Bob');
    expect(bobMsg.read).toBe(true);
  });

  test('TC-CHAT-27: markAsRead does not mark own messages as read', () => {
    const updated = markAsRead(messages, 'Alice');
    const aliceMsgs = updated.filter(m => m.sender === 'Alice');
    aliceMsgs.forEach(m => expect(m.read).toBe(false));
  });

  test('TC-CHAT-28: getUnreadCount returns correct count for current user', () => {
    const count = getUnreadCount(messages, 'Alice');
    // Messages from Bob and Charlie are unread for Alice = 2
    expect(count).toBe(2);
  });

  test('TC-CHAT-29: getUnreadCount is 0 when all messages are from self', () => {
    const selfMsgs = [createMessage('My own message', 'Alice').message];
    expect(getUnreadCount(selfMsgs, 'Alice')).toBe(0);
  });

  test('TC-CHAT-30: valid chatroom ID passes validation', () => {
    expect(validateChatroom('community_room')).toBe(true);
  });

  test('TC-CHAT-31: chatroom ID shorter than 3 chars fails', () => {
    expect(validateChatroom('ab')).toBe(false);
  });

  test('TC-CHAT-32: null chatroom ID fails', () => {
    expect(validateChatroom(null)).toBe(false);
  });
});
