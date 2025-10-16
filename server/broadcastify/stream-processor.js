'use strict';

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

    const streamUrl = feedData.streamUrl;
    if (!this.isValidStreamUrl(streamUrl)) {
      return null;
    }

    return streamUrl;
  }

  isValidStreamUrl(url) {
    if (typeof url !== 'string') {
      return false;
    }
    return url.startsWith('http://') || url.startsWith('https://');
  }
}

module.exports = StreamProcessor;
