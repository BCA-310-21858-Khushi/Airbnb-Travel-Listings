const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

const imageSchema = new Schema({
  filename: String,
  url: {
    type: String,
    required: true,
  },
});

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    required: true,
  },

  // Old single image support
  image: {
    filename: String,
    url: String,
  },

  // New multiple images support
  images: {
    type: [imageSchema],
    default: [],
  },

  price: {
    type: Number,
    required: true,
    min: 1,
  },

  location: {
    type: String,
    required: true,
  },

  category: {
    type: String,
    required: true,
    default: "Apartment",
  },

  country: {
    type: String,
    required: true,
  },

  amenities: {
    type: [String],
    default: [],
  },

  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],

  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },

  geometry: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      default: [85.1376, 25.5941],
    },
  },
});

listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing) {
    await Review.deleteMany({
      _id: { $in: listing.reviews },
    });
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;