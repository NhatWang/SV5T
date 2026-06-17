let currentStudentId = "";
let currentHasPassword = false;

// ─────────────────────────────
// SESSION HELPERS
// ─────────────────────────────

function saveStudentSession(student) {
  if (student.fullName) {
    localStorage.setItem("studentFullName", student.fullName);
  }

  if (student.className) {
    localStorage.setItem("studentClassName", student.className);
  }
}

function clearStudentSession() {
  localStorage.removeItem("studentId");
  localStorage.removeItem("studentFullName");
  localStorage.removeItem("studentClassName");
  localStorage.removeItem("studentLoggedIn");
}

// ─────────────────────────────
// TOGGLE PASSWORD
// ─────────────────────────────

function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);

  if (!input) return;

  const eyeOpen = `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;

  const eyeOff = `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.29 20.29 0 0 1 5.06-5.94"></path>
      <path d="M9.9 4.24A10.45 10.45 0 0 1 12 4c7 0 11 7 11 7a20.55 20.55 0 0 1-3.23 4.31"></path>
      <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
  `;

  if (input.type === "password") {
    input.type = "text";
    button.innerHTML = eyeOff;
  } else {
    input.type = "password";
    button.innerHTML = eyeOpen;
  }
}

// ── BƯỚC 1: Kiểm tra MSSV ──

async function checkMSSV() {
  const studentId = document.getElementById("studentId").value.trim();
  const message1 = document.getElementById("message1");

  message1.textContent = "";
  message1.className = "";

  if (!studentId) {
    showMessage(message1, "Vui lòng nhập mã số sinh viên", "error");
    return;
  }

  try {
    const res = await fetch("/api/student/check-mssv", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ studentId })
    });

    const data = await res.json();

    if (!data.success) {
      showMessage(message1, data.message, "error");
      return;
    }

    currentStudentId = data.studentId;
    currentHasPassword = data.hasPassword;

    document.getElementById("fullName").textContent = data.fullName;
    document.getElementById("className").textContent =
      data.className || "Chưa cập nhật";

    showStep("step2");
  } catch (error) {
    console.error("Check MSSV error:", error);
    showMessage(message1, "Không thể kết nối server", "error");
  }
}

// ── BƯỚC 2: Xác nhận ──

function confirmStudent() {
  if (currentHasPassword) {
    showStep("loginForm");
  } else {
    showStep("createPasswordForm");
  }
}

// ── BƯỚC 3A: Tạo mật khẩu ──

async function createPassword() {
  const password = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const message2 = document.getElementById("message2");

  message2.textContent = "";
  message2.className = "";

  if (!password || !confirmPassword) {
    showMessage(message2, "Vui lòng nhập đầy đủ mật khẩu", "error");
    return;
  }

  if (password.length < 6) {
    showMessage(message2, "Mật khẩu phải có ít nhất 6 ký tự", "error");
    return;
  }

  if (password !== confirmPassword) {
    showMessage(message2, "Mật khẩu nhập lại không khớp", "error");
    return;
  }

  try {
    const res = await fetch("/api/student/create-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentId: currentStudentId,
        password,
        confirmPassword
      })
    });

    const data = await res.json();

    if (data.success) {
      showMessage(message2, data.message, "success");

      saveStudentSession(data.student);

      setTimeout(() => {
        window.location.href = "/student-dashboard.html";
      }, 1200);
    } else {
      showMessage(message2, data.message, "error");
    }
  } catch (error) {
    console.error("Create password error:", error);
    showMessage(message2, "Không thể kết nối server", "error");
  }
}

// ── BƯỚC 3B: Đăng nhập ──

async function loginStudent() {
  const password = document.getElementById("loginPassword").value;
  const message3 = document.getElementById("message3");

  message3.textContent = "";
  message3.className = "";

  if (!password) {
    showMessage(message3, "Vui lòng nhập mật khẩu", "error");
    return;
  }

  try {
    const res = await fetch("/api/student/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentId: currentStudentId,
        password
      })
    });

    const data = await res.json();

    if (data.success) {
      showMessage(message3, data.message, "success");

      // FIX #7: Dùng saveStudentSession() cho nhất quán với createPassword flow
      // (tránh set localStorage rải rác, dễ quên khi thêm field mới)
      saveStudentSession(data.student);

      setTimeout(() => {
        window.location.href = "/student-dashboard.html";
      }, 1200);
    } else {
      showMessage(message3, data.message, "error");
    }
  } catch (error) {
    console.error("Login error:", error);
    showMessage(message3, "Không thể kết nối server", "error");
  }
}

// ── RESET MẬT KHẨU ──

function showResetForm() {
  if (!currentStudentId) {
    const message1 = document.getElementById("message1");
    showStep("step1");

    if (message1) {
      showMessage(
        message1,
        "Vui lòng nhập MSSV trước khi đặt lại mật khẩu.",
        "error"
      );
    }

    return;
  }

  const resetStudentIdText = document.getElementById("resetStudentIdText");
  const resetCode = document.getElementById("resetCode");
  const resetNewPassword = document.getElementById("resetNewPassword");
  const resetConfirmPassword = document.getElementById("resetConfirmPassword");
  const resetMessage = document.getElementById("resetMessage");

  if (resetStudentIdText) {
    resetStudentIdText.textContent = currentStudentId;
  }

  if (resetCode) resetCode.value = "";
  if (resetNewPassword) resetNewPassword.value = "";
  if (resetConfirmPassword) resetConfirmPassword.value = "";

  if (resetMessage) {
    resetMessage.textContent =
      "Vui lòng nhập mã reset do admin chi Hội cung cấp.";
    resetMessage.className = "";
  }

  showStep("resetPasswordForm");
}

function cancelReset() {
  const resetCode = document.getElementById("resetCode");
  const resetNewPassword = document.getElementById("resetNewPassword");
  const resetConfirmPassword = document.getElementById("resetConfirmPassword");
  const resetMessage = document.getElementById("resetMessage");

  if (resetCode) resetCode.value = "";
  if (resetNewPassword) resetNewPassword.value = "";
  if (resetConfirmPassword) resetConfirmPassword.value = "";

  if (resetMessage) {
    resetMessage.textContent = "";
    resetMessage.className = "";
  }

  showStep("loginForm");
}

async function resetPassword() {
  const resetCode = document.getElementById("resetCode")?.value.trim();
  const newPassword = document.getElementById("resetNewPassword")?.value;
  const confirmPassword = document.getElementById("resetConfirmPassword")?.value;
  const resetMessage = document.getElementById("resetMessage");

  if (!resetMessage) return;

  resetMessage.textContent = "";
  resetMessage.className = "";

  if (!currentStudentId) {
    showMessage(
      resetMessage,
      "Không xác định được MSSV. Vui lòng quay lại bước nhập MSSV.",
      "error"
    );
    return;
  }

  if (!resetCode || !newPassword || !confirmPassword) {
    showMessage(
      resetMessage,
      "Vui lòng nhập đầy đủ mã reset, mật khẩu mới và xác nhận mật khẩu.",
      "error"
    );
    return;
  }

  if (!/^\d{6}$/.test(resetCode)) {
    showMessage(resetMessage, "Mã reset phải gồm 6 số.", "error");
    return;
  }

  if (newPassword.length < 6) {
    showMessage(resetMessage, "Mật khẩu mới phải có ít nhất 6 ký tự.", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showMessage(resetMessage, "Mật khẩu nhập lại không khớp.", "error");
    return;
  }

  try {
    const res = await fetch("/api/student/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentId: currentStudentId,
        resetCode,
        newPassword,
        confirmPassword
      })
    });

    const data = await res.json();

    if (!data.success) {
      showMessage(
        resetMessage,
        data.message || "Không thể đặt lại mật khẩu.",
        "error"
      );
      return;
    }

    showMessage(
      resetMessage,
      data.message || "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.",
      "success"
    );

    setTimeout(() => {
      cancelReset();
    }, 1800);
  } catch (error) {
    console.error("Reset password error:", error);
    showMessage(resetMessage, "Không thể kết nối server.", "error");
  }
}

// ── QUAY LẠI ──

function goBackToMSSV() {
  currentStudentId = "";
  currentHasPassword = false;

  document.getElementById("studentId").value = "";
  document.getElementById("message1").textContent = "";

  showStep("step1");
}

// ── HELPERS ──

function showStep(stepId) {
  const allSteps = [
    "step1",
    "step2",
    "createPasswordForm",
    "loginForm",
    "resetPasswordForm"
  ];

  allSteps.forEach((id) => {
    const el = document.getElementById(id);

    if (el) {
      el.classList.add("hidden");
    }
  });

  const selectedStep = document.getElementById(stepId);

  if (selectedStep) {
    selectedStep.classList.remove("hidden");
  }
}

function bindEnter(inputId, action) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); action(); }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEnter("studentId",          checkMSSV);
  bindEnter("newPassword",        () => document.getElementById("confirmPassword")?.focus());
  bindEnter("confirmPassword",    createPassword);
  bindEnter("loginPassword",      loginStudent);
  bindEnter("resetCode",          () => document.getElementById("resetNewPassword")?.focus());
  bindEnter("resetNewPassword",   () => document.getElementById("resetConfirmPassword")?.focus());
  bindEnter("resetConfirmPassword", resetPassword);
});

function showMessage(el, text, type) {
  el.textContent = text;
  el.className = type === "success" ? "msg-success" : "msg-error";
}