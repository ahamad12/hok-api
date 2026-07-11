import { Global, Module } from "@nestjs/common";
import { SendGridProvider } from "./sendgrid.provider";
import { EmailService } from "./email.service";

@Global()
@Module({
  providers: [SendGridProvider, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
