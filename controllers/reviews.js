const Listing = require("../models/listing.js");
const Review = require("../models/review.js");
const Notification = require("../models/notification.js");

module.exports.createReview = async (req, res) => {
  let listing = await Listing.findById(req.params.id);
  let newReview = new Review(req.body.review);

  newReview.author = req.user._id;

  listing.reviews.push(newReview);

  await newReview.save();
  await listing.save();

  if (listing.owner && !listing.owner.equals(req.user._id)) {
    await Notification.create({
      user: listing.owner,
      message: `${req.user.username} added a new review on your listing "${listing.title}".`,
      link: `/listings/${listing._id}`,
      type: "review",
    });
  }

  req.flash("success", "New review created!");
  res.redirect(`/listings/${listing._id}`);
};

module.exports.destroyReview = async (req, res) => {
  let { id, reviewId } = req.params;

  await Listing.findByIdAndUpdate(id, {
    $pull: { reviews: reviewId },
  });

  await Review.findByIdAndDelete(reviewId);

  req.flash("success", "Review deleted!");
  res.redirect(`/listings/${id}`);
};

module.exports.replyReview = async (req, res) => {
  const { id, reviewId } = req.params;
  const { reply } = req.body;

  const listing = await Listing.findById(id);
  const review = await Review.findById(reviewId);

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  if (!review) {
    req.flash("error", "Review not found!");
    return res.redirect(`/listings/${id}`);
  }

  if (!listing.owner.equals(req.user._id)) {
    req.flash("error", "Only listing owner can reply to reviews!");
    return res.redirect(`/listings/${id}`);
  }

  review.ownerReply = {
    text: reply,
    repliedAt: new Date(),
  };

  await review.save();

  if (review.author && !review.author.equals(req.user._id)) {
    await Notification.create({
      user: review.author,
      message: `Host replied to your review on "${listing.title}".`,
      link: `/listings/${listing._id}`,
      type: "reply",
    });
  }

  req.flash("success", "Reply added successfully!");
  res.redirect(`/listings/${id}`);
};