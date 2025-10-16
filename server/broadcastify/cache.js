'use strict';

const logger = require('../logger');

class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttlSeconds) {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key) {
    this.store.delete(key);
  }
}

class RedisCache {
  constructor(client) {
    this.client = client;
  }

  async get(key) {
    return this.client.get(key);
  }

  async set(key, value, ttlSeconds) {
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async delete(key) {
    await this.client.del(key);
  }
}

async function createCacheClient() {
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT ? Number.parseInt(process.env.REDIS_PORT, 10) : undefined;
  if (!redisHost) {
    logger.info('initialising in-memory broadcastify cache');
    return new MemoryCache();
  }

  let redis;
  try {
    redis = require('redis');
  } catch (error) {
    logger.warn('redis package not available, falling back to in-memory cache', { error: error.message });
    return new MemoryCache();
  }

  const client = redis.createClient({
    url: `redis://${redisHost}${redisPort ? `:${redisPort}` : ''}`
  });

  client.on('error', (error) => {
    logger.error('redis cache error', { error: error.message });
  });

  try {
    await client.connect();
    logger.info('connected to redis cache for broadcastify integration');
    return new RedisCache(client);
  } catch (error) {
    logger.error('failed to connect to redis cache, using in-memory fallback', { error: error.message });
    return new MemoryCache();
  }
}

module.exports = {
  MemoryCache,
  RedisCache,
  createCacheClient
};
