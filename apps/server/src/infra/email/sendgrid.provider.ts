import sgMail from "@sendgrid/mail";
import { env } from "@tapt-api/env/server";

export const SendGridProvider = {
  provide: "SENDGRID",
  useFactory: () => {
    if (env.SENDGRID_API_KEY) {
      sgMail.setApiKey(env.SENDGRID_API_KEY);
    }
    return sgMail;
  },
};
