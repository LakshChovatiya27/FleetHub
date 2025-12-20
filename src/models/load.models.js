import mongoose, { Schema } from "mongoose";
import ApiError from "../utils/apiError.js";

const loadSchema = new Schema(
  {
    shipper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipper",
      required: true,
    },
    pickupLocation: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
    },
    deliveryLocation: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
    },
    material: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      maxLength: 500 
    },
    weightInTons: {
      type: Number,
      default: 0,
    },
    volumeInLitres: {
      type: Number,
      default: 0,
    },
    requiredVehicleType: {
      type: [String],
      required: true,
      enum: [
        "OPEN_BODY",
        "CLOSED_CONTAINER",
        "TRAILER_FLATBED",
        "TANKER",
        "REFRIGERATED",
        "LCV",
      ],
      validate: [
        (val) => val.length > 0,
        "Please select at least one vehicle type",
      ],
    },
    budgetPrice: {
      type: Number,
      required: true,
    },
    biddingDeadline: {
      type: Date,
      required: true,
    },
    pickupDate: { 
      type: Date, 
      required: true 
    },
    expectedDeliveryDate: { 
      type: Date,
      required: true
    },
    selectedCarrier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Carrier",
      default: null,
    },
    assignedVehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      default: null,
    },
    driverDetails: {
      name: { type: String, default: null },
      phone: { type: String, default: null }
    },
    status: {
      type: String,
      enum: ["CREATED", "ASSIGNED", "IN_TRANSIT", "DELIVERED"],
      default: "CREATED",
    },
  },
  { timestamps: true }
);

loadSchema.pre("validate", function () {
  if (this.biddingDeadline >= this.pickupDate) {
    throw new ApiError(
      400,
      "Bidding deadline must be before pickup date"
    );
  }

  if (this.pickupDate >= this.expectedDeliveryDate) {
    throw new ApiError(
      400,
      "Pickup date must be before delivery date"
    );
  }
});

const Load = mongoose.model("Load", loadSchema);

export default Load