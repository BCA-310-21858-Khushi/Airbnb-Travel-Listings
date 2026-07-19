const express = require("express");
const router = express.Router({ mergeParams: true });
const Razorpay = require("razorpay");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

const Booking = require("../models/booking.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");
const Notification = require("../models/notification.js");
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isHost } = require("../middleware.js");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const GST_RATE = 0.18;

const updateBookingStatuses = async (bookings) => {
  const today = new Date();

  for (let booking of bookings) {
    if (
      booking.status !== "Cancelled" &&
      booking.status !== "Completed" &&
      booking.checkOut < today
    ) {
      booking.status = "Completed";

      if (booking.paymentMethod === "Cash on Arrival") {
        booking.paymentStatus = "Paid";
      }

      await booking.save();
    }
  }
};

const sendBookingConfirmationEmail = async (user, listing, booking) => {
  try {
    if (!user || !user.email) return;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "WanderLust Booking Confirmed",
      html: `
        <h2>Booking Confirmed 🎉</h2>
        <p>Hello <b>${user.username}</b>,</p>
        <p>Your booking has been confirmed successfully.</p>
        <hr>
        <h3>${listing.title}</h3>
        <p><b>Location:</b> ${listing.location}, ${listing.country}</p>
        <p><b>Check-in:</b> ${new Date(booking.checkIn).toDateString()}</p>
        <p><b>Check-out:</b> ${new Date(booking.checkOut).toDateString()}</p>
        <p><b>Guests:</b> ${booking.guests}</p>
        <p><b>Base Price:</b> ₹${booking.basePrice.toLocaleString("en-IN")}</p>
        <p><b>GST (18%):</b> ₹${booking.gstAmount.toLocaleString("en-IN")}</p>
        <p><b>Total Price:</b> ₹${booking.totalPrice.toLocaleString("en-IN")}</p>
        <p><b>Payment Method:</b> ${booking.paymentMethod}</p>
        <p><b>Payment Status:</b> ${booking.paymentStatus}</p>
        <hr>
        <p>Thank you for booking with WanderLust.</p>
        <br>
        <p>
          Regards,<br>
          <b>Team WanderLust</b><br>
          Explore Amazing Stays
        </p>
      `,
    });
  } catch (err) {
    console.log("Booking email error:", err.message);
  }
};

const sendBookingCancellationEmail = async (user, listing, booking) => {
  try {
    if (!user || !user.email) return;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "WanderLust Booking Cancelled",
      html: `
        <h2>Booking Cancelled ❌</h2>
        <p>Hello <b>${user.username}</b>,</p>
        <p>Your booking has been cancelled successfully.</p>
        <hr>
        <h3>${listing.title}</h3>
        <p><b>Location:</b> ${listing.location}, ${listing.country}</p>
        <p><b>Check-in:</b> ${new Date(booking.checkIn).toDateString()}</p>
        <p><b>Check-out:</b> ${new Date(booking.checkOut).toDateString()}</p>
        <p><b>Guests:</b> ${booking.guests}</p>
        <p><b>Total Amount:</b> ₹${booking.totalPrice.toLocaleString("en-IN")}</p>
        <p><b>Payment Method:</b> ${booking.paymentMethod}</p>
        <p><b>Payment Status:</b> ${booking.paymentStatus}</p>
        <hr>
        <p>We hope to host you again soon on WanderLust.</p>
        <br>
        <p>
          Regards,<br>
          <b>Team WanderLust</b><br>
          Explore Amazing Stays
        </p>
      `,
    });
  } catch (err) {
    console.log("Cancellation email error:", err.message);
  }
};

