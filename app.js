if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const Review = require("./models/review.js");
const Notification = require("./models/notification.js");
const path = require("path");
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const multer = require("multer");
const listingRouter = require("./routes/listings.js");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const { isLoggedIn, isOwner, isReviewAuthor } = require("./middleware.js");
const reviewRouter = require("./routes/reviews.js");
const userRouter = require("./routes/users.js");
const bookingRouter = require("./routes/bookings.js");
const wishlistRouter = require("./routes/wishlist.js");
const adminRouter = require("./routes/admin.js");
const notificationRouter = require("./routes/notifications.js");

const dbUrl = "mongodb://127.0.0.1:27017/wanderlust";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

const validateListing = (req, res, next) => {
  let { error } = listingSchema.validate(req.body);

  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

const validateReview = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body);

  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

async function main() {
  await mongoose.connect(dbUrl);
}

main()
  .then(() => console.log("connected to DB"))
  .catch((err) => console.log(err));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser("secretcode"));

const sessionOptions = {
  secret: "mysupersecretcode",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(async (req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");

  if (req.user) {
    const freshUser = await User.findById(req.user._id);

    res.locals.currUser = freshUser;

    res.locals.unreadNotifications = await Notification.countDocuments({
      user: freshUser._id,
      isRead: false,
    });
  } else {
    res.locals.currUser = null;
    res.locals.unreadNotifications = 0;
  }

  next();
});

app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/listings/:id/bookings", bookingRouter);
app.use("/bookings", bookingRouter);
app.use("/wishlist", wishlistRouter);
app.use("/admin", adminRouter);
app.use("/notifications", notificationRouter);
app.use("/", userRouter);

app.get("/", (req, res) => {
  res.redirect("/listings");
});

app.get("/setcookie", (req, res) => {
  res.cookie("username", "Khushi");
  res.send("Cookie Set Successfully");
});

app.get("/getcookies", (req, res) => {
  res.send(req.cookies);
});

app.get("/getsignedcookie", (req, res) => {
  res.cookie("fruit", "mango", { signed: true });
  res.send("Signed Cookie Sent");
});

app.get("/verify", (req, res) => {
  res.send(req.signedCookies);
});

app.get("/flash-test", (req, res) => {
  req.flash("success", "Flash message working!");
  res.redirect("/listings");
});

app.get("/test", (req, res) => {
  req.session.name = "Khushi";
  res.send("Session Data Saved");
});

app.get("/hello", (req, res) => {
  res.send(req.session.name || "No Session Found");
});

// 404
app.use((req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

// ERROR HANDLER
app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something went wrong" } = err;
  res.status(statusCode).send(message);
});

app.listen(8080, () => {
  console.log("server running on port 8080");
});