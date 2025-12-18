import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";

const carrierSchema = new Schema(
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
    logo: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      required: true,
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
    fleetSize: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
    },
    totalTrips: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

carrierSchema.pre("save", async function (next) {
  if (!this.isModified("password")) next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

carrierSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const Carrier = mongoose.model("Carrier", carrierSchema);

export default Carrier;
