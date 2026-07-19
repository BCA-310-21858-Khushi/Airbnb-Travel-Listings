const Listing = require("./models/listing");
const Review = require("./models/review");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.flash("error", "You must be logged in first!");
    return res.redirect("/login");
  }

  next();
};

module.exports.isOwner = async (req, res, next) => {
  let { id } = req.params;

  let listing = await Listing.findById(id);

  if (!listing.owner) {
    req.flash(
      "error",
      "This old listing has no owner. Please create a new listing after login."
    );
    return res.redirect(`/listings/${id}`);
  }

  if (!listing.owner.equals(res.locals.currUser._id)) {
    req.flash("error", "You are not the owner of this listing!");
    return res.redirect(`/listings/${id}`);
  }

  next();
};

module.exports.isReviewAuthor = async (req, res, next) => {
  let { id, reviewId } = req.params;

  let review = await Review.findById(reviewId);

  if (!review.author.equals(res.locals.currUser._id)) {
    req.flash("error", "You are not the author of this review!");
    return res.redirect(`/listings/${id}`);
  }

  next();
};

module.exports.isAdmin = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.flash("error", "You must be logged in first!");
    return res.redirect("/login");
  }

  if (!req.user || req.user.role !== "admin") {
    req.flash("error", "Admin access required!");
    return res.redirect("/listings");
  }

  next();
};
module.exports.isHost = (req, res, next) => {
  if (!req.user || (req.user.role !== "host" && req.user.role !== "admin")) {
    req.flash("error", "Only hosts can access this page.");
    return res.redirect("/profile");
  }

  next();
};