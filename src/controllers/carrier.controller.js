import Load from "../models/load.models.js";
import Bid from "../models/bid.models.js";
import Vehicle from "../models/vehicle.models.js";
import CarrierLoadInteraction from "../models/carrierLoadInteraction.models.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import mongoose from "mongoose";

export const getEligibleLoads = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "carrier") {
    throw new ApiError(403, "Only carriers can view available loads");
  }

  const carrierId = req.user._id;
  const now = new Date();

  const interactions = await CarrierLoadInteraction.find(
    { carrier: carrierId },
    { load: 1 }
  );

  const excludedLoadIds = interactions.map( interaction => interaction.load );

  const loads = await Load.find({
    status: "CREATED",
    biddingDeadline: { $gt: now },
    _id: { $nin: excludedLoadIds },
  }).select("-assignedVehicle -selectedCarrier -driverDetails")
  .sort({ biddingDeadline: 1 });

  if (loads.length === 0) {
    return res
      .status(200)
      .json(
        new ApiResponse(200, [], "No eligible loads found for this carrier")
      );
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      loads,
      "Eligible loads fetched successfully"
    )
  );
});

export const getCarrierLoadDetails = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "carrier") {
    throw new ApiError(403, "Only carriers can view load details");
  }

  const { loadId } = req.params;
  
  const load = await Load.findById(loadId);
  if (!load) throw new ApiError(404, "Load not found");
  
  const now = new Date();

  if (load.status === "CREATED" && now >= load.pickupDate) {
    throw new ApiError(403,"Load expired and details are no longer accessible");
  }

  if ( load.status === "CREATED" && now < load.biddingDeadline) {
    return res
    .status(200)
    .json(
      new ApiResponse(200, load, "Load details fetched successfully")
    );
  }
  
  const carrierId = req.user._id;

  const interaction = await CarrierLoadInteraction.findOne({
    carrier: carrierId,
    load: loadId,
    status: "BIDDED",
  });

  if (interaction) {
    return res
    .status(200)
    .json(
      new ApiResponse(200, load, "Load details fetched successfully")
    );
  }

  throw new ApiError(403,"You are not authorized to view this load");
});

export const markLoadNotInterested = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "carrier") {
    throw new ApiError(403, "Only carriers can perform this action");
  }

  const { loadId } = req.params;
  const carrierId = req.user._id;

  const load = await Load.findById(loadId);
  if (!load) throw new ApiError(404, "Load not found");

  if (load.status !== "CREATED") {
    throw new ApiError(400, "Cannot mark interest on a non-active load");
  }

  if (new Date() >= load.biddingDeadline) {
    throw new ApiError(400, "Bidding deadline has passed for this load");
  }

  const existingInteraction = await CarrierLoadInteraction.findOne({
    carrier: carrierId,
    load: loadId,
  });

  if (existingInteraction) {
    throw new ApiError(400, "You have already taken action on this load");
  }

  const interaction = await CarrierLoadInteraction.create({
    carrier: carrierId,
    load: loadId,
    status: "NOT_INTERESTED",
  });

  if (!interaction) {
    throw new ApiError(500, "Failed to record interaction");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      null,
      "Load marked as not interested"
    )
  );
});

export const getEligibleVehiclesForLoad = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "carrier") {
    throw new ApiError(403, "Only carriers can view eligible vehicles");
  }

  const carrierId = req.user._id;
  const { loadId } = req.params;

  const load = await Load.findById(loadId);
  if (!load) throw new ApiError(404, "Load not found");

  if (load.status !== "CREATED") {
    throw new ApiError(400, "Vehicles cannot be selected for this load");
  }

  if (new Date() >= load.biddingDeadline) {
    throw new ApiError(400, "Bidding deadline has passed");
  }

  let query = {
    carrier: carrierId,
    status: "AVAILABLE",
    vehicleType: { $in: load.requiredVehicleType },
  };

  let vehicles;

  if (load.requiredVehicleType.includes("TANKER")) {
    query.capacityLitres = { $gte: load.volumeInLitres };
    vehicles = await Vehicle.find(query).select("_id vehicleType vehicleNumber capacityLitres");
  }
  else {
    query.capacityTons = { $gte: load.weightInTons };
    vehicles = await Vehicle.find(query).select("_id vehicleType vehicleNumber capacityTons");
  }

  if (vehicles.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], "No eligible vehicles found"));
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      vehicles,
      "Eligible vehicles fetched successfully"
    )
  );
});

