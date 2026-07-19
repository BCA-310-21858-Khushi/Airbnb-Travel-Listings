const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");

const User = require("../models/user.js");
const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isAdmin } = require("../middleware.js");

// Admin Dashboard
router.get(
  "/",
  isLoggedIn,
  isAdmin,
  wrapAsync(async (req, res) => {
    const users = await User.find({});
    const listings = await Listing.find({}).populate("owner");
    const bookings = await Booking.find({})
      .populate("listing")
      .populate("user");

    const totalUsers = users.length;
    const totalListings = listings.length;
    const totalBookings = bookings.length;

    let totalRevenue = 0;
    let paidBookings = 0;
    let pendingPayments = 0;
    let cancelledBookings = 0;

    bookings.forEach((booking) => {
      totalRevenue += booking.totalPrice || 0;

      if (booking.paymentStatus === "Paid") paidBookings++;
      if (booking.paymentStatus === "Pending") pendingPayments++;
      if (booking.status === "Cancelled") cancelledBookings++;
    });

    const monthlyRevenue = Array(12).fill(0);

    bookings.forEach((booking) => {
      if (booking.status !== "Cancelled") {
        const month = new Date(booking.createdAt).getMonth();
        monthlyRevenue[month] += booking.totalPrice || 0;
      }
    });

    res.render("admin/dashboard.ejs", {
      users,
      listings,
      bookings,
      totalUsers,
      totalListings,
      totalBookings,
      totalRevenue,
      paidBookings,
      pendingPayments,
      cancelledBookings,
      monthlyRevenue,
    });
  })
);

// Download Booking Report PDF
router.get(
  "/reports/bookings",
  isLoggedIn,
  isAdmin,
  wrapAsync(async (req, res) => {
    const bookings = await Booking.find({})
      .populate("user")
      .populate("listing")
      .sort({ createdAt: -1 });

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=WanderLust_Booking_Report.pdf"
    );

    doc.pipe(res);

    doc
      .fontSize(22)
      .fillColor("#dc3545")
      .text("WanderLust Booking Report", { align: "center" });

    doc
      .fontSize(10)
      .fillColor("gray")
      .text(`Generated on: ${new Date().toLocaleString()}`, {
        align: "center",
      });

    doc.moveDown(2);

    bookings.forEach((booking, index) => {
      doc.fillColor("black").fontSize(12);

      doc.text(`${index + 1}. Booking ID: ${booking._id}`);
      doc.text(`Guest: ${booking.user ? booking.user.username : "Unknown"}`);
      doc.text(
        `Listing: ${
          booking.listing ? booking.listing.title : "Deleted Listing"
        }`
      );
      doc.text(`Check In: ${booking.checkIn.toDateString()}`);
      doc.text(`Check Out: ${booking.checkOut.toDateString()}`);
      doc.text(`Guests: ${booking.guests}`);
      doc.text(`Payment Method: ${booking.paymentMethod}`);
      doc.text(`Payment Status: ${booking.paymentStatus}`);
      doc.text(`Booking Status: ${booking.status}`);
      doc.text(
        `Total Amount: INR ${booking.totalPrice.toLocaleString("en-IN")}`
      );

      doc.moveDown();
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#ddd").stroke();
      doc.moveDown();

      if (doc.y > 700) {
        doc.addPage();
      }
    });

    doc.end();
  })
);

// Admin Delete Listing
router.delete(
  "/listings/:id",
  isLoggedIn,
  isAdmin,
  wrapAsync(async (req, res) => {
    const { id } = req.params;

    await Listing.findByIdAndDelete(id);

    req.flash("success", "Listing deleted by admin successfully!");
    res.redirect("/admin");
  })
);

// Download Users Report PDF
router.get(
  "/reports/users",
  isLoggedIn,
  isAdmin,
  wrapAsync(async (req, res) => {
    const users = await User.find({});

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=WanderLust_Users_Report.pdf"
    );

    doc.pipe(res);

    doc
      .fontSize(22)
      .fillColor("#0d6efd")
      .text("WanderLust Users Report", {
        align: "center",
      });

    doc.moveDown();

    users.forEach((user, index) => {
      doc.fontSize(12).fillColor("black");

      doc.text(`${index + 1}. Username : ${user.username}`);
      doc.text(`Email : ${user.email}`);
      doc.text(`Role : ${user.role}`);
      doc.text(
        `Joined : ${new Date(user.createdAt).toLocaleDateString()}`
      );

      doc.moveDown();
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown();
    });

    doc.end();
  })
);
// Download Listings Report PDF
router.get(
  "/reports/listings",
  isLoggedIn,
  isAdmin,
  wrapAsync(async (req, res) => {
    const listings = await Listing.find({}).populate("owner");

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=WanderLust_Listings_Report.pdf"
    );

    doc.pipe(res);

    doc
      .fontSize(22)
      .fillColor("#198754")
      .text("WanderLust Listings Report", {
        align: "center",
      });

    doc.moveDown();

    listings.forEach((listing, index) => {
      doc.fontSize(12).fillColor("black");

      doc.text(`${index + 1}. Title: ${listing.title}`);
      doc.text(`Owner: ${listing.owner?.username || "Unknown"}`);
      doc.text(`Location: ${listing.location}`);
      doc.text(`Country: ${listing.country}`);
      doc.text(`Price: ₹${listing.price}`);

      doc.moveDown();

      doc
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .stroke();

      doc.moveDown();

      if (doc.y > 700) {
        doc.addPage();
      }
    });

    doc.end();
  })
);


