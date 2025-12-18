import mongoose, { Schema } from "mongoose";

const bidSchema = new Schema(
  {
    load: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Load", 
      required: true 
    },
    carrier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Carrier",
      required: true,
    },
    bidAmount: { 
      type: Number, 
      required: true 
    },
    estimatedTransitTimeHours: { 
      type: Number, 
      required: true 
    },
    proposedVehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

const Bid = mongoose.model("Bid", bidSchema);

export default Bid;
