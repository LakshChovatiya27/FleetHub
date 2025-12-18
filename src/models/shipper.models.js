import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const shipperSchema = new Schema(
  {
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    contactEmail: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    contactNumber: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
      default: null,
    },
    address: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
    },
    gstNumber: {
      type: String,
      required: true,
      unique: true,
    },
    industryType: {
      type: String,
      enum: [
        "Agriculture",
        "Textiles",
        "Electronics",
        "Chemicals",
        "Automotive",
        "FMCG",
        "Pharmaceuticals",
        "Construction",
        "Retail",
        "Other",
      ],
      required: true,
    },
    refreshToken: {
      type: String,
    }
  },
  { timestamps: true }
);

shipperSchema.pre("save", async function (next) {
  if (!this.isModified("password")) next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

shipperSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

shipperSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      role: "shipper",
      contactEmail: this.contactEmail,
      gstNumber: this.gstNumber,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

shipperSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      role: "shipper",
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

const Shipper = mongoose.model("Shipper", shipperSchema);

export default Shipper;
