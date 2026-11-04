import { Processor, WorkerHost } from "@nestjs/bullmq";
import { PrismaService } from "@tapt-api/db";
import type { Job } from "bullmq";
import { StorageService } from "../../../infra/storage/storage.service";
import { PROFIT_REPORT_PDF_QUEUE } from "../profit-report.constants";
import { type ProfitReportPdfData, ProfitReportPdfService } from "./profit-report-pdf.service";

const LOGO_FETCH_TIMEOUT_MS = 5_000;
const LOGO_MAX_BYTES = 5 * 1024 * 1024; // 5MB — plenty for a shop logo, caps worst-case job memory
const LOGO_FETCH_RETRIES = 1; // one retry for transient network failures only, not for a clean non-OK response

// Requires Node 18+ (AbortSignal.timeout). Flag if the runtime is older.
async function toLogoDataUri(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl) return null;

  for (let attempt = 0; attempt <= LOGO_FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(logoUrl, { signal: AbortSignal.timeout(LOGO_FETCH_TIMEOUT_MS) });
      if (!res.ok) return null; // a real 4xx/5xx won't fix itself on retry

      const contentLength = res.headers.get("content-length");
      if (contentLength && Number(contentLength) > LOGO_MAX_BYTES) {
        return null; // declared size already over budget — don't read the body
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.byteLength > LOGO_MAX_BYTES) {
        return null; // content-length was missing or lied — enforce the cap post-hoc
      }

      const contentType = res.headers.get("content-type") ?? "image/png";
      return `data:${contentType};base64,${buffer.toString("base64")}`;
    } catch {
      if (attempt === LOGO_FETCH_RETRIES) return null; // render without a logo rather than fail the whole job
    }
  }
  return null;
}

@Processor(PROFIT_REPORT_PDF_QUEUE)
export class ProfitReportPdfProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: ProfitReportPdfService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<{ profitReportId: string }>) {
    const report = await this.prisma.profitReport.findUniqueOrThrow({
      where: { id: job.data.profitReportId },
      include: { shop: true, generatedBy: true },
    });

    const logoDataUri = await toLogoDataUri(report.shop.logoUrl);

    const data: ProfitReportPdfData = {
      shop: {
        name: report.shop.name,
        logoDataUri,
        phone: report.shop.phone,
        address: report.shop.address,
      },
      periodStart: report.periodStart.toISOString(),
      periodEnd: report.periodEnd.toISOString(),
      generatedAt: report.generatedAt.toISOString(),
      generatedByName: report.generatedBy.displayName,
      reportId: report.id,
      revenue: [
        { label: "Scratch Card Sales", amountCents: report.scratchRevenue },
        { label: "Delivery Revenue", amountCents: report.deliveryRevenue },
        { label: "Other Revenue", amountCents: report.otherRevenue },
      ],
      expenses: [
        { label: "Purchase Cost", amountCents: report.purchaseCost },
        { label: "Delivery Cost", amountCents: report.deliveryCost },
        { label: "License Fees", amountCents: report.licenseFees },
        { label: "Salary", amountCents: report.salaryExpense },
        { label: "Utilities", amountCents: report.utilityExpense },
        { label: "Rent", amountCents: report.rentExpense },
        { label: "Other Expenses", amountCents: report.otherExpense },
      ],
      totalRevenue: report.totalRevenue,
      totalExpense: report.totalExpense,
      grossProfit: report.grossProfit,
      netProfit: report.netProfit,
      profitMargin: report.profitMargin,
    };

    const pdf = await this.pdfService.render(data);
    const result = await this.storage.upload(pdf, {
      public_id: `reports/${report.shopId}/${report.id}`,
      resource_type: "raw",
      format: "pdf",
    });

    await this.prisma.report.create({
      data: {
        shopId: report.shopId,
        type: "profit",
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        format: "pdf",
        url: result.secure_url,
        profitReportId: report.id,
      },
    });

    return { url: result.secure_url };
  }
}
