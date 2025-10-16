'use strict';

const logger = require('../logger');

class CountyHandler {
  constructor(broadcastifyManager, monitor) {
    this.manager = broadcastifyManager;
    this.monitor = monitor;
  }

  async getCountyFeeds(countyId, options = {}) {
    try {
      return await this.manager.getCountyFeeds(countyId, options);
    } catch (error) {
      logger.error('failed to load broadcastify county feeds', { countyId, error: error.message });
      if (this.monitor) {
        this.monitor.trackError(countyId, error);
      }
      throw error;
    }
  }
}

module.exports = CountyHandler;
