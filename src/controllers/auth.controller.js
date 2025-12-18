import fs from "fs";
import jwt from "jsonwebtoken";

import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import {
  isEmpty,
  isPasswordValid,
  isEmailValid,
  isPhoneNumberValid,
  isGSTValid,
} from "../utils/validations.js";

import Shipper from "../models/shipper.models.js";
import Carrier from "../models/carrier.models.js";

const generateAccessAndRefreshTokens = async (userId, role) => {
  try {
    let accessToken, refreshToken;
    if (role === "shipper") {
      const shipper = await Shipper.findById(userId);

      refreshToken = shipper.generateRefreshToken();
      accessToken = shipper.generateAccessToken();
      shipper.refreshToken = refreshToken;
      
      await shipper.save({ validateBeforeSave: false });
    } 
    else if (role === "carrier") {
      const carrier = await Carrier.findById(userId);

      refreshToken = carrier.generateRefreshToken();
      accessToken = carrier.generateAccessToken();
      carrier.refreshToken = refreshToken;

      await carrier.save({ validateBeforeSave: false });
    }

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating tokens:", error);
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh token"
    );
  }
};

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request");

  try {
    const decodedTokenData = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const role = decodedTokenData?.role;

    let user;
    if (role === "shipper")
      user = await Shipper.findById(decodedTokenData?._id);
    else if (role === "carrier")
      user = await Carrier.findById(decodedTokenData?._id);

    if (!user) throw new ApiError(401, "Invalid refresh token");

    if (incomingRefreshToken !== user?.refreshToken)
      throw new ApiError(401, "Refresh token is expired or used");

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id,
      role
    );

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

export const registerUser = asyncHandler(async (req, res) => {
  const {
    ownerName,
    companyName,
    contactEmail,
    contactNumber,
    password,
    street,
    city,
    state,
    pincode,
    gstNumber,
    role,
  } = req.body;

  const logoLocalPath = req.file?.path;
  const errors = [];

  let Model;
  if (role === "shipper") Model = Shipper;
  else if (role === "carrier") Model = Carrier;
  else throw new ApiError(400, "Invalid or missing Role");

  const fields = {
    "Owner name": ownerName,
    "Company name": companyName,
    "Contact email": contactEmail,
    "Contact number": contactNumber,
    Password: password,
    Street: street,
    City: city,
    State: state,
    Pincode: pincode,
    "GST number": gstNumber,
  };

  Object.entries(fields).forEach(([label, value]) => {
    if (isEmpty(value)) errors.push(`${label} is required`);
  });

  if (!isEmailValid(contactEmail)) errors.push("Contact email is invalid");
  if (!isPhoneNumberValid(contactNumber))
    errors.push("Contact number is invalid");
  if (!isGSTValid(gstNumber)) errors.push("GST number is invalid");
  if (!isPasswordValid(password))
    errors.push("Password should be at least 6 characters");

  if (errors.length > 0) {
    if (logoLocalPath) fs.unlinkSync(logoLocalPath);
    throw new ApiError(400, errors.join(", "));
  }

  const existingUser = await Model.findOne({
    $or: [{ gstNumber }, { contactEmail }, { contactNumber }],
  });
  if (existingUser) {
    if (logoLocalPath) fs.unlinkSync(logoLocalPath);
    throw new ApiError(409, `${role} with this Email or Contact Number or GST already exists`);
  }

  let logoUrl = "";
  if (logoLocalPath) {
    const logo = await uploadOnCloudinary(logoLocalPath);
    if (!logo) throw new ApiError(500, "Failed to upload Logo");
    logoUrl = logo.url;
  }

  const userData = {
    ownerName,
    companyName,
    contactEmail,
    contactNumber,
    password,
    logo: logoUrl,
    address: { street, city, state, pincode },
    gstNumber,
  };

  const newUser = await Model.create(userData);

  const createdUser = await Model.findById(newUser._id).select(
    "-password -refreshToken"
  );

  if (!createdUser)
    throw new ApiError(500, "Something went wrong while registering");

  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        { user: createdUser },
        `${role} registered successfully`
      )
    );
});

export const loginUser = asyncHandler(async (req, res) => {
  const { emailOrGSTNumber, password, role } = req.body;

  let Model;
  if (role === "shipper") Model = Shipper;
  else if (role === "carrier") Model = Carrier;
  else throw new ApiError(400, "Invalid or missing Role");

  if (!emailOrGSTNumber)
    throw new ApiError(400, "GST number or email is required");

  if (!password) throw new ApiError(400, "Password is required");

  const user = await Model.findOne({
    $or: [{ gstNumber: emailOrGSTNumber }, { contactEmail: emailOrGSTNumber }],
  });

  if (!user) throw new ApiError(404, "user does not exist");

  const isCorrectPassword = await user.isPasswordCorrect(password);

  if (!isCorrectPassword) throw new ApiError(401, "Invalid user credentials");

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
    role
  );

  const loggedInUser = await Model.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken, user: loggedInUser },
        "User logged in successfully"
      )
    );
});

export const logoutUser = asyncHandler(async (req, res) => {
  const user = req?.user;

  if (!user) throw new ApiError(401, "Unauthorized request");

  const Model = user.role === "shipper" ? Shipper : Carrier;

  await Model.findByIdAndUpdate(
    user._id,
    { $set: { refreshToken: null } },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});