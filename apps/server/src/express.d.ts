import type { RequestUser } from "./common/types/request-user.interface";

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}
