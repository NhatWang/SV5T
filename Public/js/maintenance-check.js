(function initMaintenanceWatch() {
  async function check() {
    try {
      const res = await fetch('/api/system/status');
      if (!res.ok) return;
      const data = await res.json();
      if (data.maintenance) {
        sessionStorage.setItem('maintenanceReturnTo', window.location.href);
        window.location.replace('/maintenance.html');
      }
    } catch (e) {
      // Network error — ignore, keep polling
    }
  }

  // Check on load, then every 3s to catch admin enabling without page reload
  check();
  setInterval(check, 3_000);
})();
