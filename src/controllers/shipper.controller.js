import Load from "../models/load.models.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { validateLoadDates, isEmpty, validateLocation } from "../utils/validations.js";
import Shipper from "../models/shipper.models.js";
import Bid from "../models/bid.models.js";
import mongoose from "mongoose";
import Vehicle from "../models/vehicle.models.js";
import CarrierRating from "../models/carrierRating.models.js";
import Carrier from "../models/carrier.models.js";

export const createLoad = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");
  if (req.user.role !== "shipper") {
    throw new ApiError(403, "Only shippers can create loads");
  }

  const shipper = await Shipper.findById(req.user._id);
  if (!shipper) {
    throw new ApiError(404, "Shipper not found");
  }

  let {
    pickupLocation,
    deliveryLocation,
    material,
    description,
    weightInTons = 0,
    volumeInLitres = 0,
    requiredVehicleType,
    budgetPrice,
    biddingDeadline,
    pickupDate,
    expectedDeliveryDate,
  } = req.body;

  weightInTons = Number(weightInTons);
  volumeInLitres = Number(volumeInLitres);
  budgetPrice = Number(budgetPrice);

  const errors = [];

  if (isEmpty(material)) errors.push("Material is required");
  if (isEmpty(biddingDeadline)) errors.push("Bidding deadline is required");
  if (isEmpty(pickupDate)) errors.push("Pickup date is required");
  if (isEmpty(requiredVehicleType))
    errors.push("At least one required vehicle type is required");
  if (isEmpty(expectedDeliveryDate))
    errors.push("Expected delivery date is required");
  if (isNaN(budgetPrice) || budgetPrice <= 0)
    errors.push("Budget price must be a valid number greater than 0");

  const pickupValidation = validateLocation(pickupLocation, "Pickup location");
  const deliveryValidation = validateLocation(deliveryLocation, "Delivery location");

  if (!pickupValidation.isValid) {
    errors.push(...pickupValidation.errors);
  }

  if (!deliveryValidation.isValid) {
    errors.push(...deliveryValidation.errors);
  }
  
  if (errors.length > 0) throw new ApiError(400, errors.join(", "));
  
  pickupLocation = pickupValidation.data;
  deliveryLocation = deliveryValidation.data;

  material = material.trim();
  description = description ? description.trim() : "";

  if (!Array.isArray(requiredVehicleType)) {
    throw new ApiError(400, "requiredVehicleType must be an array");
  }

  if (requiredVehicleType.length === 0) {
    throw new ApiError(
      400,
      "At least one required vehicle type must be selected"
    );
  }

  const VEHICLE_TYPES = [
    "OPEN_BODY",
    "CLOSED_CONTAINER",
    "TRAILER_FLATBED",
    "TANKER",
    "REFRIGERATED",
    "LCV",
  ];

  requiredVehicleType = [
    ...new Set(requiredVehicleType.map((v) => v.toUpperCase())),
  ];

  for (const type of requiredVehicleType) {
    if (!VEHICLE_TYPES.includes(type)) {
      throw new ApiError(400, `Invalid vehicle type: ${type}`);
    }
  }

  const hasLCV = requiredVehicleType.includes("LCV");

  if (hasLCV && weightInTons > 3) {
    throw new ApiError(400, "LCV cannot be used for loads over 3 tons");
  }

  const hasTanker = requiredVehicleType.includes("TANKER");

  if (hasTanker && requiredVehicleType.length > 1) {
    throw new ApiError(
      400,
      "TANKER cannot be combined with other vehicle types"
    );
  }

  if (hasTanker) {
    if (volumeInLitres <= 0) {
      throw new ApiError(400, "TANKER must have some volume in litres");
    }
    weightInTons = 0;
  } else {
    if (weightInTons <= 0) {
      throw new ApiError(400, "Non-TANKER loads must have some weight in tons");
    }
    volumeInLitres = 0;
  }

  if (budgetPrice <= 0) {
    throw new ApiError(400, "Budget price must be greater than 0");
  }

  if (
    pickupLocation?.street === deliveryLocation?.street &&
    pickupLocation?.pincode === deliveryLocation?.pincode
  ) {
    throw new ApiError(
      400,
      "Pickup and delivery locations cannot be in same street"
    );
  }

  const dateValidationResult = validateLoadDates({
    biddingDeadline,
    pickupDate,
    expectedDeliveryDate,
  });

  if (!dateValidationResult.isValid) {
    throw new ApiError(400, "Invalid date values", dateValidationResult.errors);
  }

  const {
    biddingDeadline: validBiddingDeadline,
    pickupDate: validPickupDate,
    expectedDeliveryDate: validDeliveryDate,
  } = dateValidationResult.data;

  const load = await Load.create({
    shipper: req.user._id,
    pickupLocation,
    deliveryLocation,
    material,
    description,
    weightInTons,
    volumeInLitres,
    requiredVehicleType,
    budgetPrice,
    biddingDeadline: validBiddingDeadline,
    pickupDate: validPickupDate,
    expectedDeliveryDate: validDeliveryDate,
    status: "CREATED",
  });

  return res
    .status(201)
    .json(new ApiResponse(201, load, "Load created successfully"));
});

