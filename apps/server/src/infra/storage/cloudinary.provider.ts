import { env } from "@tapt-api/env/server";
import { v2 as cloudinary } from "cloudinary";

export const CloudinaryProvider = {
  provide: "CLOUDINARY",
  useFactory: () => {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      console.warn("[Cloudinary] Config incomplete — some env vars are undefined");
    }

    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
    return cloudinary;
  },
};
