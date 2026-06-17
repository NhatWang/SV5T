let currentCode = null;
let sessionCheckinCount = 0;
const recentCheckins = [];

let scannerRunning = false;
let currentFacingMode = "environment";

// ══════════════════════════════════════════
// BƯỚC 1: Xác thực mã bảo mật
// ══════════════════════════════════════════

async function submitCode() {
  const input = document.getElementById("codeInput");
  const code = input.value.toUpperCase().trim();
  const msg = document.getElementById("codeMsg");

  msg.className = "msg";
  msg.textContent = "";

  if (code.length !== 6) {
    showMsg(msg, "Mã bảo mật gồm đúng 6 ký tự.", "error");
    return;
  }

  const btn = document.getElementById("codeSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Đang kiểm tra...";

  try {
    const res = await fetch(`/api/checkin/by-code/${code}`);
    const data = await res.json();

    if (!data.success) {
      showMsg(msg, data.message || "Mã không hợp lệ.", "error");
      btn.disabled = false;
      btn.textContent = "Xác nhận mã";
      return;
    }

    currentCode = code;
    sessionCheckinCount = data.session.checkinCount;
    showCheckinPanel(data.session);
  } catch {
    showMsg(msg, "Lỗi kết nối. Vui lòng thử lại.", "error");
    btn.disabled = false;
    btn.textContent = "Xác nhận mã";
  }
}

function showCheckinPanel(session) {
  document.getElementById("step1").classList.add("hidden");

  document.getElementById("sessionTitle").textContent = session.title;
  const descEl = document.getElementById("sessionDesc");
  descEl.textContent = session.description || "";
  descEl.classList.toggle("hidden", !session.description);
  updateCountBadge();

  document.getElementById("step2").classList.remove("hidden");
}

function updateCountBadge() {
  document.getElementById("checkinCountBadge").textContent =
    `${sessionCheckinCount} sinh viên đã check-in`;
}

// ══════════════════════════════════════════
// BƯỚC 2: Check-in (dùng chung cho cả manual và scanner)
// ══════════════════════════════════════════

async function processCheckin(studentId) {
  const msg = document.getElementById("checkinMsg");
  msg.className = "msg";
  msg.textContent = "";

  if (!currentCode || !studentId?.trim()) return;

  try {
    const res = await fetch(`/api/checkin/by-code/${currentCode}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: studentId.trim() })
    });
    const data = await res.json();

    if (!data.success) {
      showMsg(msg, data.message || "Check-in thất bại.", "error");
      return;
    }

    const c = data.checkin;
    showMsg(msg, `✓ ${c.fullName} (${c.studentId}) — ${c.className}`, "success");

    if (navigator.vibrate) navigator.vibrate(150);

    sessionCheckinCount++;
    updateCountBadge();
    recentCheckins.unshift(c);
    renderRecentCheckins();
  } catch {
    showMsg(msg, "Lỗi kết nối. Vui lòng thử lại.", "error");
  }
}

async function submitCheckin() {
  const input = document.getElementById("mssvInput");
  const studentId = input.value.trim();

  if (!studentId) {
    showMsg(document.getElementById("checkinMsg"), "Vui lòng nhập MSSV.", "error");
    return;
  }

  await processCheckin(studentId);
  input.value = "";
  input.focus();
}

// ══════════════════════════════════════════
// SCANNER
// ══════════════════════════════════════════

const CONFIRM_NEEDED = 3;
const COOLDOWN_MS = 3000;

function startScanner() {
  if (scannerRunning) return;

  document.getElementById("scannerWrap").classList.remove("hidden");
  document.getElementById("scannerOff").classList.add("hidden");

  const config = {
    inputStream: {
      type: "LiveStream",
      target: document.getElementById("scannerViewport"),
      constraints: {
        facingMode: currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      area: { top: "20%", right: "5%", bottom: "20%", left: "5%" }
    },
    locator: { patchSize: "medium", halfSample: true },
    decoder: { readers: ["code_128_reader"] },
    frequency: 12,
    locate: true
  };

  let detectionBuffer = [];
  let lastConfirmed = "";
  let lastConfirmedTime = 0;

  Quagga.init(config, (err) => {
    if (err) {
      console.error("Quagga init error:", err);
      stopScanner();
      showMsg(
        document.getElementById("checkinMsg"),
        "Không thể bật camera. Vui lòng nhập MSSV thủ công.",
        "error"
      );
      return;
    }

    Quagga.start();
    scannerRunning = true;

    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const cams = devices.filter((d) => d.kind === "videoinput");
      document.getElementById("switchCamBtn").classList.toggle("hidden", cams.length < 2);
    }).catch(() => {});

    Quagga.onDetected((result) => {
      const code = result?.codeResult?.code;
      if (!code) return;

      const charErrors = (result.codeResult.decodedCodes || [])
        .filter((c) => c.error !== undefined)
        .map((c) => c.error);
      if (charErrors.length > 0) {
        const avg = charErrors.reduce((a, b) => a + b, 0) / charErrors.length;
        if (avg > 0.12) return;
      }

      detectionBuffer.push(code);
      if (detectionBuffer.length > CONFIRM_NEEDED) detectionBuffer.shift();

      const confirmed = detectionBuffer.length === CONFIRM_NEEDED
        && detectionBuffer.every((c) => c === code);
      if (!confirmed) return;

      detectionBuffer = [];

      const now = Date.now();
      if (code === lastConfirmed && now - lastConfirmedTime < COOLDOWN_MS) return;

      lastConfirmed = code;
      lastConfirmedTime = now;

      processCheckin(code);
    });
  });
}

function stopScanner() {
  if (scannerRunning) {
    Quagga.stop();
    scannerRunning = false;
  }

  document.getElementById("scannerWrap").classList.add("hidden");
  document.getElementById("scannerOff").classList.remove("hidden");
  document.getElementById("switchCamBtn").classList.add("hidden");
}

function switchCamera() {
  currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
  Quagga.stop();
  scannerRunning = false;
  startScanner();
}

// ══════════════════════════════════════════
// RECENT CHECKINS
// ══════════════════════════════════════════

function renderRecentCheckins() {
  const section = document.getElementById("recentSection");
  const list = document.getElementById("recentList");

  if (recentCheckins.length === 0) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  list.innerHTML = recentCheckins.slice(0, 20).map((c) => `
    <div class="recent-item">
      <span class="name">${c.fullName}</span>
      <span class="id">${c.studentId}</span>
      <span class="cls">${c.className}</span>
    </div>
  `).join("");
}

// ══════════════════════════════════════════
// ĐỔI PHIÊN
// ══════════════════════════════════════════

function changeSession() {
  stopScanner();

  currentCode = null;
  sessionCheckinCount = 0;
  recentCheckins.length = 0;

  document.getElementById("step2").classList.add("hidden");
  document.getElementById("step1").classList.remove("hidden");
  document.getElementById("codeInput").value = "";
  document.getElementById("mssvInput").value = "";
  document.getElementById("codeMsg").className = "msg";
  document.getElementById("codeMsg").textContent = "";
  document.getElementById("checkinMsg").className = "msg";
  document.getElementById("checkinMsg").textContent = "";
  document.getElementById("recentSection").classList.add("hidden");
  document.getElementById("codeSubmitBtn").disabled = false;
  document.getElementById("codeSubmitBtn").textContent = "Xác nhận mã";
  document.getElementById("codeInput").focus();
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = `msg show ${type}`;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("codeInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitCode();
  });
  document.getElementById("mssvInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitCheckin();
  });

  const urlCode = new URLSearchParams(window.location.search).get("code");
  if (urlCode && /^[A-Z0-9]{6}$/i.test(urlCode)) {
    document.getElementById("codeInput").value = urlCode.toUpperCase();
    submitCode();
  }
});
