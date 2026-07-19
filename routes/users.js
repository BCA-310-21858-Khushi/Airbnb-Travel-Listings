const express = require("express");
const router = express.Router();
const passport = require("passport");

const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });

const userController = require("../controllers/users.js");
const { isLoggedIn, isHost } = require("../middleware.js");

// ======================= SIGNUP =======================

router
  .route("/signup")
  .get(userController.renderSignupForm)
  .post(userController.sendOtp);

router
  .route("/verify-otp")
  .get(userController.renderOtpForm)
  .post(userController.verifyOtp);

// ======================= USER LOGIN =======================

router
  .route("/login")
  .get(userController.renderLoginForm)
  .post(
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true,
    }),
    userController.login
  );

// ======================= HOST LOGIN =======================

router
  .route("/host/login")
  .get(userController.renderHostLoginForm)
  .post(
    passport.authenticate("local", {
      failureRedirect: "/host/login",
      failureFlash: true,
    }),
    userController.hostLogin
  );

// ======================= ADMIN LOGIN =======================

router
  .route("/admin/login")
  .get(userController.renderAdminLoginForm)
  .post(
    passport.authenticate("local", {
      failureRedirect: "/admin/login",
      failureFlash: true,
    }),
    userController.adminLogin
  );

// ======================= PROFILE =======================

router.get("/profile", isLoggedIn, userController.profile);

router.post(
  "/profile/photo",
  isLoggedIn,
  upload.single("profileImage"),
  userController.updateProfileImage
);

router.post(
  "/become-host",
  isLoggedIn,
  userController.becomeHost
);

// ======================= MY LISTINGS =======================

router.get(
  "/my-listings",
  isLoggedIn,
  isHost,
  userController.myListings
);

// ======================= LOGOUT =======================

router.get("/logout", userController.logout);

module.exports = router;