const User = require("../models/user.js");
const Listing = require("../models/listing.js");
const nodemailer = require("nodemailer");
const Booking = require("../models/booking.js");

module.exports.renderSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

module.exports.sendOtp = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ username });

    if (existingUser) {
      req.flash("error", "Username already exists!");
      return res.redirect("/signup");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    req.session.signupData = {
      username,
      email,
      password,
      otp,
      otpExpires: Date.now() + 5 * 60 * 1000,
    };

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "WanderLust Email Verification OTP",
      html: `
        <h2>Welcome to WanderLust</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP is valid for 5 minutes.</p>
      `,
    });

    req.flash("success", "OTP sent to your email!");
    res.redirect("/verify-otp");
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/signup");
  }
};

module.exports.renderOtpForm = (req, res) => {
  if (!req.session.signupData) {
    req.flash("error", "Please signup first!");
    return res.redirect("/signup");
  }

  res.render("users/verifyOtp.ejs");
};

module.exports.verifyOtp = async (req, res, next) => {
  try {
    const { otp } = req.body;

    if (!req.session.signupData) {
      req.flash("error", "Session expired. Please signup again!");
      return res.redirect("/signup");
    }

    const { username, email, password, otp: savedOtp, otpExpires } =
      req.session.signupData;

    if (Date.now() > otpExpires) {
      req.session.signupData = null;
      req.flash("error", "OTP expired. Please signup again!");
      return res.redirect("/signup");
    }

    if (otp !== savedOtp) {
      req.flash("error", "Invalid OTP!");
      return res.redirect("/verify-otp");
    }

    const newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password);

    req.session.signupData = null;

    req.login(registeredUser, (err) => {
      if (err) return next(err);

      req.flash("success", "Email verified! Welcome to WanderLust!");
      res.redirect("/listings");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/signup");
  }
};

module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs", {
    portal: "user",
    title: "User Login",
    action: "/login",
  });
};

module.exports.renderHostLoginForm = (req, res) => {
  res.render("users/login.ejs", {
    portal: "host",
    title: "Host Login",
    action: "/host/login",
  });
};

module.exports.renderAdminLoginForm = (req, res) => {
  res.render("users/login.ejs", {
    portal: "admin",
    title: "Admin Login",
    action: "/admin/login",
  });
};

module.exports.login = async (req, res) => {
  if (req.user.role === "admin") {
    req.flash("success", "Welcome Admin!");
    return res.redirect("/admin");
  }

  if (req.user.role === "host") {
    req.flash("success", "Welcome Host!");
    return res.redirect("/bookings/owner-dashboard");
  }

  req.flash("success", "Welcome back to WanderLust!");
  res.redirect("/listings");
};

module.exports.hostLogin = async (req, res) => {
  if (req.user.role !== "host" && req.user.role !== "admin") {
    req.logout(() => {});
    req.flash("error", "You are not a host yet. Please become a host first.");
    return res.redirect("/login");
  }

  req.flash("success", "Welcome to Host Portal!");
  res.redirect("/bookings/owner-dashboard");
};

module.exports.adminLogin = async (req, res) => {
  if (req.user.role !== "admin") {
    req.logout(() => {});
    req.flash("error", "Admin access only!");
    return res.redirect("/login");
  }

  req.flash("success", "Welcome to Admin Portal!");
  res.redirect("/admin");
};

module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    req.flash("success", "You are logged out!");
    res.redirect("/listings");
  });
};

module.exports.myListings = async (req, res) => {
  const listings = await Listing.find({ owner: req.user._id });
  res.render("users/myListings.ejs", { listings });
};

module.exports.profile = async (req, res) => {
  const user = await User.findById(req.user._id).populate("wishlist");

  const listingsCount = await Listing.countDocuments({
    owner: req.user._id,
  });

  const bookingsCount = await Booking.countDocuments({
    user: req.user._id,
  });

  res.render("users/profile.ejs", {
    user,
    listingsCount,
    bookingsCount,
    wishlistCount: user.wishlist.length,
  });
};

module.exports.updateProfileImage = async (req, res) => {
  if (!req.file) {
    req.flash("error", "Please upload an image!");
    return res.redirect("/profile");
  }

  await User.findByIdAndUpdate(req.user._id, {
    profileImage: {
      url: req.file.path,
      filename: req.file.filename,
    },
  });

  req.flash("success", "Profile photo updated successfully!");
  res.redirect("/profile");
};

module.exports.becomeHost = async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    role: "host",
  });

  req.flash("success", "Congratulations! You are now a host.");
  res.redirect("/profile");
};