export const getAllLoads = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "shipper") {
    throw new ApiError(403, "Only shippers can access their loads");
  }

  const { status } = req.query;

  const matchStage = {
    shipper: new mongoose.Types.ObjectId(req.user._id),
  };

  if (status) {
    const normalizedStatus = String(status).toUpperCase();

    const VALID_LOAD_STATUSES = ["CREATED", "ASSIGNED", "IN_TRANSIT", "DELIVERED"];

    if (!VALID_LOAD_STATUSES.includes(normalizedStatus)) {
      throw new ApiError(400, "Invalid load status filter");
    }

    matchStage.status = normalizedStatus;
  }

  const loads = await Load.aggregate([
    { 
      $match: matchStage 
    },
    {
      $lookup: {
        from: "bids",
        localField: "_id",
        foreignField: "load",
        as: "bids",
      },
    },
    {
      $lookup: {
        from: "carriers",
        localField: "selectedCarrier",
        foreignField: "_id",
        as: "selectedCarrier",
      },
    },
    {
      $lookup: {
        from: "vehicles",
        localField: "assignedVehicle",
        foreignField: "_id",
        as: "assignedVehicle",
      },
    },
    {
      $project: {
        material: 1,
        status: 1,
        budgetPrice: 1,
        requiredVehicleType: 1,
        weightInTons: 1,
        volumeInLitres: 1,
        pickupDate: 1,
        biddingDeadline: 1,
        createdAt: 1,
        pickupLocation: {
          city: "$pickupLocation.city",
          state: "$pickupLocation.state",
        },
        deliveryLocation: {
          city: "$deliveryLocation.city",
          state: "$deliveryLocation.state",
        },
        bidCount: {
          $cond: [
            { $eq: ["$status", "CREATED"] },
            { $size: "$bids" },
            0,
          ],
        },
        selectedCarrier: {
          $cond: [
            { $gt: [{ $size: "$selectedCarrier" }, 0] },
            {
              _id: { 
                $arrayElemAt: ["$selectedCarrier._id", 0] 
              },
              companyName: {
                $arrayElemAt: ["$selectedCarrier.companyName", 0],
              },
              logo: {
                $arrayElemAt: ["$selectedCarrier.logo", 0],
              },
              rating: {
                $arrayElemAt: ["$selectedCarrier.rating", 0],
              },
              ratingCount: {
                $arrayElemAt: ["$selectedCarrier.ratingCount", 0],
              },
            },
            null,
          ],
        },
        assignedVehicle: {
          $cond: [
            { $gt: [{ $size: "$assignedVehicle" }, 0] },
            {
              _id: { $arrayElemAt: ["$assignedVehicle._id", 0] },
              vehicleNumber: {
                $arrayElemAt: ["$assignedVehicle.vehicleNumber", 0],
              },
              vehicleType: {
                $arrayElemAt: ["$assignedVehicle.vehicleType", 0],
              },
            },
            null,
          ],
        },
      },
    },
    { 
      $sort: { createdAt: -1 } 
    },
  ]);

  const loadIds = loads.map(l => l._id);

  const ratedLoads = await CarrierRating.find(
    { load: { $in: loadIds } },
    { load: 1 }
  );

  const ratedLoadSet = new Set(ratedLoads.map(r => r.load.toString()));

  const responseData = loads.map(load => ({
    ...load,
    isRated: ratedLoadSet.has(load._id.toString()),
  }));

  if (loads.length === 0) {
    if (status) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            [],
            "No loads found for the shipper with the specified status"
          )
        );
    }
    return res
      .status(200)
      .json(new ApiResponse(200, [], "No loads found for the shipper"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, responseData, "Loads fetched successfully"));
});

