const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema(
  {
    comment: String,

    rating: {
      type: Number,
      min: 1,
      max: 5,
    },

    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    ownerReply: {
      text: String,
      repliedAt: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Review", reviewSchema);