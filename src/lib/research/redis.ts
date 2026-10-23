import "server-only";
import { createClient, type RedisClientType } from "redis";

export class RedisUnavailableError extends Error {
  constructor(message = "Redis is unavailable") {
    super(message);
    this.name = "RedisUnavailableError";
  }
}

type RedisClient = RedisClientType;
let client: RedisClient | null = null;
let connection: Promise<RedisClient> | null = null;

export function getRedisUrl(): string | null {
  return process.env.RESEARCH_REDIS_URL || process.env.REDIS_URL || null;
}

export async function getRedisClient(): Promise<RedisClient> {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    throw new RedisUnavailableError("Redis is not configured");
  }
  if (client?.isReady) {
    return client;
  }
  if (connection) {
    return connection;
  }

  const nextClient = createClient({
    url: redisUrl,
    socket: { connectTimeout: 3_000, reconnectStrategy: false },
  });
  nextClient.on("error", () => {});

  connection = nextClient
    .connect()
    .then(() => {
      client = nextClient;
      return nextClient;
    })
    .catch(() => {
      if (nextClient.isOpen) {
        nextClient.destroy();
      }
      throw new RedisUnavailableError();
    })
    .finally(() => {
      connection = null;
    });
  return connection;
}

export async function closeRedisClient() {
  if (client?.isOpen) {
    await client.quit();
  }
  client = null;
  connection = null;
}
