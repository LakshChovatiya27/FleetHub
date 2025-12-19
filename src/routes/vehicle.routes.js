import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.middleware.js";
import {
  addVehicle,
  deleteVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicleStatus,
} from "../controllers/vehicle.controller.js";

const router = Router();

router.use(verifyJWT, upload.none());

router.route("/")
    .post(addVehicle)       
    .get(getAllVehicles);   

router.route("/:vehicleId")
    .get(getVehicleById)    
    .patch(updateVehicleStatus)   
    .delete(deleteVehicle); 

export default router;
