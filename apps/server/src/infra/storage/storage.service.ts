import { Inject, Injectable } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";
import type { v2 as Cloudinary, UploadApiOptions, UploadApiResponse } from "cloudinary";

@Injectable()
export class StorageService {
  constructor(
    @Inject("CLOUDINARY") private readonly cloudinary: typeof Cloudinary,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async upload(file: string | Buffer, options?: UploadApiOptions): Promise<UploadApiResponse> {
    this.logger.info("Uploading file to Cloudinary");
    return this.cloudinary.uploader.upload(file, options);
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
