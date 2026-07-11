import { Global, Module } from "@nestjs/common";
import { CloudinaryProvider } from "./cloudinary.provider";
import { StorageService } from "./storage.service";

@Global()
@Module({
  providers: [CloudinaryProvider, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
