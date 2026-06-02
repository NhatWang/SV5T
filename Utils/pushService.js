const webpush = require("web-push");
const PushSubscription = require("../Models/PushSubscription");

webpush.setVapidDetails(
  process.env.VAPID_CONTACT || "mailto:admin@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function sendPushToSubscriptions(subscriptions, payload) {
  const data = JSON.stringify({
    title: payload.title || "SV5T",
    body: payload.body || "",
    url: payload.url || "/student-dashboard.html",
    icon: payload.icon || "/favicon.ico"
  });

  await Promise.all(
    subscriptions.map(async (item) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: item.endpoint,
            keys: item.keys
          },
          data
        );

        item.lastUsedAt = new Date();
        await item.save();
      } catch (error) {
        const statusCode = error.statusCode || error.status;

        if (statusCode === 404 || statusCode === 410) {
          await PushSubscription.deleteOne({
            endpoint: item.endpoint
          });
        } else {
          console.error("Send push error:", error.message);
        }
      }
    })
  );
}

async function sendPushToStudent(studentId, payload) {
  const subscriptions = await PushSubscription.find({
    targetType: "student",
    targetId: String(studentId)
  });

  await sendPushToSubscriptions(subscriptions, payload);
}

async function sendPushToStudents(studentIds, payload) {
  const uniqueIds = [...new Set((studentIds || []).map(String))];

  if (uniqueIds.length === 0) return;

  const subscriptions = await PushSubscription.find({
    targetType: "student",
    targetId: {
      $in: uniqueIds
    }
  });

  await sendPushToSubscriptions(subscriptions, payload);
}

async function sendPushToAdminsForClass(className, payload) {
  const subscriptions = await PushSubscription.find({
    targetType: "admin",
    $or: [
      {
        role: "super_admin"
      },
      {
        role: "admin",
        className
      }
    ]
  });

  await sendPushToSubscriptions(subscriptions, {
    ...payload,
    url: payload.url || "/admin-dashboard.html"
  });
}

module.exports = {
  sendPushToStudent,
  sendPushToStudents,
  sendPushToAdminsForClass
};