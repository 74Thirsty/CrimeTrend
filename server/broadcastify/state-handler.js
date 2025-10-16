'use strict';

const logger = require('../logger');

class StateHandler {
  constructor(broadcastifyManager, monitor) {
    this.manager = broadcastifyManager;
    this.monitor = monitor;
  }

  async getStates(options = {}) {
    try {
      return await this.manager.getStates(options);
    } catch (error) {
      logger.error('failed to load broadcastify states', { error: error.message });
      if (this.monitor) {
        this.monitor.trackError('states', error);
      }
      throw error;
    }
  }

  async getStateFeeds(stateId, options = {}) {
    try {
      return await this.manager.getStateFeeds(stateId, options);
    } catch (error) {
      logger.error('failed to load broadcastify state feeds', { stateId, error: error.message });
      if (this.monitor) {
        this.monitor.trackError(stateId, error);
      }
      throw error;
    }
  }

  async getStateCounties(stateId, options = {}) {
    try {
      return await this.manager.getStateCounties(stateId, options);
    } catch (error) {
      logger.error('failed to load broadcastify counties', { stateId, error: error.message });
      if (this.monitor) {
        this.monitor.trackError(stateId, error);
      }
      throw error;
    }
  }
}

module.exports = StateHandler;