export const placeBid = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "carrier") {
    throw new ApiError(403, "Only carriers can place bids");
  }

  const carrierId = req.user._id;
  const { loadId } = req.params;
  const { vehicleId, bidAmount, estimatedTransitTimeHours } = req.body;

  if (!vehicleId || !bidAmount) {
    throw new ApiError(400, "vehicleId and bidAmount are required");
  }

  if (bidAmount <= 0) {
    throw new ApiError(400, "Bid price must be greater than 0");
  }

  if (!estimatedTransitTimeHours) throw new ApiError(400, "Estimated transit time is required");

  const estimatedHours = Number(estimatedTransitTimeHours);
  if (isNaN(estimatedHours) || estimatedHours <= 0) {
    throw new ApiError(400, "Estimated transit time must be a positive number");
  }

  const load = await Load.findById(loadId);
  if (!load) throw new ApiError(404, "Load not found");

  if (load.status !== "CREATED") {
    throw new ApiError(400, "Bidding is not allowed on this load");
  }

  if (new Date() >= load.biddingDeadline) {
    throw new ApiError(400, "Bidding deadline has passed");
  }

  const existingInteraction = await CarrierLoadInteraction.findOne({
    carrier: carrierId,
    load: loadId,
  });

  if (existingInteraction) {
    throw new ApiError(400, "You have already interacted with this load");
  }

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new ApiError(404, "Vehicle not found");

  if (vehicle.carrier.toString() !== carrierId.toString()) {
    throw new ApiError(403, "Vehicle does not belong to you");
  }

  if (vehicle.status === "RETIRED") {
    throw new ApiError(400,"Cannot bid using a retired vehicle");
  }

  if (vehicle.status !== "AVAILABLE") {
    throw new ApiError(400, "Vehicle is not available for bidding");
  }

  if (!load.requiredVehicleType.includes(vehicle.vehicleType)) {
    throw new ApiError(400, "Vehicle type is not suitable for this load");
  }

  if (vehicle.vehicleType === "TANKER") {
    if (vehicle.capacityLitres < load.volumeInLitres) {
      throw new ApiError(400, "Vehicle capacity is insufficient for this load");
    }
  } 
  else {
    if (vehicle.capacityTons < load.weightInTons) {
      throw new ApiError(400, "Vehicle capacity is insufficient for this load");
    }
  }

  const bid = await Bid.create({
    load: load._id,
    carrier: carrierId,
    proposedVehicle: vehicle._id,
    bidAmount,
    estimatedTransitTimeHours: estimatedHours,
    status: "PENDING",
  });

  if (!bid) throw new ApiError(500, "Failed to place bid");

  vehicle.status = "BIDDED";
  await vehicle.save();

  const interaction = await CarrierLoadInteraction.create({
    carrier: carrierId,
    load: load._id,
    status: "BIDDED",
  });

  if (!interaction) throw new ApiError(500, "Failed to record interaction");

  return res
  .status(201)
  .json(new ApiResponse(201, bid, "Bid placed successfully"));
});

export const getCarrierBids = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "carrier") {
    throw new ApiError(403, "Only carriers can view their bids");
  }

  const carrierId = req.user._id;
  const { status } = req.query;

  const matchStage = {
    carrier: new mongoose.Types.ObjectId(carrierId),
  };

  const ALLOWED_BID_STATUS = ["PENDING", "ACCEPTED", "REJECTED"];

  if (status) {
    const normalizedStatus = status.toUpperCase();
    if (!ALLOWED_BID_STATUS.includes(normalizedStatus)) {
      throw new ApiError(400, "Invalid bid status");
    }
    matchStage.status = normalizedStatus;
  }

  const bids = await Bid.aggregate([
    { 
      $match: matchStage 
    },
    {
      $lookup: {
        from: "loads",
        localField: "load",
        foreignField: "_id",
        as: "load",
      },
    },
    { 
      $unwind: "$load" 
    },
    {
      $lookup: {
        from: "shippers",
        localField: "load.shipper",
        foreignField: "_id",
        as: "shipper",
      },
    },
    { 
      $unwind: "$shipper" 
    },
    {
      $lookup: {
        from: "vehicles",
        localField: "proposedVehicle",
        foreignField: "_id",
        as: "vehicle",
      },
    },
    { 
      $unwind: "$vehicle" 
    },
    {
      $project: {
        _id: 1,
        bidAmount: 1,
        bidStatus: "$status",
        createdAt: 1,
        shipper: {
          companyName: "$shipper.companyName",
          logo: "$shipper.logo",
        },
        vehicle: {
          vehicleNumber: "$vehicle.vehicleNumber",
          vehicleType: "$vehicle.vehicleType",
        },
        load: {
          _id: "$load._id",
          material: "$load.material",
          loadStatus: "$load.status",
          pickupLocation: {
            city: "$load.pickupLocation.city",
            state: "$load.pickupLocation.state",
          },
          deliveryLocation: {
            city: "$load.deliveryLocation.city",
            state: "$load.deliveryLocation.state",
          },
          weightInTons: "$load.weightInTons",
          volumeInLitres: "$load.volumeInLitres",
          requiredVehicleType: "$load.requiredVehicleType",
          budgetPrice: "$load.budgetPrice",
        },
      },
    },
    { 
      $sort: { createdAt: -1 } 
    },
  ]);

  if (bids.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], "No bids found for this carrier"));
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      bids,
      "Carrier bids fetched successfully"
    )
  );
});

