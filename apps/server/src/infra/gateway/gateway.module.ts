import { Module } from "@nestjs/common";
import { AuthModule } from "../../modules/auth/auth.module";
import { AppGateway } from "./app.gateway";
import { GatewayAdapter } from "./gateway.adapter";

@Module({
  imports: [AuthModule],
  providers: [AppGateway, GatewayAdapter],
  exports: [GatewayAdapter],
})
export class GatewayModule {}
