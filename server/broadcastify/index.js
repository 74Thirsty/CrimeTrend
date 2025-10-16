'use strict';

const BroadcastifyManager = require('./manager');
const StateHandler = require('./state-handler');
const CountyHandler = require('./county-handler');
const StreamProcessor = require('./stream-processor');
const IntegrationMonitor = require('./monitor');

function createBroadcastifyIntegration(options = {}) {
  const monitor = new IntegrationMonitor(options.monitor);
  const manager = new BroadcastifyManager(options.manager || {});
  const stateHandler = new StateHandler(manager, monitor);
  const countyHandler = new CountyHandler(manager, monitor);
  const streamProcessor = new StreamProcessor(manager);
  return {
    manager,
    stateHandler,
    countyHandler,
    streamProcessor,
    monitor
  };
}

module.exports = {
  BroadcastifyManager,
  StateHandler,
  CountyHandler,
  StreamProcessor,
  IntegrationMonitor,
  createBroadcastifyIntegration
};
