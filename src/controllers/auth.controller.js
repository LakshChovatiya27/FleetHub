import fs from "fs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import asyncHandler from "../utils/asyncHandler.js";
import {
  isEmpty,
  isPasswordValid,
  isEmailValid,
  isPhoneNumberValid,
  isGSTValid,
} from "../utils/validations.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import uploadOnCloudinary from "../utils/cloudinary.js";

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
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh token"
    );
  }
};

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request");

  try {
    const decodedTokenData = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const role = decodedTokenData?.role;

    let user;
    if (role === "shipper") user = await Shipper.findById(decodedTokenData?._id); 
    else if (role === "carrier") user = await Carrier.findById(decodedTokenData?._id);

    if (!user) throw new ApiError(401, "Invalid refresh token");

    if (incomingRefreshToken !== user?.refreshToken)
      throw new ApiError(401, "Refresh token is expired or used");

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id, role
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