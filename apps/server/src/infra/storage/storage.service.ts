import { Inject, Injectable } from "@nestjs/common";
import type { v2 as Cloudinary, UploadApiOptions, UploadApiResponse } from "cloudinary";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

@Injectable()
export class StorageService {
  constructor(
    @Inject("CLOUDINARY") private readonly cloudinary: typeof Cloudinary,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async upload(file: string | Buffer, options?: UploadApiOptions): Promise<UploadApiResponse> {
    this.logger.info("Uploading file to Cloudinary");
    if (typeof file === "string") {
      return this.cloudinary.uploader.upload(file, options);
    }
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = this.cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error || !result) reject(error ?? new Error("Upload failed"));
        else resolve(result);
      });
      stream.end(file);
    });
  }

  async delete(publicId: string): Promise<void> {
    this.logger.info("Deleting file from Cloudinary", { publicId });
    await this.cloudinary.uploader.destroy(publicId);
  }

  getUrl(publicId: string, options?: Record<string, unknown>): string {
    return this.cloudinary.url(publicId, {
      fetch_format: "auto",
      quality: "auto",
      secure: true,
      ...options,
    });
  }
}
