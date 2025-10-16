'use strict';

const { createCacheClient } = require('./cache');
const logger = require('../logger');

const DEFAULT_BASE_URL = 'https://api.broadcastify.com';
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

function normaliseStateEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const candidate = entry;
  const code =
    (typeof candidate.code === 'string' && candidate.code.trim()) ||
    (typeof candidate.id === 'string' && candidate.id.trim()) ||
    (typeof candidate.abbreviation === 'string' && candidate.abbreviation.trim());
  const name =
    (typeof candidate.name === 'string' && candidate.name.trim()) ||
    (typeof candidate.description === 'string' && candidate.description.trim()) ||
    (typeof candidate.state === 'string' && candidate.state.trim()) ||
    code;
  if (!code || !name) {
    return null;
  }
  return { code: code.toUpperCase(), name };
}

function normaliseFeed(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const feedId = entry.feedId || entry.feed_id || entry.id || entry.slug || null;
  const county =
    entry.county ||
    entry.county_name ||
    (entry.location && entry.location.county) ||
    entry.countyName ||
    null;
  const streamUrl = entry.stream_url || entry.streamUrl || entry.url || null;
  const active = entry.active !== false && entry.status !== 'offline';
  const state = entry.state || entry.state_code || entry.stateCode || null;
  return {
    id: feedId,
    county,
    streamUrl,
    active,
    raw: entry,
    state
  };
}

class BroadcastifyManager {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.BROADCASTIFY_API_KEY || '';
    this.baseUrl = options.baseUrl || process.env.BROADCASTIFY_BASE_URL || DEFAULT_BASE_URL;
    this.cacheTtl = options.cacheTtl || DEFAULT_CACHE_TTL_SECONDS;
    this.fetchImpl = options.fetch || (typeof fetch === 'function' ? fetch : null);
    this.cachePromise = createCacheClient();
    this.pending = new Map();
    if (!this.fetchImpl) {
      throw new Error('Global fetch API is not available');
    }
  }

  async getCache() {
    if (!this.cacheClient) {
      this.cacheClient = await this.cachePromise;
    }
    return this.cacheClient;
  }

  async fetchJson(path, { signal } = {}) {
    const url = new URL(path, this.baseUrl).toString();
    const headers = { 'Accept': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    const response = await this.fetchImpl(url, { headers, signal });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const error = new Error(`Broadcastify request failed with status ${response.status}`);
      error.status = response.status;
      error.details = text;
      throw error;
    }
    return response.json();
  }

  async _getCachedOrFetch(cacheKey, fetchFunc, { refresh = false, ttl = this.cacheTtl } = {}) {
    const cache = await this.getCache();
    if (!refresh) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (error) {
          logger.warn('failed to parse broadcastify cache entry', { cacheKey, error: error.message });
        }
      }
    }

    if (this.pending.has(cacheKey)) {
      return this.pending.get(cacheKey);
    }

    const promise = (async () => {
      const result = await fetchFunc();
      try {
        await cache.set(cacheKey, JSON.stringify(result), ttl);
      } catch (error) {
        logger.warn('failed to store broadcastify cache entry', { cacheKey, error: error.message });
      }
      return result;
    })();

    this.pending.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.pending.delete(cacheKey);
    }
  }

  async getStates(options = {}) {
    const cacheKey = 'broadcastify:states';
    return this._getCachedOrFetch(cacheKey, async () => {
      const payload = await this.fetchJson('/calls/states', options);
      const list = Array.isArray(payload?.states) ? payload.states : Array.isArray(payload) ? payload : [];
      const normalised = [];
      const seen = new Set();
      for (const entry of list) {
        const state = normaliseStateEntry(entry);
        if (!state || seen.has(state.code)) {
          continue;
        }
        seen.add(state.code);
        normalised.push(state);
      }
      normalised.sort((a, b) => a.name.localeCompare(b.name));
      return normalised;
    }, options);
  }

  async getStateFeeds(stateId, options = {}) {
    if (!stateId) {
      throw new Error('stateId is required');
    }
    const cacheKey = `broadcastify:state:${stateId}:feeds`;
    return this._getCachedOrFetch(cacheKey, async () => {
      const payload = await this.fetchJson(`/calls/states/${encodeURIComponent(stateId)}`, options);
      const feeds = Array.isArray(payload?.feeds) ? payload.feeds : Array.isArray(payload) ? payload : [];
      return feeds.map((feed) => normaliseFeed(feed)).filter(Boolean);
    }, options);
  }

  async getStateCounties(stateId, options = {}) {
    const feeds = await this.getStateFeeds(stateId, options);
    const counties = new Map();
    for (const feed of feeds) {
      if (!feed?.county) {
        continue;
      }
      const name = String(feed.county).trim();
      if (!name) {
        continue;
      }
      const key = name.toLowerCase();
      if (!counties.has(key)) {
        counties.set(key, { id: key, name, state: stateId });
      }
    }
    return Array.from(counties.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCountyFeeds(countyId, options = {}) {
    if (!countyId) {
      throw new Error('countyId is required');
    }
    const cacheKey = `broadcastify:county:${countyId}:feeds`;
    return this._getCachedOrFetch(cacheKey, async () => {
      const payload = await this.fetchJson(`/calls/counties/${encodeURIComponent(countyId)}`, options);
      const feeds = Array.isArray(payload?.feeds) ? payload.feeds : Array.isArray(payload) ? payload : [];
      return feeds.map((feed) => normaliseFeed(feed)).filter(Boolean);
    }, options);
  }
}

module.exports = BroadcastifyManager;
