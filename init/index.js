const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log("Connected to DB");
}

main();

const initDB = async () => {
  await Listing.deleteMany({}); // purana data delete
  await Listing.insertMany(initData.data); // naya data insert
  console.log("Data initialized");
};

initDB();