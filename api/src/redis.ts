import Redis from "ioredis";
import { config } from "./config";
export { parseFields, streamFields } from "./stream-codec";

export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
export const redisConsumer = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
