'use strict';

class IntegrationMonitor {
  constructor(options = {}) {
    this.errorThreshold = options.errorThreshold || 5;
    this.failureCounts = new Map();
    this.alertHandler = options.alertHandler || null;
  }

  trackError(key, error) {
    const entry = this.failureCounts.get(key) || [];
    entry.push({ timestamp: new Date(), error: error.message || String(error) });
    if (entry.length > this.errorThreshold) {
      entry.shift();
    }
    this.failureCounts.set(key, entry);

    if (entry.length >= this.errorThreshold) {
      this.raiseAlert(key, entry);
    }
  }

  reset(key) {
    this.failureCounts.delete(key);
  }

  raiseAlert(key, failures) {
    if (typeof this.alertHandler === 'function') {
      this.alertHandler(key, failures);
    }
  }
}

module.exports = IntegrationMonitor;
