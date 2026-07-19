const express = require("express");
const router = express.Router();

const User = require("../models/user.js");
const Listing = require("../models/listing.js");
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn } = require("../middleware.js");

// Show Wishlist
router.get(
  "/",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.user._id).populate("wishlist");

    res.render("wishlist/index.ejs", {
      wishlist: user.wishlist,
    });
  })
);

// Add to Wishlist
router.post(
  "/:listingId",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { listingId } = req.params;

    const user = await User.findById(req.user._id);

    if (!user.wishlist.includes(listingId)) {
      user.wishlist.push(listingId);
      await user.save();
      req.flash("success", "Listing added to wishlist!");
    } else {
      req.flash("error", "Listing already in wishlist!");
    }

    res.redirect(`/listings/${listingId}`);
  })
);

// Remove from Wishlist
router.delete(
  "/:listingId",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { listingId } = req.params;

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { wishlist: listingId },
    });

    req.flash("success", "Listing removed from wishlist!");
    res.redirect("/wishlist");
  })
);

module.exports = router;