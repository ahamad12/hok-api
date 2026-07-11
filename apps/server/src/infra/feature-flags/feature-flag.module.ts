import { Global, Module } from "@nestjs/common";
import { GrowthBookService } from "./growthbook.service";

@Global()
@Module({
  providers: [GrowthBookService],
  exports: [GrowthBookService],
})
export class FeatureFlagModule {}