export const getCarrierBidDetails = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "carrier") {
    throw new ApiError(403, "Only carriers can view bid details");
  }

  const { bidId } = req.params;
  const carrierId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(bidId)) {
    throw new ApiError(400, "Invalid bid id");
  }

  const result = await Bid.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(bidId),
        carrier: new mongoose.Types.ObjectId(carrierId),
        status: { $in: ["PENDING", "ACCEPTED"] },
      },
    },
    {
      $lookup: {
        from: "loads",
        localField: "load",
        foreignField: "_id",
        as: "load",
      },
    },
    { 
      $unwind: "$load" 
    },
    {
      $match: {
        $or: [
          { "load.status": { $ne: "CREATED" } },
          { "load.pickupDate": { $gt: new Date() } }
        ]
      }
    },
    {
      $match: {
        "load.status": { $ne: "DELIVERED" },
      },
    },
    {
      $lookup: {
        from: "shippers",
        localField: "load.shipper",
        foreignField: "_id",
        as: "shipper",
      },
    },
    { 
      $unwind: "$shipper" 
    },
    {
      $lookup: {
        from: "vehicles",
        localField: "proposedVehicle",
        foreignField: "_id",
        as: "vehicle",
      },
    },
    { 
      $unwind: "$vehicle" 
    },
    {
      $project: {
        bid: {
          _id: "$_id",
          bidAmount: "$bidAmount",
          estimatedTransitTimeHours: "$estimatedTransitTimeHours",
          status: "$status",
          createdAt: "$createdAt",
        },
        load: {
          _id: "$load._id",
          material: "$load.material",
          pickupLocation: "$load.pickupLocation",
          deliveryLocation: "$load.deliveryLocation",
          weightInTons: "$load.weightInTons",
          volumeInLitres: "$load.volumeInLitres",
          requiredVehicleType: "$load.requiredVehicleType",
          pickupDate: "$load.pickupDate",
          expectedDeliveryDate: "$load.expectedDeliveryDate",
          status: "$load.status",
        },
        shipper: {
          _id: "$shipper._id",
          companyName: "$shipper.companyName",
          ownerName: "$shipper.ownerName",
          logo: "$shipper.logo",
          contactEmail: "$shipper.contactEmail",
          contactNumber: "$shipper.contactNumber",
          address: "$shipper.address",
          gstNumber: "$shipper.gstNumber",
        },
        vehicle: {
          _id: "$vehicle._id",
          vehicleNumber: "$vehicle.vehicleNumber",
          vehicleType: "$vehicle.vehicleType",
          capacityTons: "$vehicle.capacityTons",
          capacityLitres: "$vehicle.capacityLitres",
          dimensions: "$vehicle.dimensions",
          manufacturingYear: "$vehicle.manufacturingYear",
          status: "$vehicle.status",
        },
      },
    },
  ]);

  if (!result || result.length === 0) {
    throw new ApiError(
      404,
      "Bid not found or you are not allowed to view it"
    );
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      result[0],
      "Bid details fetched successfully"
    )
  );
});

export const startLoadTransit = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "carrier") {
    throw new ApiError(403, "Only carriers can start transit");
  }

  const { loadId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(loadId)) {
    throw new ApiError(400, "Invalid load ID");
  }

  const load = await Load.findById(loadId);
  if (!load) throw new ApiError(404, "Load not found");

  if (load.selectedCarrier?.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not authorized to start transit for this load");
  }

  if (load.status !== "ASSIGNED") {
    throw new ApiError(400, "Load is not ready to start transit");
  }

  if (new Date() < load.biddingDeadline) {
    throw new ApiError(400, "Cannot start transit before bidding is finalized");
  }

  load.status = "IN_TRANSIT";
  await load.save();

  await Vehicle.findByIdAndUpdate(
    load.assignedVehicle,
    { status: "IN_TRANSIT" }
  );

  return res
  .status(200)
  .json(new ApiResponse(200, { loadId: load._id }, "Load marked as in transit"));
});

export const markLoadDelivered = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "carrier") {
    throw new ApiError(403, "Only carriers can mark load as delivered");
  }

  const { loadId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(loadId)) {
    throw new ApiError(400, "Invalid load ID");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const load = await Load.findById(loadId).session(session);
    if (!load) throw new ApiError(404, "Load not found");

    if (load.selectedCarrier.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "Not authorized to deliver this load");
    }

    if (load.status !== "IN_TRANSIT") {
      throw new ApiError(400, "Load is not in transit");
    }

    load.status = "DELIVERED";
    await load.save({ session });

    await Vehicle.findByIdAndUpdate(
      load.assignedVehicle,
      { status: "AVAILABLE" },
      { session }
    );

    await Carrier.findByIdAndUpdate(
      load.selectedCarrier,
      { $inc: { totalTrips: 1 } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json(
      new ApiResponse(
        200,
        { loadId: load._id },
        "Load marked as delivered successfully"
      )
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});