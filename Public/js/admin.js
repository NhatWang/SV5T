async function loginAdmin() {
  const username = document.getElementById("adminUsername").value.trim();
  const password = document.getElementById("adminPassword").value;
  const message = document.getElementById("adminMessage");

  message.textContent = "";

  if (!username || !password) {
    message.textContent = "Vui lòng nhập tài khoản và mật khẩu";
    return;
  }

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      }),
      credentials: "include"
    });

    const data = await res.json();

    message.textContent = data.message;

    if (data.success) {
      localStorage.setItem("adminUsername", data.admin.username);
      localStorage.setItem("adminRole", data.admin.role);
      localStorage.setItem("adminClassName", data.admin.className || "");

      window.location.href = "/admin-dashboard.html";
    }
  } catch (error) {
    console.error("Admin login error:", error);
    message.textContent = "Không thể kết nối server";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const usernameEl = document.getElementById("adminUsername");
  const passwordEl = document.getElementById("adminPassword");
  if (usernameEl) usernameEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); passwordEl ? passwordEl.focus() : loginAdmin(); }
  });
  if (passwordEl) passwordEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); loginAdmin(); }
  });
});

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