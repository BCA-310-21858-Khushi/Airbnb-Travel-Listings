const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let passportLocalMongoose = require("passport-local-mongoose");

if (passportLocalMongoose.default) {
  passportLocalMongoose = passportLocalMongoose.default;
}

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["user", "host", "admin"],
      default: "user",
    },

    profileImage: {
      url: {
        type: String,
        default:
          "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg",
      },
      filename: {
        type: String,
        default: "",
      },
    },

    wishlist: [
      {
        type: Schema.Types.ObjectId,
        ref: "Listing",
      },
    ],
  },
  { timestamps: true }
);

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);