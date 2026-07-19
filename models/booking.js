const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema(
  {
    listing: {
      type: Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    checkIn: {
      type: Date,
      required: true,
    },

    checkOut: {
      type: Date,
      required: true,
    },

    guests: {
      type: Number,
      default: 1,
      min: 1,
    },

    basePrice: {
      type: Number,
      required: true,
      default: 0,
    },

    gstAmount: {
      type: Number,
      required: true,
      default: 0,
    },

    totalPrice: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      default: "Confirmed",
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Pending",
    },

    paymentMethod: {
      type: String,
      enum: ["Cash on Arrival", "Razorpay"],
      default: "Cash on Arrival",
    },

    razorpayPaymentId: String,

    razorpayOrderId: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);