export const getLoadDetails = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "shipper") {
    throw new ApiError(403, "Only shippers can access load details");
  }

  const { loadId } = req.params;
  if (!loadId) throw new ApiError(400, "Load ID is required");

  const load = await Load.findById(loadId);
  if (!load) throw new ApiError(404, "Load not found");

  if (load.shipper.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not authorized to access this load");
  }

  const loadDetails = await Load.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(loadId),
        shipper: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $match: {
        status: { $in: ["ASSIGNED", "IN_TRANSIT"] },
      },
    },
    {
      $lookup: {
        from: "carriers",
        localField: "selectedCarrier",
        foreignField: "_id",
        as: "selectedCarrier",
      },
    },
    {
      $lookup: {
        from: "vehicles",
        localField: "assignedVehicle",
        foreignField: "_id",
        as: "assignedVehicle",
      },
    },
    {
      $project: {
        material: 1,
        status: 1,
        budgetPrice: 1,
        requiredVehicleType: 1,
        weightInTons: 1,
        volumeInLitres: 1,
        pickupDate: 1,
        expectedDeliveryDate: 1,
        createdAt: 1,
        pickupLocation: 1,
        deliveryLocation: 1,
        selectedCarrier: {
          $cond: [
            { $gt: [{ $size: "$selectedCarrier" }, 0] },
            {
              _id: { $arrayElemAt: ["$selectedCarrier._id", 0] },
              companyName: {
                $arrayElemAt: ["$selectedCarrier.companyName", 0],
              },
              ownerName: {
                $arrayElemAt: ["$selectedCarrier.ownerName", 0],
              },
              contactEmail: {
                $arrayElemAt: ["$selectedCarrier.contactEmail", 0],
              },
              contactNumber: {
                $arrayElemAt: ["$selectedCarrier.contactNumber", 0],
              },
              address: {
                $arrayElemAt: ["$selectedCarrier.address", 0],
              },
              gstNumber: {
                $arrayElemAt: ["$selectedCarrier.gstNumber", 0],
              },
              rating: {
                $arrayElemAt: ["$selectedCarrier.rating", 0],
              },
              ratingCount: {
                $arrayElemAt: ["$selectedCarrier.ratingCount", 0],
              },
              fleetSize: {
                $arrayElemAt: ["$selectedCarrier.fleetSize", 0],
              },
              totalTrips: {
                $arrayElemAt: ["$selectedCarrier.totalTrips", 0],
              },
              logo: {
                $arrayElemAt: ["$selectedCarrier.logo", 0],
              },
            },
            null,
          ],
        },

        assignedVehicle: {
          $cond: [
            { $gt: [{ $size: "$assignedVehicle" }, 0] },
            {
              _id: { $arrayElemAt: ["$assignedVehicle._id", 0] },
              vehicleNumber: {
                $arrayElemAt: ["$assignedVehicle.vehicleNumber", 0],
              },
              vehicleType: {
                $arrayElemAt: ["$assignedVehicle.vehicleType", 0],
              },
              capacityTons: {
                $arrayElemAt: ["$assignedVehicle.capacityTons", 0],
              },
              capacityLitres: {
                $arrayElemAt: ["$assignedVehicle.capacityLitres", 0],
              },
              dimensions: {
                $arrayElemAt: ["$assignedVehicle.dimensions", 0],
              },
              manufacturingYear: {
                $arrayElemAt: ["$assignedVehicle.manufacturingYear", 0],
              },
              status: {
                $arrayElemAt: ["$assignedVehicle.status", 0],
              },
            },
            null,
          ],
        },
      },
    },
  ]);

  if (!loadDetails || loadDetails.length === 0) {
    throw new ApiError(404, "Load not found or access not allowed");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      loadDetails[0],
      "Load details fetched successfully"
    )
  );
});

