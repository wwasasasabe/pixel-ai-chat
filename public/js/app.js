import { initChat } from "./chat.js";

initChat({
  onUserMessage(message) {
    postCompanionMessage({ type: "user-message", text: message.content });
  },
  onAssistantStart() {
    postCompanionMessage({ type: "assistant-start" });
  },
  onAssistantDelta(_chunk, message) {
    postCompanionMessage({ type: "assistant-speech", text: message.content, streaming: true });
  },
  onAssistantMessage(message) {
    postCompanionMessage({ type: "assistant-speech", text: message.content, streaming: false });
  }
});

function postCompanionMessage(message) {
  const frame = document.querySelector(".companion-frame");
  frame?.contentWindow?.postMessage(message, "*");
}

