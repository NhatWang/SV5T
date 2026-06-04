
(function () {

  const AVATAR = "/images/chatbot-avatar.png";

  // ── CSS ───────────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #sv5t-chat-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      width: 96px; height: 96px;
      background: transparent; border: none; cursor: pointer;
      padding: 0; transition: transform .2s;
    }
    #sv5t-chat-btn:hover { transform: scale(1.1); }
    #sv5t-chat-btn img {
      width: 96px; height: 96px; object-fit: contain;
      filter: drop-shadow(0 4px 12px rgba(49,130,206,.5));
      pointer-events: none;
    }

    #sv5t-chat-box {
      position: fixed; bottom: 100px; right: 24px; z-index: 9999;
      width: 360px; height: 520px;
      background: #fff; border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0,0,0,.18);
      display: none; flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
    }
    #sv5t-chat-box.open { display: flex; }

    #sv5t-chat-header {
      background: linear-gradient(135deg, #3182ce, #2b6cb0);
      color: #fff; padding: 12px 16px;
      display: flex; align-items: center; gap: 10px;
    }
    #sv5t-chat-header .avatar {
      width: 40px; height: 40px;
      background: transparent; border: none;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    #sv5t-chat-header .avatar img {
      width: 40px; height: 40px; object-fit: contain;
      filter: drop-shadow(0 1px 3px rgba(0,0,0,.2));
    }
    #sv5t-chat-header .info { flex: 1; }
    #sv5t-chat-header .name { font-weight: 600; font-size: 15px; }
    #sv5t-chat-header .status {
      font-size: 11px; opacity: .85;
      display: flex; align-items: center; gap: 4px;
    }
    #sv5t-chat-header .status::before {
      content: ""; width: 6px; height: 6px; border-radius: 50%;
      background: #68d391; display: inline-block;
    }
    #sv5t-chat-close {
      background: none; border: none; color: #fff;
      font-size: 22px; cursor: pointer; line-height: 1;
      opacity: .8; padding: 0 2px;
    }
    #sv5t-chat-close:hover { opacity: 1; }

    #sv5t-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px 12px;
      display: flex; flex-direction: column; gap: 10px;
      scroll-behavior: smooth;
    }
    #sv5t-chat-messages::-webkit-scrollbar { width: 4px; }
    #sv5t-chat-messages::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }

    .sv5t-msg-wrap {
      display: flex; gap: 8px; align-items: flex-end;
    }
    .sv5t-msg-wrap.user { flex-direction: row-reverse; }

    .sv5t-msg-avatar {
      width: 40px; height: 40px;
      background: transparent; border: none;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; overflow: visible;
    }
    .sv5t-msg-avatar img {
      width: 40px; height: 40px; object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,.15));
    }
    .sv5t-msg-wrap.user .sv5t-msg-avatar {
      width: 28px; height: 28px;
      background: #3182ce; border-radius: 50%;
      font-size: 14px; color: #fff;
    }

    .sv5t-msg {
      max-width: 76%; padding: 10px 13px;
      border-radius: 16px; line-height: 1.6;
      word-break: break-word;
    }
    .sv5t-msg.bot {
      background: #f7fafc; color: #2d3748;
      border-bottom-left-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    .sv5t-msg.user {
      background: #3182ce; color: #fff;
      border-bottom-right-radius: 4px;
    }
    .sv5t-msg.bot p { margin: 0 0 6px; }
    .sv5t-msg.bot p:last-child { margin: 0; }
    .sv5t-msg.bot ul, .sv5t-msg.bot ol { margin: 4px 0; padding-left: 18px; }
    .sv5t-msg.bot li { margin: 2px 0; }
    .sv5t-msg.bot strong { color: #2b6cb0; }
    .sv5t-msg.bot code {
      background: #edf2f7; padding: 1px 5px;
      border-radius: 4px; font-size: 12px;
    }

    .sv5t-typing {
      display: flex; gap: 4px; padding: 10px 13px;
      background: #f7fafc; border: 1px solid #e2e8f0;
      border-radius: 16px; border-bottom-left-radius: 4px;
      width: fit-content;
    }
    .sv5t-typing span {
      width: 6px; height: 6px; border-radius: 50%;
      background: #a0aec0; animation: sv5t-bounce 1.2s infinite;
    }
    .sv5t-typing span:nth-child(2) { animation-delay: .2s; }
    .sv5t-typing span:nth-child(3) { animation-delay: .4s; }
    @keyframes sv5t-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    .sv5t-cursor {
      display: inline-block; width: 2px; height: 14px;
      background: #3182ce; margin-left: 2px;
      animation: sv5t-blink .8s infinite;
      vertical-align: middle;
    }
    @keyframes sv5t-blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }

    .sv5t-suggestions {
      display: flex; flex-wrap: wrap; gap: 6px;
      padding: 4px 12px 10px;
    }
    .sv5t-suggestion-btn {
      background: #ebf8ff; color: #2b6cb0;
      border: 1px solid #bee3f8; border-radius: 20px;
      padding: 5px 11px; font-size: 12px; cursor: pointer;
      transition: all .15s; white-space: nowrap;
    }
    .sv5t-suggestion-btn:hover { background: #bee3f8; border-color: #90cdf4; }

    #sv5t-chat-footer {
      padding: 10px 12px 12px;
      border-top: 1px solid #f0f4f8;
      display: flex; gap: 8px; align-items: flex-end;
      background: #fff;
    }
    #sv5t-chat-input {
      flex: 1; resize: none;
      border: 1.5px solid #e2e8f0; border-radius: 10px;
      padding: 9px 12px; font-size: 13px; outline: none;
      max-height: 80px; overflow-y: auto;
      font-family: inherit; line-height: 1.5;
      transition: border-color .15s; background: #f7fafc;
    }
    #sv5t-chat-input:focus { border-color: #3182ce; background: #fff; }
    #sv5t-chat-input::placeholder { color: #a0aec0; }
    #sv5t-chat-send {
      background: #3182ce; color: #fff; border: none;
      border-radius: 10px; width: 38px; height: 38px;
      cursor: pointer; display: flex; align-items: center;
      justify-content: center; transition: background .15s; flex-shrink: 0;
    }
    #sv5t-chat-send:disabled { background: #cbd5e0; cursor: not-allowed; }
    #sv5t-chat-send:hover:not(:disabled) { background: #2b6cb0; }
    #sv5t-chat-send { font-size: 18px; line-height: 1; }
  `;
  document.head.appendChild(style);

  // ── HTML ──────────────────────────────────────────────────────────────────
  const btn = document.createElement("button");
  btn.id = "sv5t-chat-btn";
  btn.title = "Trợ lý SV5T";
  btn.innerHTML = `<img src="${AVATAR}" alt="Trợ lý SV5T">`;

  const box = document.createElement("div");
  box.id = "sv5t-chat-box";
  box.innerHTML = `
    <div id="sv5t-chat-header">
      <div class="avatar"><img src="${AVATAR}" alt="avatar"></div>
      <div class="info">
        <div class="name">Trợ lý SV5T</div>
        <div class="status">Sẵn sàng hỗ trợ</div>
      </div>
      <button id="sv5t-chat-close" title="Đóng">×</button>
    </div>
    <div id="sv5t-chat-messages"></div>
    <div class="sv5t-suggestions" id="sv5t-suggestions"></div>
    <div id="sv5t-chat-footer">
      <textarea id="sv5t-chat-input" rows="1" placeholder="Hỏi về tiến độ SV5T của bạn..."></textarea>
      <button id="sv5t-chat-send" title="Gửi">&#9658;</button>
    </div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(box);

  // ── State ─────────────────────────────────────────────────────────────────
  const history = [];
  let isLoading = false;

  const messagesEl    = box.querySelector("#sv5t-chat-messages");
  const inputEl       = box.querySelector("#sv5t-chat-input");
  const sendBtn       = box.querySelector("#sv5t-chat-send");
  const suggestionsEl = box.querySelector("#sv5t-suggestions");

  const SUGGESTIONS = [
    "Tôi còn thiếu gì để đạt SV5T?",
    "Cần minh chứng gì cho Tình nguyện tốt?",
    "Hội nhập tốt cần những gì?",
    "Tiến độ hiện tại của tôi thế nào?"
  ];

  // ── Markdown parser nhẹ ───────────────────────────────────────────────────
  function parseMarkdown(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/^[-•]\s+(.+)$/gm, "<li>$1</li>")
      .replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>\n?)+/gs, (m) => `<ul>${m}</ul>`)
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/^(.+)/, (m) => m.startsWith("<") ? m : `<p>${m}</p>`);
  }

  // ── Tạo message bubble ────────────────────────────────────────────────────
  function createBubble(role) {
    const wrap = document.createElement("div");
    wrap.className = `sv5t-msg-wrap ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "sv5t-msg-avatar";
    if (role === "bot") {
      avatar.innerHTML = `<img src="${AVATAR}" alt="bot">`;
    } else {
      avatar.textContent = "👤";
    }

    const msg = document.createElement("div");
    msg.className = `sv5t-msg ${role}`;

    wrap.appendChild(avatar);
    wrap.appendChild(msg);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
  }

  function addMessage(text, role) {
    const msg = createBubble(role);
    msg.innerHTML = role === "bot" ? parseMarkdown(text) : "";
    if (role !== "bot") msg.textContent = text;
    return msg;
  }

  function showTyping() {
    const wrap = document.createElement("div");
    wrap.className = "sv5t-msg-wrap bot";
    wrap.id = "sv5t-typing-wrap";
    wrap.innerHTML = `
      <div class="sv5t-msg-avatar"><img src="${AVATAR}" alt="bot"></div>
      <div class="sv5t-typing"><span></span><span></span><span></span></div>
    `;
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
  }

  function showSuggestions() {
    suggestionsEl.innerHTML = "";
    SUGGESTIONS.forEach(text => {
      const b = document.createElement("button");
      b.className = "sv5t-suggestion-btn";
      b.textContent = text;
      b.onclick = () => { suggestionsEl.innerHTML = ""; sendMessage(text); };
      suggestionsEl.appendChild(b);
    });
  }

  function setLoading(val) {
    isLoading = val;
    sendBtn.disabled = val;
    inputEl.disabled = val;
  }

  // ── Send không dùng Streaming ─────────────────────────────────────────────
async function sendMessage(text) {
  const msg = (text || inputEl.value).trim();
  if (!msg || isLoading) return;

  inputEl.value = "";
  inputEl.style.height = "auto";
  suggestionsEl.innerHTML = "";

  addMessage(msg, "user");
  history.push({ role: "user", content: msg });

  setLoading(true);
  const typingWrap = showTyping();

  try {
    const res = await fetch("/api/chatbot/student", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: msg,
        history: history.slice(-10)
      })
    });

    typingWrap.remove();

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.success === false) {
      addMessage(
        data.message || "Chatbot đang gặp lỗi. Vui lòng thử lại sau.",
        "bot"
      );
      return;
    }

    const reply = data.reply || "Mình chưa có câu trả lời phù hợp.";
    addMessage(reply, "bot");
    history.push({
      role: "assistant",
      content: reply
    });
  } catch (err) {
    typingWrap.remove();
    addMessage(
      "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.",
      "bot"
    );
  } finally {
    setLoading(false);
    inputEl.focus();
  }
}

  // ── Events ────────────────────────────────────────────────────────────────
  btn.addEventListener("click", () => {
    box.classList.toggle("open");
    if (box.classList.contains("open")) {
      if (messagesEl.children.length === 0) {
        addMessage("Chào bạn! 🎓 Mình là Bồ Câu Kỹ Thuật Số — trợ lý SV5T của Khoa Hóa học.\nMình có thể giúp bạn kiểm tra tiến độ, hướng dẫn nộp minh chứng hoặc giải đáp quy chế **Sinh viên 5 tốt**. Bạn cần hỏi gì?", "bot");
        showSuggestions();
      }
      setTimeout(() => inputEl.focus(), 100);
    }
  });

  box.querySelector("#sv5t-chat-close").addEventListener("click", () => {
    box.classList.remove("open");
  });

  sendBtn.addEventListener("click", () => sendMessage());

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + "px";
  });

})();