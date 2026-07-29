import type { RequestUser } from "./request-user.interface";

declare module "socket.io" {
  interface Socket {
    data: {
      user?: RequestUser;
    };
  }
}
