import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  StreamableFile,
} from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";

type ControllerReturn =
  | undefined
  | null
  | StreamableFile
  | { success: boolean; data?: unknown; [key: string]: unknown }
  | unknown;

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(map((response) => this.transform(response as ControllerReturn)));
  }

  private transform(response: ControllerReturn): unknown {
    if (response === undefined || response === null) {
      return response;
    }

    if (response instanceof StreamableFile) {
      return response;
    }

    if (
      typeof response === "object" &&
      response !== null &&
      !Array.isArray(response) &&
      "success" in response
    ) {
      return response;
    }

    if (
      typeof response === "object" &&
      response !== null &&
      !Array.isArray(response) &&
      "meta" in response
    ) {
      const { meta, data, ...rest } = response as {
        meta: Record<string, unknown>;
        data?: unknown;
        [key: string]: unknown;
      };
      return { success: true, data: data !== undefined ? data : rest, meta };
    }

    if (
      typeof response === "object" &&
      response !== null &&
      !Array.isArray(response) &&
      "data" in response
    ) {
      return { success: true, ...(response as Record<string, unknown>) };
    }

    return { success: true, data: response };
  }
}
