import type { RequestUser } from "./request-user.interface";

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      requestId?: string;
    }
  }
}
