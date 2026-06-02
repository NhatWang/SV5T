self.addEventListener("push", (event) => {
  let data = {
    title: "SV5T",
    body: "Bạn có thông báo mới.",
    url: "/student-dashboard.html",
    icon: "/favicon.ico"
  };

  try {
    data = event.data ? event.data.json() : data;
  } catch {
    // giữ data mặc định
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      data: {
        url: data.url
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/student-dashboard.html";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});