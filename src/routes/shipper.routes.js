import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.middleware.js";
import {
  createLoad,
  getAllLoads,
  getLoadDetails,
  getBidsForLoad,
  getBidDetailsForShipper,
  acceptBid,
  rateCarrierForLoad,
} from "../controllers/shipper.controller.js";

const router = Router();

router.use(verifyJWT, upload.none());

router.route("/loads").post(createLoad);
router.route("/loads").get(getAllLoads);
router.route("/loads/:loadId").get(getLoadDetails);  // only for assigned and inTransit
router.route("/loads/:loadId/bids").get(getBidsForLoad);
router.route("/loads/:loadId/rate").post(rateCarrierForLoad);
router.route("/bids/:bidId").get(getBidDetailsForShipper);
router.route("/bids/:bidId/accept").patch(acceptBid);

export default router;
