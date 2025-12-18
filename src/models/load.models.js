import mongoose, { Schema } from "mongoose";

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
        "PICKUP_SMALL",
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
      name: { type: String },
      phone: { type: String }
    },
    status: {
      type: String,
      enum: ["CREATED", "ASSIGNED", "IN_TRANSIT", "DELIVERED"],
      default: "CREATED",
    },
  },
  { timestamps: true }
);

const Load = mongoose.model("Load", loadSchema);

export default Load