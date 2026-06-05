async function submitResetPassword() {
  const username = document.getElementById("resetUsername").value.trim();
  const resetCode = document.getElementById("resetCode").value.trim();
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const message = document.getElementById("resetMessage");

  message.textContent = "";
  message.className = "";

  if (!username || !resetCode || !newPassword || !confirmPassword) {
    message.textContent = "Vui lòng điền đầy đủ tất cả các trường";
    return;
  }

  if (newPassword !== confirmPassword) {
    message.textContent = "Mật khẩu nhập lại không khớp";
    return;
  }

  if (newPassword.length < 6) {
    message.textContent = "Mật khẩu mới phải có ít nhất 6 ký tự";
    return;
  }

  try {
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, resetCode, newPassword, confirmPassword }),
      credentials: "include"
    });

    const data = await res.json();

    message.textContent = data.message;

    if (data.success) {
      message.className = "success";
      setTimeout(() => {
        window.location.href = "/admin.html";
      }, 2000);
    }
  } catch (error) {
    console.error("Reset password error:", error);
    message.textContent = "Không thể kết nối server";
  }
}

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
