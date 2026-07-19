const Listing = require("../models/listing.js");
const ExpressError = require("../utils/ExpressError.js");

async function geocodeLocation(location, country) {
  const query = encodeURIComponent(`${location}, ${country}`);

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
    {
      headers: {
        "User-Agent": "WanderLustProject/1.0",
      },
    }
  );

  const data = await response.json();

  if (data.length === 0) {
    return [85.1376, 25.5941];
  }

  return [Number(data[0].lon), Number(data[0].lat)];
}

module.exports.index = async (req, res) => {
  let { q, sort, minPrice, maxPrice, category } = req.query;

  let filter = {};

  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { location: { $regex: q, $options: "i" } },
      { country: { $regex: q, $options: "i" } },
    ];
  }

  if (category) filter.category = category;

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  let query = Listing.find(filter).populate("reviews");

  if (sort === "low") query = query.sort({ price: 1 });
  else if (sort === "high") query = query.sort({ price: -1 });

  const allListings = await query;

  res.render("listings/index.ejs", {
    allListings,
    q,
    sort,
    minPrice,
    maxPrice,
    category,
  });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
  let { id } = req.params;

  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");

  if (!listing) {
    throw new ExpressError(404, "Listing not found");
  }

  res.render("listings/show.ejs", { listing });
};

module.exports.createListing = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new ExpressError(400, "At least one image is required");
  }

  const newListing = new Listing(req.body.listing);

  newListing.owner = req.user._id;

  newListing.images = req.files.map((file) => ({
    url: file.path,
    filename: file.filename,
  }));

  const coordinates = await geocodeLocation(
    newListing.location,
    newListing.country
  );

  newListing.geometry = {
    type: "Point",
    coordinates: coordinates,
  };

  await newListing.save();

  req.flash("success", "New listing created!");
  res.redirect("/listings");
};

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);

  res.render("listings/edit.ejs", { listing });
};

module.exports.updateListing = async (req, res) => {
  let { id } = req.params;

  if (!req.body.listing.amenities) {
    req.body.listing.amenities = [];
  }

  let listing = await Listing.findByIdAndUpdate(
    id,
    { ...req.body.listing },
    { new: true }
  );

  if (req.files && req.files.length > 0) {
    const newImages = req.files.map((file) => ({
      url: file.path,
      filename: file.filename,
    }));

    listing.images.push(...newImages);
    await listing.save();
  }

  req.flash("success", "Listing updated!");
  res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;

  await Listing.findOneAndDelete({ _id: id });

  req.flash("success", "Listing deleted!");
  res.redirect("/listings");
};