// Create Booking: Cash OR Razorpay
router.post(
  "/",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { checkIn, checkOut, guests } = req.body.booking;
    const { paymentType } = req.body;

    const listing = await Listing.findById(id);

    if (!listing) {
      req.flash("error", "Listing not found!");
      return res.redirect("/listings");
    }

    const start = new Date(checkIn);
    const end = new Date(checkOut);

    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    if (nights <= 0) {
      req.flash("error", "Check-out date must be after check-in date!");
      return res.redirect(`/listings/${id}`);
    }

    const basePrice = nights * listing.price;
    const gstAmount = Math.round(basePrice * GST_RATE);
    const totalPrice = basePrice + gstAmount;

    const existingBooking = await Booking.findOne({
      listing: id,
      status: { $ne: "Cancelled" },
      checkIn: { $lt: end },
      checkOut: { $gt: start },
    });

    if (existingBooking) {
      req.flash("error", "This listing is already booked for the selected dates!");
      return res.redirect(`/listings/${id}`);
    }

    if (paymentType === "cash") {
      const newBooking = new Booking({
        listing: id,
        user: req.user._id,
        checkIn,
        checkOut,
        guests,
        basePrice,
        gstAmount,
        totalPrice,
        status: "Confirmed",
        paymentStatus: "Pending",
        paymentMethod: "Cash on Arrival",
      });

      await newBooking.save();

      const currentUser = await User.findById(req.user._id);
      await sendBookingConfirmationEmail(currentUser, listing, newBooking);

      await Notification.create({
        user: req.user._id,
        message: `Your booking for "${listing.title}" has been confirmed.`,
        link: "/bookings/my-bookings",
        type: "booking",
      });

      if (listing.owner) {
        await Notification.create({
          user: listing.owner,
          message: `${req.user.username} booked your listing "${listing.title}".`,
          link: "/bookings/owner-dashboard",
          type: "booking",
        });
      }

      req.flash("success", "Booking confirmed! Confirmation email sent.");
      return res.redirect("/bookings/my-bookings");
    }

    const options = {
      amount: totalPrice * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    req.session.pendingBooking = {
      listing: id,
      user: req.user._id,
      checkIn,
      checkOut,
      guests,
      basePrice,
      gstAmount,
      totalPrice,
      razorpayOrderId: order.id,
    };

    res.render("bookings/payment.ejs", {
      listing,
      order,
      totalPrice,
      keyId: process.env.RAZORPAY_KEY_ID,
      currUser: req.user,
    });
  })
);

// Verify Razorpay Payment
router.post(
  "/verify-payment",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      req.flash("error", "Payment verification failed!");
      return res.redirect("/listings");
    }

    const pendingBooking = req.session.pendingBooking;

    if (!pendingBooking) {
      req.flash("error", "Booking session expired!");
      return res.redirect("/listings");
    }

    const listing = await Listing.findById(pendingBooking.listing);

    const newBooking = new Booking({
      listing: pendingBooking.listing,
      user: pendingBooking.user,
      checkIn: pendingBooking.checkIn,
      checkOut: pendingBooking.checkOut,
      guests: pendingBooking.guests,
      basePrice: pendingBooking.basePrice,
      gstAmount: pendingBooking.gstAmount,
      totalPrice: pendingBooking.totalPrice,
      status: "Confirmed",
      paymentStatus: "Paid",
      paymentMethod: "Razorpay",
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
    });

    await newBooking.save();

    const currentUser = await User.findById(req.user._id);
    await sendBookingConfirmationEmail(currentUser, listing, newBooking);

    await Notification.create({
      user: req.user._id,
      message: `Payment successful! Your booking for "${listing.title}" is confirmed.`,
      link: "/bookings/my-bookings",
      type: "payment",
    });

    if (listing.owner) {
      await Notification.create({
        user: listing.owner,
        message: `${req.user.username} booked and paid for your listing "${listing.title}".`,
        link: "/bookings/owner-dashboard",
        type: "payment",
      });
    }

    req.session.pendingBooking = null;

    req.flash("success", "Payment successful! Booking confirmed and email sent.");
    res.redirect("/bookings/my-bookings");
  })
);

// Get booked dates for calendar
router.get(
  "/booked-dates",
  wrapAsync(async (req, res) => {
    const { id } = req.params;

    const bookings = await Booking.find({
      listing: id,
      status: { $ne: "Cancelled" },
    });

    const bookedDates = bookings.map((booking) => ({
      from: booking.checkIn.toISOString().split("T")[0],
      to: booking.checkOut.toISOString().split("T")[0],
    }));

    res.json(bookedDates);
  })
);

// My Bookings
router.get(
  "/my-bookings",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    let bookings = await Booking.find({
      user: req.user._id,
    }).populate("listing");

    await updateBookingStatuses(bookings);

    bookings = await Booking.find({
      user: req.user._id,
    }).populate("listing");

    res.render("bookings/index.ejs", { bookings });
  })
);

