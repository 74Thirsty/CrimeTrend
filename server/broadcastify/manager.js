'use strict';

const { createCacheClient } = require('./cache');
const logger = require('../logger');

const DEFAULT_BASE_URL = 'https://api.broadcastify.com';
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

function extractStateIdentifier(candidate) {
  if (!candidate) {
    return null;
  }

  const possibleIdentifiers = [
    candidate.id,
    candidate.state_id,
    candidate.stateId,
    candidate.identifier,
    candidate.slug,
    candidate.state_code,
    candidate.stateCode,
    candidate.code
  ];

  for (const value of possibleIdentifiers) {
    if (typeof value === 'string' || typeof value === 'number') {
      const trimmed = String(value).trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
}

function normaliseStateEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const candidate = entry;
  const id = extractStateIdentifier(candidate);
  const codeCandidate =
    (typeof candidate.code === 'string' && candidate.code.trim()) ||
    (typeof candidate.abbreviation === 'string' && candidate.abbreviation.trim());
  const code = codeCandidate || (typeof id === 'string' && /^[A-Za-z]{2}$/.test(id) ? id : null);
  const name =
    (typeof candidate.name === 'string' && candidate.name.trim()) ||
    (typeof candidate.description === 'string' && candidate.description.trim()) ||
    (typeof candidate.state === 'string' && candidate.state.trim()) ||
    code;
  if (!code || !name) {
    return null;
  }
  return { code: code.toUpperCase(), name, id: id || code.toUpperCase() };
}

function extractStreamUrl(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const directFields = [
    'stream_url',
    'streamUrl',
    'listen_url',
    'listenUrl',
    'url',
    'stream',
    'audio_url',
    'audioUrl',
    'feed_url',
    'feedUrl'
  ];

  for (const field of directFields) {
    const value = entry[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  const nestedCandidates = [];
  if (Array.isArray(entry.streams)) {
    nestedCandidates.push(...entry.streams);
  }
  if (entry.media && Array.isArray(entry.media.streams)) {
    nestedCandidates.push(...entry.media.streams);
  }
  if (entry.media && Array.isArray(entry.media.audio)) {
    nestedCandidates.push(...entry.media.audio);
  }
  if (entry.links && Array.isArray(entry.links.streams)) {
    nestedCandidates.push(...entry.links.streams);
  }

  for (const candidate of nestedCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
    if (candidate && typeof candidate === 'object') {
      const nestedUrl = extractStreamUrl(candidate);
      if (nestedUrl) {
        return nestedUrl;
      }
      if (typeof candidate.url === 'string' && candidate.url.trim()) {
        return candidate.url.trim();
      }
    }
  }

  if (entry.broadcastify && typeof entry.broadcastify === 'object') {
    const nestedUrl = extractStreamUrl(entry.broadcastify);
    if (nestedUrl) {
      return nestedUrl;
    }
  }

  return null;
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
  const streamUrl = extractStreamUrl(entry);
  const status = typeof entry.status === 'string' ? entry.status.toLowerCase() : entry.status;
  const active = entry.active !== false && status !== 'offline' && status !== 'down';
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
    this.stateCodeLookup = new Map();
    if (!this.fetchImpl) {
      throw new Error('Global fetch API is not available');
    }
  }

  hasCredentials() {
    return Boolean(this.apiKey);
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

  async loadStates(options = {}) {
    if (!this.hasCredentials()) {
      logger.info('broadcastify api key not configured, returning empty state list');
      this.stateCodeLookup = new Map();
      return [];
    }

    const cacheKey = 'broadcastify:states';
    const states = await this._getCachedOrFetch(cacheKey, async () => {
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

    this.stateCodeLookup = new Map();
    for (const state of states) {
      if (state?.code) {
        this.stateCodeLookup.set(state.code.toUpperCase(), state.id || state.code.toUpperCase());
      }
    }

    return states;
  }

  async getStates(options = {}) {
    const states = await this.loadStates(options);
    return states.map(({ code, name }) => ({ code, name }));
  }

  async getStateFeeds(stateId, options = {}) {
    if (!this.hasCredentials()) {
      logger.info('broadcastify api key not configured, skipping state feed lookup', { stateId });
      return [];
    }
    if (!stateId) {
      throw new Error('stateId is required');
    }
    const resolvedStateId = await this.resolveStateIdentifier(stateId, options);
    const cacheKey = `broadcastify:state:${resolvedStateId}:feeds`;
    return this._getCachedOrFetch(cacheKey, async () => {
      const payload = await this.fetchJson(`/calls/states/${encodeURIComponent(resolvedStateId)}`, options);
      const feeds = Array.isArray(payload?.feeds) ? payload.feeds : Array.isArray(payload) ? payload : [];
      return feeds.map((feed) => normaliseFeed(feed)).filter(Boolean);
    }, options);
  }

  async resolveStateIdentifier(stateId, options = {}) {
    const raw = typeof stateId === 'number' ? String(stateId) : String(stateId || '').trim();
    if (!raw) {
      throw new Error('stateId is required');
    }

    const upper = raw.toUpperCase();

    if (!this.stateCodeLookup.size || options.refresh) {
      await this.loadStates(options);
    }

    return this.stateCodeLookup.get(upper) || raw;
  }

  async getStateCounties(stateId, options = {}) {
    if (!this.hasCredentials()) {
      logger.info('broadcastify api key not configured, skipping county lookup', { stateId });
      return [];
    }
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
    if (!this.hasCredentials()) {
      logger.info('broadcastify api key not configured, skipping county feed lookup', { countyId });
      return [];
    }
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
module.exports.extractStreamUrl = extractStreamUrl;
