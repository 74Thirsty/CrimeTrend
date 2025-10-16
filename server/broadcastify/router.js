'use strict';

const logger = require('../logger');

function createBroadcastifyRouter(integration) {
  if (!integration) {
    throw new Error('Broadcastify integration instance is required');
  }

  const { stateHandler, countyHandler, streamProcessor, monitor } = integration;

  async function handleStatesRequest(res, url, options) {
    const states = await stateHandler.getStates(options);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify({ states }));
  }

  async function handleStateCountiesRequest(res, stateId, options) {
    const counties = await stateHandler.getStateCounties(stateId, options);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify({ state: stateId, counties }));
  }

  async function handleStateFeeds(res, stateId, options) {
    const feeds = await stateHandler.getStateFeeds(stateId, options);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify({ state: stateId, feeds }));
  }

  async function handleCountyFeeds(res, countyId, options) {
    const feeds = await countyHandler.getCountyFeeds(countyId, options);
    const processed = feeds
      .map((feed) => ({
        id: feed.id,
        county: feed.county,
        state: feed.state,
        streamUrl: streamProcessor.processStream(feed),
        active: Boolean(feed.active)
      }))
      .filter((feed) => Boolean(feed.streamUrl));

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify({ county: countyId, feeds: processed }));
  }

  return async function handleBroadcastifyRequest(req, res, parsedUrl) {
    if (!parsedUrl.pathname.startsWith('/api/broadcastify')) {
      return false;
    }

    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return true;
    }

    const refresh = parsedUrl.searchParams.get('refresh') === 'true';
    const options = { refresh };

    try {
      if (parsedUrl.pathname === '/api/broadcastify/states') {
        await handleStatesRequest(res, parsedUrl, options);
        return true;
      }

      const stateMatch = parsedUrl.pathname.match(/^\/api\/broadcastify\/states\/(.+?)(?:\/(counties|feeds))?$/);
      if (stateMatch) {
        const stateId = decodeURIComponent(stateMatch[1]);
        const segment = stateMatch[2];
        if (!segment || segment === 'feeds') {
          await handleStateFeeds(res, stateId, options);
        } else {
          await handleStateCountiesRequest(res, stateId, options);
        }
        return true;
      }

      const countyMatch = parsedUrl.pathname.match(/^\/api\/broadcastify\/counties\/(.+?)\/feeds$/);
      if (countyMatch) {
        const countyId = decodeURIComponent(countyMatch[1]);
        await handleCountyFeeds(res, countyId, options);
        return true;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return true;
    } catch (error) {
      logger.error('broadcastify api handler failure', { error: error.message });
      if (monitor) {
        monitor.trackError('router', error);
      }
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Broadcastify upstream failure' }));
      return true;
    }
  };
}

module.exports = { createBroadcastifyRouter };
