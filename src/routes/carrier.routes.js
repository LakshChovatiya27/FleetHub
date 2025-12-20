import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.middleware.js";
import {
  getEligibleLoads,
  getCarrierLoadDetails,
  markLoadNotInterested,
  getEligibleVehiclesForLoad,
  placeBid,
  getCarrierBids,
  getCarrierBidDetails,
  startLoadTransit,
  markLoadDelivered
} from "../controllers/carrier.controller.js";

const router = Router();

router.use(verifyJWT, upload.none());

router.route("/loads").get(getEligibleLoads);
router.route("/loads/:loadId").get(getCarrierLoadDetails);
router.route("/loads/:loadId/not-interested").post(markLoadNotInterested);
router.route("/loads/:loadId/eligible-vehicles").get(getEligibleVehiclesForLoad);
router.route("/loads/:loadId/bid").post(placeBid);
router.route("/loads/:loadId/start-transit").patch(startLoadTransit);
router.route("/loads/:loadId/delivered").patch(markLoadDelivered);
router.route("/bids").get(getCarrierBids);
router.route("/bids/:bidId").get(getCarrierBidDetails);  // only for bidded and booked

export default router;
