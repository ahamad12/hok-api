import { vi } from "vitest";

export interface RedisClientMock {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  setex: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  psubscribe: ReturnType<typeof vi.fn>;
  punsubscribe: ReturnType<typeof vi.fn>;
  onMessage: ReturnType<typeof vi.fn>;
  subscribeAsync: ReturnType<typeof vi.fn>;
  psubscribeAsync: ReturnType<typeof vi.fn>;
}

export function createRedisClientMock(): RedisClientMock {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    setex: vi.fn(),
    on: vi.fn(),
    quit: vi.fn(),
    publish: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    psubscribe: vi.fn(),
    punsubscribe: vi.fn(),
    onMessage: vi.fn(),
    subscribeAsync: vi.fn(),
    psubscribeAsync: vi.fn(),
  };
}
