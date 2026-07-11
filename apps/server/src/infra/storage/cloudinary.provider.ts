import { env } from "@tapt-api/env/server";
import { v2 as cloudinary } from "cloudinary";

export const CloudinaryProvider = {
  provide: "CLOUDINARY",
  useFactory: () => {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    return cloudinary;
  },
};