export const getBidsForLoad = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "shipper") {
    throw new ApiError(403, "Only shippers can view bids");
  }

  const { loadId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(loadId)) {
    throw new ApiError(400, "Invalid load ID");
  }

  const load = await Load.findById(loadId);
  if (!load) throw new ApiError(404, "Load not found");

  if (load.shipper.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not authorized to view bids for this load");
  }

  if (load.status !== "CREATED") {
    throw new ApiError(400, "Bids are no longer visible after assignment");
  }

  const bids = await Bid.aggregate([
    {
      $match: {
        load: new mongoose.Types.ObjectId(loadId),
        status: "PENDING",
      },
    },
    {
      $lookup: {
        from: "carriers",
        localField: "carrier",
        foreignField: "_id",
        as: "carrier",
      },
    },
    { 
      $unwind: "$carrier" 
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
        estimatedTransitTimeHours: 1,
        carrier: {
          _id: "$carrier._id",
          companyName: "$carrier.companyName",
          logo: "$carrier.logo",
          rating: "$carrier.rating",
          ratingCount: "$carrier.ratingCount",
          fleetSize: "$carrier.fleetSize",
        },
        vehicle: {
          vehicleNumber: "$vehicle.vehicleNumber",
          vehicleType: "$vehicle.vehicleType",
          capacityTons: "$vehicle.capacityTons",
          capacityLitres: "$vehicle.capacityLitres",
        },
      },
    },
    { 
      $sort: { 
        bidAmount: 1,
        "carrier.rating": -1
      } 
    },
  ]);

  if (bids.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], "No bids found for this load"));
  }

  return res
  .status(200)
  .json(new ApiResponse(200, bids, "Bids fetched successfully"));
});

export const getBidDetailsForShipper = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "shipper") {
    throw new ApiError(403, "Only shippers can view bid details");
  }

  const { bidId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(bidId)) {
    throw new ApiError(400, "Invalid bid ID");
  }

  const result = await Bid.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(bidId),
        status: "PENDING",
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
        "load.shipper": new mongoose.Types.ObjectId(req.user._id),
        "load.status": "CREATED",
      },
    },
    {
      $lookup: {
        from: "carriers",
        localField: "carrier",
        foreignField: "_id",
        as: "carrier",
      },
    },
    { 
      $unwind: "$carrier" 
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
        estimatedTransitTimeHours: 1,
        createdAt: 1,
        carrier: {
          ownerName: "$carrier.ownerName",
          companyName: "$carrier.companyName",
          contactEmail: "$carrier.contactEmail",
          contactNumber: "$carrier.contactNumber",
          logo: "$carrier.logo",
          address: "$carrier.address",
          gstNumber: "$carrier.gstNumber",
          fleetSize: "$carrier.fleetSize",
          rating: "$carrier.rating",
          ratingCount: "$carrier.ratingCount",
          totalTrips: "$carrier.totalTrips",
        },
        vehicle: {
          vehicleNumber: "$vehicle.vehicleNumber",
          vehicleType: "$vehicle.vehicleType",
          capacityTons: "$vehicle.capacityTons",
          capacityLitres: "$vehicle.capacityLitres",
          dimensions: "$vehicle.dimensions",
          manufacturingYear: "$vehicle.manufacturingYear",
        },
      },
    },
  ]);

  if (!result || result.length === 0) {
    throw new ApiError(404, "Bid details not available");
  }

  return res
  .status(200)
  .json(new ApiResponse(200, result[0], "Bid details fetched successfully"));
});

