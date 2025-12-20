import mongoose, {Schema} from "mongoose";

const carrierRatingSchema = new Schema(
  {
    load: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Load",
      required: true,
      unique: true,
      index: true,
    },
    shipper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipper",
      required: true,
      index: true,
    },
    carrier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Carrier",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
  },
  { timestamps: true }
);

const CarrierRating = mongoose.model("CarrierRating", carrierRatingSchema);

export default CarrierRating;