// Download Revenue Report PDF
router.get(
  "/reports/revenue",
  isLoggedIn,
  isAdmin,
  wrapAsync(async (req, res) => {
    const bookings = await Booking.find({});

    let totalRevenue = 0;
    let paidBookings = 0;
    let pendingPayments = 0;
    let cancelledBookings = 0;

    bookings.forEach((booking) => {
      if (booking.status !== "Cancelled") {
        totalRevenue += booking.totalPrice || 0;
      }

      if (booking.paymentStatus === "Paid") paidBookings++;
      if (booking.paymentStatus === "Pending") pendingPayments++;
      if (booking.status === "Cancelled") cancelledBookings++;
    });

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=WanderLust_Revenue_Report.pdf"
    );

    doc.pipe(res);

    doc
      .fontSize(24)
      .fillColor("#f39c12")
      .text("WanderLust Revenue Report", {
        align: "center",
      });

    doc.moveDown();

    doc
      .fontSize(11)
      .fillColor("gray")
      .text(`Generated On : ${new Date().toLocaleString()}`);

    doc.moveDown(2);

    doc.fontSize(16).fillColor("black");

    doc.text(`Total Revenue : ₹${totalRevenue.toLocaleString("en-IN")}`);
    doc.moveDown();

    doc.text(`Total Bookings : ${bookings.length}`);
    doc.moveDown();

    doc.text(`Paid Bookings : ${paidBookings}`);
    doc.moveDown();

    doc.text(`Pending Payments : ${pendingPayments}`);
    doc.moveDown();

    doc.text(`Cancelled Bookings : ${cancelledBookings}`);

    doc.moveDown(2);

    doc
      .fontSize(13)
      .fillColor("#198754")
      .text("Report generated successfully from WanderLust Admin Dashboard.");

    doc.end();
  })
);

// Download Complete Project Report
router.get(
  "/reports/project",
  isLoggedIn,
  isAdmin,
  wrapAsync(async (req, res) => {
    const users = await User.countDocuments();
    const listings = await Listing.countDocuments();
    const bookings = await Booking.find({});

    let revenue = 0;

    bookings.forEach((booking) => {
      if (booking.status !== "Cancelled") {
        revenue += booking.totalPrice || 0;
      }
    });

    const doc = new PDFDocument({
      margin: 40,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=WanderLust_Project_Report.pdf"
    );

    doc.pipe(res);

    doc
      .fontSize(26)
      .fillColor("#dc3545")
      .text("WanderLust Project Report", {
        align: "center",
      });

    doc.moveDown();

    doc
      .fontSize(12)
      .fillColor("gray")
      .text(`Generated On : ${new Date().toLocaleString()}`);

    doc.moveDown(2);

    doc.fontSize(18).fillColor("black").text("Project Summary");

    doc.moveDown();

    doc.fontSize(13);

    doc.text(`Total Users : ${users}`);
    doc.text(`Total Listings : ${listings}`);
    doc.text(`Total Bookings : ${bookings.length}`);
    doc.text(`Total Revenue : ₹${revenue.toLocaleString("en-IN")}`);

    doc.moveDown(2);

    doc.fontSize(18).text("Technology Stack");

    doc.moveDown();

    doc.fontSize(13);

    doc.text("• Node.js");
    doc.text("• Express.js");
    doc.text("• MongoDB");
    doc.text("• Mongoose");
    doc.text("• EJS");
    doc.text("• Bootstrap");
    doc.text("• Passport.js");
    doc.text("• Cloudinary");
    doc.text("• Multer");
    doc.text("• PDFKit");

    doc.moveDown(2);

    doc.fontSize(18).text("Major Features");

    doc.moveDown();

    doc.fontSize(13);

    doc.text("✓ User Authentication");
    doc.text("✓ Email OTP Verification");
    doc.text("✓ Host Dashboard");
    doc.text("✓ Admin Dashboard");
    doc.text("✓ Wishlist");
    doc.text("✓ Booking System");
    doc.text("✓ Revenue Tracking");
    doc.text("✓ Notifications");
    doc.text("✓ Dark / Light Theme");
    doc.text("✓ Profile Photo Upload");
    doc.text("✓ PDF Report Generation");

    doc.moveDown(2);

    doc
      .fontSize(14)
      .fillColor("#198754")
      .text("Generated successfully from WanderLust Admin Dashboard.");

    doc.end();
  })
);
module.exports = router;