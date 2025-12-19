import mongoose, { Schema } from "mongoose";

const vehicleSchema = new Schema(
  {
    carrier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Carrier",
      required: true,
    },
    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    vehicleType: {
      type: String,
      enum: [
        "TRAILER_FLATBED",
        "OPEN_BODY",
        "CLOSED_CONTAINER",
        "TANKER",
        "REFRIGERATED",
        "LCV",
      ],
      required: true,
    },
    capacityTons: {
      type: Number,
      default: 0,
    },
    capacityLitres: {
      type: Number,
      default: 0,
    },
    dimensions: {
      lengthFt: { type: Number, default: 0 },
      widthFt: { type: Number, default: 0 },
      heightFt: { type: Number, default: 0 },
    },
    manufacturingYear: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["AVAILABLE", "BIDDED", "BOOKED", "IN_TRANSIT", "MAINTENANCE"],
      default: "AVAILABLE",
    }
  },
  { timestamps: true }
);

const Vehicle = mongoose.model("Vehicle", vehicleSchema);

export default Vehicle;
