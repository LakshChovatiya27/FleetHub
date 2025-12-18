import Vehicle from "../models/vehicle.models.js";
import Carrier from "../models/carrier.models.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

export const addVehicle = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  const role = req?.user?.role;
  if (role !== "carrier")
    throw new ApiError(403, "Only carriers can add vehicles");

  let {
    vehicleType,
    vehicleNumber,
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

  if (vehicleType === "TANKER" && capacityLitres <= 0) {
    errors.push(
      "Capacity in litres must be greater than 0 for TANKER vehicles"
    );
  }

  if (vehicleType !== "TANKER" && capacityTons <= 0) {
    errors.push(
      "Capacity in tons must be greater than 0 for non-TANKER vehicles"
    );
    if (vehicleType === "TRAILER_FLATBED") {
      if (lengthFt <= 0 || widthFt <= 0)
        errors.push(
          "Length and width must be greater than 0 for non-TANKER vehicles"
        );
      heightFt = 0;
    } else {
      if (lengthFt <= 0 || widthFt <= 0 || heightFt <= 0)
        errors.push(
          "Length, width and height must be greater than 0 for non-TANKER vehicles"
        );
    }
  }

  if (vehicleType === "LCV" && capacityTons > 3) {
    errors.push("LCV capacity must be 3 tons or less");
  }

  if (vehicleType !== "LCV" && vehicleType !== "TANKER" && capacityTons <= 3) {
    errors.push("Non-LCV capacity must be greater than 3 tons");
  }

  if (!manufacturingYear) {
    errors.push("Manufacturing year is required");
  }

  if (errors.length > 0) {
    throw new ApiError(400, errors.join(", "));
  }

  const existingVehicle = await Vehicle.findOne({
    vehicleNumber: vehicleNumber.toUpperCase(),
  });

  if (existingVehicle) {
    throw new ApiError(409, "Vehicle with this Number exists");
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

  if (vehicles.length === 0) throw new ApiError(404, "No vehicles found");

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

  await Vehicle.findByIdAndDelete(vehicleId);

  await Carrier.findByIdAndUpdate(req.user._id, { $inc: { fleetSize: -1 } });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Vehicle deleted successfully"));
});

export const updateVehicle = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  const role = req.user?.role;
  if (role !== "carrier")
    throw new ApiError(403, "Only carriers can delete vehicles");

  const { vehicleId } = req.params;

  let {
    vehicleType,
    vehicleNumber,
    status,
    capacityTons,
    capacityLitres,
    lengthFt,
    widthFt,
    heightFt,
    manufacturingYear,
  } = req.body;

  const vehicle = await Vehicle.findById(vehicleId);

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  if (vehicle.carrier.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this vehicle");
  }

  const isVehicleBusy = ["IN_TRANSIT", "BOOKED"].includes(vehicle.status);

  const isUpdatingSpecs =
    capacityTons ||
    capacityLitres ||
    lengthFt ||
    widthFt ||
    heightFt ||
    manufacturingYear;

  if (isVehicleBusy && isUpdatingSpecs) {
    throw new ApiError(
      400,
      `Vehicle is currently '${vehicle.status}'. You cannot change physical details (Capacity/Dimensions) until the trip is finished.`
    );
  }

  if (status) vehicle.status = status;
  if (!isVehicleBusy) {
    if (vehicleType) vehicle.vehicleType = vehicleType;
    if (VehicleNumber) vehicle.vehicleNumber = VehicleNumber;
    if (manufacturingYear) vehicle.manufacturingYear = manufacturingYear;

    if (vehicle.vehicleType === "TANKER") {
      if (capacityLitres > 0) {
        vehicle.capacityLitres = capacityLitres;
        capacityTons = 0;
        lengthFt = 0;
        widthFt = 0;
        heightFt = 0;
      }
    } else {
      if (capacityTons) {
        vehicle.capacityTons = capacityTons;
        capacityLitres = 0;
        if (vehicle.vehicleType === "TRAILER_FLATBED") {
          heightFt = 0;
          if (lengthFt) vehicle.dimensions.lengthFt = lengthFt;
          if (widthFt) vehicle.dimensions.widthFt = widthFt;
        } else {
          if (lengthFt) vehicle.dimensions.lengthFt = lengthFt;
          if (widthFt) vehicle.dimensions.widthFt = widthFt;
          if (heightFt) vehicle.dimensions.heightFt = heightFt;
        }
      }
    }
  }

  const updatedVehicle = await vehicle.save({ validateBeforeSave: true });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedVehicle,
        "Vehicle details updated successfully"
      )
    );
});
