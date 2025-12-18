import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  addVehicle,
  deleteVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
} from "../controllers/vehicle.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/")
    .post(addVehicle)       
    .get(getAllVehicles);   

router.route("/:vehicleId")
    .get(getVehicleById)    
    .patch(updateVehicle)   
    .delete(deleteVehicle); 

export default router;
