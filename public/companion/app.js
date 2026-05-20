(() => {
  const companion = document.querySelector("#companion");
  const speech = document.querySelector("#speech");
  const statusLabel = document.querySelector("#statusLabel");
  const moodLabel = document.querySelector("#moodLabel");
  const stars = document.querySelector("#stars");

  const lines = {
    idle: ["Ready when you are.", "The room is quiet.", "Waiting for a message."],
    wave: ["Hello there.", "Message received.", "I am here."],
    think: ["Thinking...", "Let me work through that.", "One moment."],
    type: ["Writing a reply...", "Typing...", "Composing response."]
  };

  createStars();
  setAction("idle");

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      setAction(button.dataset.action || "idle");
      showSpeech(pick(lines[button.dataset.action] || lines.idle), false);
    });
  });

  window.addEventListener("message", (event) => {
    if (event.origin && event.origin !== "null" && event.origin !== window.location.origin) return;
    const message = event.data || {};

    if (message.type === "assistant-start") {
      setAction("type");
      showSpeech("Writing a reply...", true);
      return;
    }

    if (message.type === "assistant-speech") {
      setAction(message.streaming ? "type" : "wave");
      showSpeech(message.text || "...", message.streaming);
      return;
    }

    if (message.type === "user-message") {
      setAction("think");
      showSpeech("Message received.", false);
    }
  });

  function setAction(action) {
    companion.className = `companion ${action}`;
    statusLabel.textContent = action[0].toUpperCase() + action.slice(1);
    moodLabel.textContent = action === "type" ? "Responding" : "Ready";
  }

  function showSpeech(text, keepOpen) {
    speech.textContent = trimText(text);
    speech.classList.remove("hidden");

    if (!keepOpen) {
      window.clearTimeout(showSpeech.timer);
      showSpeech.timer = window.setTimeout(() => {
        speech.classList.add("hidden");
      }, 4200);
    }
  }

  function trimText(text) {
    const clean = String(text || "").trim();
    return clean.length > 150 ? `${clean.slice(0, 147)}...` : clean;
  }

  function pick(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function createStars() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 70; i += 1) {
      const star = document.createElement("span");
      star.className = "star";
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 70}%`;
      star.style.animationDelay = `${Math.random() * 3}s`;
      fragment.appendChild(star);
    }
    stars.appendChild(fragment);
  }
})();