// Invoice Page
router.get(
  "/:bookingId/invoice",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
      .populate("listing")
      .populate("user");

    if (!booking) {
      req.flash("error", "Booking not found!");
      return res.redirect("/bookings/my-bookings");
    }

    if (!booking.user._id.equals(req.user._id)) {
      req.flash("error", "You are not allowed to view this invoice!");
      return res.redirect("/bookings/my-bookings");
    }

    res.render("bookings/invoice.ejs", { booking });
  })
);

// Download Invoice PDF
router.get(
  "/:bookingId/invoice/download",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
      .populate("listing")
      .populate("user");

    if (!booking) {
      req.flash("error", "Booking not found!");
      return res.redirect("/bookings/my-bookings");
    }

    if (!booking.user._id.equals(req.user._id)) {
      req.flash("error", "You are not allowed to download this invoice!");
      return res.redirect("/bookings/my-bookings");
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Invoice_${booking._id}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(24).fillColor("#dc3545").text("WanderLust", { align: "center" });
    doc.fontSize(12).fillColor("gray").text("Booking Receipt / Invoice", { align: "center" });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    doc.fillColor("black").fontSize(12);
    doc.text(`Booking ID: ${booking._id}`);
    doc.text(`Guest Name: ${booking.user.username}`);
    doc.text(`Property: ${booking.listing.title}`);
    doc.text(`Location: ${booking.listing.location}, ${booking.listing.country}`);

    doc.moveDown();

    doc.text(`Check In: ${booking.checkIn.toDateString()}`);
    doc.text(`Check Out: ${booking.checkOut.toDateString()}`);
    doc.text(`Guests: ${booking.guests}`);

    doc.moveDown();

    doc.text(`Payment Method: ${booking.paymentMethod || "Cash on Arrival"}`);
    doc.text(`Payment Status: ${booking.paymentStatus}`);

    doc.moveDown();

    doc.text(`Base Price: INR ${(booking.basePrice || 0).toLocaleString("en-IN")}`);
    doc.text(`GST (18%): INR ${(booking.gstAmount || 0).toLocaleString("en-IN")}`);

    doc
      .fontSize(16)
      .fillColor("#dc3545")
      .text(`Total Amount: INR ${booking.totalPrice.toLocaleString("en-IN")}`);

    doc.moveDown();
    doc.fillColor("black").fontSize(12);
    doc.text("This is a system-generated invoice.");
    doc.text("Regards,");
    doc.text("Team WanderLust");
    doc.text("Explore Amazing Stays");

    doc.end();
  })
);

// Host Dashboard
router.get(
  "/owner-dashboard",
  isLoggedIn,
  isHost,
  wrapAsync(async (req, res) => {
    const ownerListings = await Listing.find({ owner: req.user._id });
    const listingIds = ownerListings.map((listing) => listing._id);

    let bookings = await Booking.find({
      listing: { $in: listingIds },
    })
      .populate("listing")
      .populate("user");

    await updateBookingStatuses(bookings);

    bookings = await Booking.find({
      listing: { $in: listingIds },
    })
      .populate("listing")
      .populate("user");

    res.render("bookings/ownerDashboard.ejs", { bookings });
  })
);

// Cancel Booking
router.delete(
  "/:bookingId",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      req.flash("error", "Booking not found!");
      return res.redirect("/bookings/my-bookings");
    }

    if (!booking.user.equals(req.user._id)) {
      req.flash("error", "You are not allowed to cancel this booking!");
      return res.redirect("/bookings/my-bookings");
    }

    booking.status = "Cancelled";
    await booking.save();

    const currentUser = await User.findById(req.user._id);
    const listing = await Listing.findById(booking.listing);

    await sendBookingCancellationEmail(currentUser, listing, booking);

    await Notification.create({
      user: req.user._id,
      message: `Your booking for "${listing.title}" has been cancelled.`,
      link: "/bookings/my-bookings",
      type: "cancel",
    });

    if (listing.owner) {
      await Notification.create({
        user: listing.owner,
        message: `${req.user.username} cancelled the booking for "${listing.title}".`,
        link: "/bookings/owner-dashboard",
        type: "cancel",
      });
    }

    req.flash("success", "Booking cancelled successfully! Cancellation email sent.");
    res.redirect("/bookings/my-bookings");
  })
);

module.exports = router;