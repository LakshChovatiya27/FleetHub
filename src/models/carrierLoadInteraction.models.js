import mongoose, {Schema} from "mongoose";

const carrierLoadInteractionSchema = new Schema(
  {
    carrier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Carrier",
      required: true,
      index: true,
    },
    load: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Load",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["BIDDED", "NOT_INTERESTED"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

carrierLoadInteractionSchema.index(
  { carrier: 1, load: 1 },
  { unique: true }
);

const CarrierLoadInteraction = mongoose.model(
  "CarrierLoadInteraction",
  carrierLoadInteractionSchema
);

export default CarrierLoadInteraction;
