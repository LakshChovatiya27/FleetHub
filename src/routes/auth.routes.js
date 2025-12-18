import { Router } from "express";
import upload from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/register/shipper").post(upload.single("logo"), registerShipper);
router.route("/register/carrier").post(upload.single("logo"), registerCarrier);
router.route("/login").post(loginUser);
router.route("/logout").post(logoutUser);
router.route("/refresh-token").post(refreshAccessToken);

export default router;