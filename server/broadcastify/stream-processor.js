'use strict';

const managerModule = require('./manager');
const extractStreamUrl = managerModule.extractStreamUrl || (() => null);

class StreamProcessor {
  constructor(broadcastifyManager) {
    this.manager = broadcastifyManager;
  }

  processStream(feedData) {
    if (!feedData || typeof feedData !== 'object') {
      return null;
    }

    if (!feedData.active) {
      return null;
    }

    const streamUrl = this.resolveStreamUrl(feedData);
    if (!this.isValidStreamUrl(streamUrl)) {
      return null;
    }

    return streamUrl;
  }

  resolveStreamUrl(feedData) {
    if (!feedData) {
      return null;
    }

    if (typeof feedData.streamUrl === 'string') {
      return feedData.streamUrl;
    }

    if (feedData.raw) {
      try {
        return extractStreamUrl(feedData.raw);
      } catch (_) {
        return null;
      }
    }

    return null;
  }

  isValidStreamUrl(url) {
    if (typeof url !== 'string') {
      return false;
    }
    return url.startsWith('http://') || url.startsWith('https://');
  }
}

module.exports = StreamProcessor;
