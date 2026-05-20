const CHAT_KEY = "pixel-ai-chat.messages.v1";

export function loadMessages() {
  return readJson(CHAT_KEY, []);
}

export function saveMessages(messages) {
  writeJson(CHAT_KEY, messages);
}

export function clearMessages() {
  localStorage.removeItem(CHAT_KEY);
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

