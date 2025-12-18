import { v2 as cloudinary } from 'cloudinary';
import fs from "fs"

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

export const safeRemoveFile = (filePath) => {
  if (!filePath) return;
  try {
    fs.rmSync(filePath, { force: true });
  } catch (_) { }
}

export const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;   
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",   
      folder: "FleetHub" 
    })
    safeRemoveFile(localFilePath);
    return response; 
  } 
  catch (error) {
    console.error("Cloudinary Upload Error:", error);
    safeRemoveFile(localFilePath);
    return null;    
  }
}