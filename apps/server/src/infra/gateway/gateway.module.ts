import { Module } from "@nestjs/common";
import { AuthModule } from "../../modules/auth/auth.module";
import { AppGateway } from "./app.gateway";
import { GatewayAdapter } from "./gateway.adapter";
import { DeliveryEventsListener } from "./listeners/delivery-events.listener";
import { TaskEventsListener } from "./listeners/task-events.listener";
import { UserEventsListener } from "./listeners/user-events.listener";

@Module({
  imports: [AuthModule],
  providers: [
    AppGateway,
    GatewayAdapter,
    TaskEventsListener,
    UserEventsListener,
    DeliveryEventsListener,
  ],
  exports: [GatewayAdapter, AppGateway],
})
export class GatewayModule {}
