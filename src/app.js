import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import ApiError from "./utils/apiError.js";
import ApiResponse from "./utils/apiResponse.js";

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
}));

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

import authRouter from "./routes/auth.routes.js"
import vehicleRouter from "./routes/vehicle.routes.js"
import shipperRouter from "./routes/shipper.routes.js"
import carrierRouter from "./routes/carrier.routes.js"

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/vehicles", vehicleRouter);
app.use("/api/v1/shippers", shipperRouter);
app.use("/api/v1/carriers", carrierRouter);

app.use((req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  const statusCode = err?.statusCode || 500;

  const payload = {
    name: err?.name,
    errors: err?.errors || [],
    stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
  };

  return res
    .status(statusCode)
    .json(new ApiResponse(statusCode, payload, err?.message || "Internal Server Error"));
});

export default app;