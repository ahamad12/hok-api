import { Global, Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { SendGridProvider } from "./sendgrid.provider";

@Global()
@Module({
  providers: [SendGridProvider, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
