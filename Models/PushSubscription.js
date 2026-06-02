const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ["student", "admin"],
      required: true
    },

    targetId: {
      type: String,
      required: true,
      trim: true
    },

    role: {
      type: String,
      default: ""
    },

    className: {
      type: String,
      default: ""
    },

    endpoint: {
      type: String,
      required: true,
      unique: true
    },

    keys: {
      p256dh: {
        type: String,
        required: true
      },
      auth: {
        type: String,
        required: true
      }
    },

    userAgent: {
      type: String,
      default: ""
    },

    lastUsedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.models.PushSubscription ||
  mongoose.model("PushSubscription", pushSubscriptionSchema);