export const acceptBid = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "shipper") {
    throw new ApiError(403, "Only shippers can accept bids");
  }

  const { bidId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(bidId)) {
    throw new ApiError(400, "Invalid bid ID");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bid = await Bid.findById(bidId).session(session);
    if (!bid) throw new ApiError(404, "Bid not found");

    if (bid.status !== "PENDING") {
      throw new ApiError(400, "This bid cannot be accepted");
    }

    const load = await Load.findById(bid.load).session(session);
    if (!load) throw new ApiError(404, "Associated load not found");

    if (load.shipper.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "Not authorized to accept this bid");
    }

    if (load.status !== "CREATED") {
      throw new ApiError(400, "Load is already assigned");
    }

    if (new Date() < load.biddingDeadline) {
      throw new ApiError(400, "Cannot accept bid before bidding deadline");
    }

    if (new Date() >= load.pickupDate) {
      throw new ApiError(400, "Cannot accept bid after pickup date has passed");
    }

    bid.status = "ACCEPTED";
    await bid.save({ session });

    const rejectedBids = await Bid.find({
      load: load._id,
      status: "PENDING",
      _id: { $ne: bid._id },
    }).session(session);

    const rejectedVehicleIds = rejectedBids.map(b => b.proposedVehicle);

    await Bid.updateMany(
      { _id: { $in: rejectedBids.map(b => b._id) } },
      { $set: { status: "REJECTED" } },
      { session }
    );

    load.status = "ASSIGNED";
    load.selectedCarrier = bid.carrier;
    load.assignedVehicle = bid.proposedVehicle;
    await load.save({ session });

    await Vehicle.findByIdAndUpdate(
      bid.proposedVehicle,
      { status: "BOOKED" },
      { session }
    );

    if (rejectedVehicleIds.length > 0) {
      await Vehicle.updateMany(
        { _id: { $in: rejectedVehicleIds } },
        { $set: { status: "AVAILABLE" } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          loadId: load._id,
          selectedCarrier: bid.carrier,
          assignedVehicle: bid.proposedVehicle,
        },
        "Bid accepted and load assigned successfully"
      )
    );

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

export const rateCarrierForLoad = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "shipper") {
    throw new ApiError(403, "Only shippers can rate carriers");
  }

  const { loadId } = req.params;
  const { rating } = req.body;

  if (!mongoose.Types.ObjectId.isValid(loadId)) {
    throw new ApiError(400, "Invalid load ID");
  }

  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, "Rating must be between 1 and 5");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const load = await Load.findById(loadId).session(session);
    if (!load) throw new ApiError(404, "Load not found");

    if (load.shipper.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "Not authorized to rate this load");
    }

    if (load.status !== "DELIVERED") {
      throw new ApiError(400, "Rating allowed only after delivery");
    }

    const alreadyRated = await CarrierRating.exists(
      { load: load._id },
      { session }
    );

    if (alreadyRated) {
      throw new ApiError(400, "You have already rated this delivery");
    }

    await CarrierRating.create(
      [
        {
          load: load._id,
          shipper: req.user._id,
          carrier: load.selectedCarrier,
          rating,
        },
      ],
      { session }
    );

    const carrier = await Carrier.findById(load.selectedCarrier).session(session);

    const newRatingCount = carrier.ratingCount + 1;
    const newRating = (carrier.rating * carrier.ratingCount + rating) / newRatingCount;

    carrier.rating = Number(newRating.toFixed(2));
    carrier.ratingCount = newRatingCount;

    await carrier.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json(
      new ApiResponse(200, null, "Carrier rated successfully")
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});