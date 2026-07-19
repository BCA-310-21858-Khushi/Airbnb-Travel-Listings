const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const notificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    link: {
      type: String,
      default: "/",
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    type: {
      type: String,
      default: "info",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);