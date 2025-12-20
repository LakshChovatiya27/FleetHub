import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.middleware.js";
import {
  addVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicleStatus,
  markVehicleMaintenance,
  removeVehicle
} from "../controllers/vehicle.controller.js";

const router = Router();

router.use(verifyJWT, upload.none());

router.route("/")
    .post(addVehicle)       
    .get(getAllVehicles);   

router.route("/:vehicleId")
    .get(getVehicleById)    
    .patch(updateVehicleStatus)   
    .delete(removeVehicle);
    
router.route("/:vehicleId/maintenance")
    .patch(markVehicleMaintenance);

export default router;