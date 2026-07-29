export interface SocketEventEnvelope<T> {
  event: string;
  shopId: string | null;
  occurredAt: string;
  data: T;
}
