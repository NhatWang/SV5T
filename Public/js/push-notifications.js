function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function initPushNotifications(targetType) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Trình duyệt không hỗ trợ Web Push.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.warn("Người dùng chưa cho phép thông báo.");
      return;
    }

    const keyRes = await fetch("/api/push/public-key", {
      credentials: "include"
    });

    const keyData = await keyRes.json();

    if (!keyData.success || !keyData.publicKey) {
      console.warn("Thiếu VAPID public key.");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
      });
    }

    const endpoint =
      targetType === "admin"
        ? "/api/push/admin/subscribe"
        : "/api/push/student/subscribe";

    await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subscription
      })
    });
  } catch (error) {
    console.error("Init push notification error:", error);
  }
}