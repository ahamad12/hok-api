import { Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import type sgMail from "@sendgrid/mail";
import { env } from "@tapt-api/env/server";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    type: string;
    disposition?: "attachment" | "inline";
    contentId?: string;
  }>;
  categories?: string[];
  sendAt?: number;
}

export interface BatchEmailItem {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  categories?: string[];
}

export interface TemplateEmailOptions {
  to: string | string[];
  templateId: string;
  dynamicTemplateData: Record<string, unknown>;
  from?: string;
  categories?: string[];
}

@Injectable()
export class EmailService {
  constructor(
    @Inject("SENDGRID") private readonly sendGrid: typeof sgMail,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async send(options: SendEmailOptions) {
    const { to, subject, html, text, from, replyTo, attachments, categories, sendAt } = options;
    const fromAddress = from || env.SENDGRID_FROM_EMAIL;
    const toAddresses = Array.isArray(to) ? to : [to];

    const msg = {
      to: toAddresses,
      from: fromAddress,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
      replyTo: replyTo || undefined,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        type: a.type,
        disposition: a.disposition || "attachment",
        contentId: a.contentId,
      })),
      categories,
      sendAt,
    } as sgMail.MailDataRequired;

    try {
      const [response] = await this.sendGrid.send(msg);
      this.logger.info("Email sent", { to: toAddresses, statusCode: response.statusCode });
      return { success: true, statusCode: response.statusCode };
    } catch (error) {
      // biome-ignore lint/suspicious/noExplicitAny: SendGrid errors are untyped
      const sgDetails = (error as any)?.response?.body || (error as Error).message;
      throw new InternalServerErrorException(`Email delivery failed: ${JSON.stringify(sgDetails)}`);
    }
  }

  async sendBatch(emails: BatchEmailItem[]) {
    const fromAddress = env.SENDGRID_FROM_EMAIL;
    const messages = emails.map((email) => ({
      to: Array.isArray(email.to) ? email.to : [email.to],
      from: email.from || fromAddress,
      subject: email.subject,
      ...(email.html ? { html: email.html } : {}),
      ...(email.text ? { text: email.text } : {}),
      categories: email.categories,
    })) as sgMail.MailDataRequired[];

    try {
      const [response] = await this.sendGrid.send(messages);
      this.logger.info("Batch emails sent", {
        count: emails.length,
        statusCode: response.statusCode,
      });
      return { success: true, statusCode: response.statusCode };
    } catch (error) {
      // biome-ignore lint/suspicious/noExplicitAny: SendGrid errors are untyped
      const sgDetails = (error as any)?.response?.body || (error as Error).message;
      throw new InternalServerErrorException(
        `Batch email delivery failed: ${JSON.stringify(sgDetails)}`,
      );
    }
  }

  async sendTemplate(options: TemplateEmailOptions) {
    const { to, templateId, dynamicTemplateData, from, categories } = options;
    const fromAddress = from || env.SENDGRID_FROM_EMAIL;
    const toAddresses = Array.isArray(to) ? to : [to];

    try {
      const [response] = await this.sendGrid.send({
        to: toAddresses,
        from: fromAddress,
        templateId,
        dynamicTemplateData,
        categories,
      } as sgMail.MailDataRequired);
      this.logger.info("Template email sent", {
        to: toAddresses,
        templateId,
        statusCode: response.statusCode,
      });
      return { success: true, statusCode: response.statusCode };
    } catch (error) {
      // biome-ignore lint/suspicious/noExplicitAny: SendGrid errors are untyped
      const sgDetails = (error as any)?.response?.body || (error as Error).message;
      throw new InternalServerErrorException(
        `Template email delivery failed: ${JSON.stringify(sgDetails)}`,
      );
    }
  }
}
