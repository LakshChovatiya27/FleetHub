import Vehicle from "../models/vehicle.models.js";
import Carrier from "../models/carrier.models.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  validateIndianVehicleNumber,
  validateManufacturingYear,
} from "../utils/validations.js";

export const addVehicle = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  const role = req?.user?.role;
  if (role !== "carrier")
    throw new ApiError(403, "Only carriers can add vehicles");

  let {
    vehicleNumber,
    vehicleType,
    capacityTons = 0,
    capacityLitres = 0,
    lengthFt = 0,
    widthFt = 0,
    heightFt = 0,
    manufacturingYear,
  } = req.body;

  const errors = [];

  if (!vehicleType) errors.push("Vehicle type is required");
  if (!vehicleNumber) errors.push("Vehicle number is required");

  vehicleType = vehicleType.toUpperCase();
  vehicleNumber = vehicleNumber.toUpperCase();

  const validVehicleNumber = validateIndianVehicleNumber(vehicleNumber);
  if (!validVehicleNumber)
    errors.push("Vehicle number is invalid as per Indian standards");
  else vehicleNumber = validVehicleNumber;

  if (vehicleType === "TANKER") {
    if (capacityLitres <= 0)
      errors.push("TANKERS must have some capacity in litres");
    capacityTons = 0;
    lengthFt = 0;
    widthFt = 0;
    heightFt = 0;
  } 
  else if (vehicleType === "LCV") {
    if (capacityTons <= 0 || capacityTons > 3)
      errors.push("LCV capacity must be less than 3 tons");

    capacityLitres = 0;
  } 
  else {
    if (capacityTons <= 3)
      errors.push("Non-LCV capacity must be greater than 3 tons");

    if (lengthFt <= 0 || widthFt <= 0) {
      errors.push("Length and width must be greater than 0");
    }

    if (vehicleType !== "TRAILER_FLATBED" && heightFt <= 0) {
      errors.push(
        "Height must be greater than 0 for non-TRAILER_FLATBED vehicles"
      );
    }

    if (vehicleType === "TRAILER_FLATBED") heightFt = 0;

    capacityLitres = 0;
  }

  if (!manufacturingYear) errors.push("Manufacturing year is required");

  const yearError = validateManufacturingYear(manufacturingYear);
  if (yearError) errors.push(yearError);

  if (errors.length > 0) throw new ApiError(400, errors.join(", "));

  const existingVehicle = await Vehicle.findOne({ vehicleNumber });

  if (existingVehicle) {
    throw new ApiError(409, "Vehicle with this Number exists");
  }

  if (vehicleType === "TANKER") {
    capacityTons = 0;
    lengthFt = 0;
    widthFt = 0;
    heightFt = 0;
  } else {
    capacityLitres = 0;
    if (vehicleType === "TRAILER_FLATBED") {
      heightFt = 0;
    }
  }

  const vehicle = await Vehicle.create({
    vehicleType,
    vehicleNumber,
    capacityTons,
    capacityLitres,
    manufacturingYear,
    carrier: req.user._id,
    dimensions: { lengthFt, widthFt, heightFt },
  });

  if (!vehicle) {
    throw new ApiError(500, "Something went wrong while adding the vehicle");
  }

  await Carrier.findByIdAndUpdate(
    req.user._id,
    { $inc: { fleetSize: 1 } },
    { new: true }
  );

  return res
    .status(201)
    .json(new ApiResponse(200, vehicle, "Vehicle added successfully"));
});

export const getVehicleById = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  const role = req?.user?.role;
  if (role !== "carrier")
    throw new ApiError(403, "Only carriers can get vehicles");

  const { vehicleId } = req.params;

  const vehicle = await Vehicle.findById(vehicleId);

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  if (vehicle.carrier.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You do not have permission to view this vehicle");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, vehicle, "Vehicle details fetched successfully")
    );
});

export const getAllVehicles = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  const role = req?.user?.role;
  if (role !== "carrier")
    throw new ApiError(403, "Only carriers can get all vehicles");

  const carrierId = req.user._id;

  const vehicles = await Vehicle.find({ carrier: carrierId }).sort({
    createdAt: -1,
  });

  if (vehicles.length === 0)
    return res
      .status(200)
      .json(new ApiResponse(200, [], "No vehicles found in your fleet"));

  return res
    .status(200)
    .json(new ApiResponse(200, vehicles, "Fleet fetched successfully"));
});

export const deleteVehicle = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  const role = req.user?.role;
  if (role !== "carrier")
    throw new ApiError(403, "Only carriers can delete vehicles");

  const { vehicleId } = req.params;

  const vehicle = await Vehicle.findById(vehicleId);

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  if (vehicle.carrier.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this vehicle");
  }

  if (["BIDDED", "BOOKED", "IN_TRANSIT"].includes(vehicle.status)) {
    throw new ApiError(400, "Cannot delete vehicle with active assignments");
  }

  await Vehicle.findByIdAndDelete(vehicleId);

  await Carrier.findByIdAndUpdate(req.user._id, { $inc: { fleetSize: -1 } });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Vehicle deleted successfully"));
});

export const updateVehicleStatus = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "carrier") {
    throw new ApiError(403, "Only carriers can update vehicle status");
  }

  const { vehicleId } = req.params;
  let { status } = req.body;

  status = status?.toUpperCase();

  const validStatuses = [
    "AVAILABLE",
    "BIDDED",
    "BOOKED",
    "IN_TRANSIT",
    "MAINTENANCE",
  ];

  if (!validStatuses.includes(status)) {
    throw new ApiError(400, "Invalid vehicle status");
  }

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new ApiError(404, "Vehicle not found");

  if (vehicle.carrier.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not authorized to update this vehicle");
  }

  const current = vehicle.status;

  const allowedTransitions = {
    AVAILABLE: ["BIDDED", "MAINTENANCE"],
    MAINTENANCE: ["AVAILABLE"],
    BIDDED: ["BOOKED"],
    BOOKED: ["IN_TRANSIT"],
    IN_TRANSIT: ["AVAILABLE"],
  };

  if (!allowedTransitions[current]?.includes(status)) {
    throw new ApiError(
      400,
      `Cannot change status from ${current} to ${status}`
    );
  }

  vehicle.status = status;
  const updatedVehicle = await vehicle.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedVehicle,
        "Vehicle status updated successfully"
      )
    );
});
