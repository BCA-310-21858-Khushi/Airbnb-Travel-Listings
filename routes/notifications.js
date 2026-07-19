const express = require("express");
const router = express.Router();

const Notification = require("../models/notification.js");
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn } = require("../middleware.js");

// Show notifications + mark as read
router.get(
  "/",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true }
    );

    const notifications = await Notification.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    res.locals.unreadNotifications = 0;

    res.render("notifications/index.ejs", { notifications });
  })
);

// Delete single notification
router.delete(
  "/:notificationId",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { notificationId } = req.params;

    await Notification.findOneAndDelete({
      _id: notificationId,
      user: req.user._id,
    });

    req.flash("success", "Notification deleted!");
    res.redirect("/notifications");
  })
);

// Clear all notifications
router.delete(
  "/",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    await Notification.deleteMany({
      user: req.user._id,
    });

    req.flash("success", "All notifications cleared!");
    res.redirect("/notifications");
  })
);

module.exports = router;