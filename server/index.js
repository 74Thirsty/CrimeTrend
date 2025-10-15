const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const IncidentService = require('./incident-service');
const logger = require('./logger');

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 8080;
const INCIDENT_STREAM_PATH = '/stream/incidents';

const incidentService = new IncidentService();
incidentService.start();

const sseClients = new Set();

const SSE_RETRY_MS = 5000;

function cleanupSseClient(client, reason = 'unknown') {
  if (!client || client.closed) return;
  client.closed = true;
  clearInterval(client.heartbeat);
  if (typeof client.teardown === 'function') {
    try {
      client.teardown();
    } catch (error) {
      logger.warn('failed to teardown SSE client listeners', { error: error.message });
    }
  }
  if (sseClients.delete(client)) {
    logger.info('client disconnected from SSE', { total: sseClients.size, reason });
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function serveFile(res, filePath, contentType = 'text/plain') {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
      logger.error('failed to read static asset', { filePath, error: err.message });
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': contentType.startsWith('text/') ? 'no-store' : 'public, max-age=60'
    });
    res.end(data);
  });
}

function getContentType(ext) {
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.json':
      return 'application/json; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function handleSse(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (req.socket && typeof req.socket.setTimeout === 'function') {
    req.socket.setTimeout(0);
  }
  res.write(`retry: ${SSE_RETRY_MS}\n\n`);

  const client = { res, heartbeat: null, teardown: null, closed: false };
  client.heartbeat = setInterval(() => {
    try {
      res.write('event: heartbeat\n');
      res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
    } catch (error) {
      cleanupSseClient(client, 'heartbeat-write-failed');
    }
  }, 25000);
  sseClients.add(client);
  logger.info('client connected to SSE', { total: sseClients.size });

  const snapshotPayload = JSON.stringify({ incidents: incidentService.getSnapshot() });
  try {
    res.write(`data: ${snapshotPayload}\n\n`);
  } catch (error) {
    cleanupSseClient(client, 'initial-write-failed');
    return;
  }

  const onClientClosed = () => cleanupSseClient(client, 'connection-closed');
  const onClientError = () => cleanupSseClient(client, 'request-error');
  const onResponseError = () => cleanupSseClient(client, 'response-error');
  client.teardown = () => {
    if (typeof req.off === 'function') {
      req.off('close', onClientClosed);
      req.off('error', onClientError);
    } else {
      req.removeListener?.('close', onClientClosed);
      req.removeListener?.('error', onClientError);
    }
    if (typeof res.off === 'function') {
      res.off('error', onResponseError);
    } else {
      res.removeListener?.('error', onResponseError);
    }
  };
  req.on('close', onClientClosed);
  req.on('error', onClientError);
  res.on('error', onResponseError);
}

incidentService.on('update', (incidents) => {
  const payload = JSON.stringify({ incidents });
  for (const client of sseClients) {
    if (client.res.writableEnded || client.res.destroyed) {
      cleanupSseClient(client, 'stream-ended');
      continue;
    }
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch (error) {
      logger.warn('failed to deliver SSE payload', { error: error.message });
      cleanupSseClient(client, 'write-failed');
    }
  }
});

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && parsedUrl.pathname === INCIDENT_STREAM_PATH) {
    return handleSse(req, res);
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/api/incidents') {
    return sendJson(res, 200, { incidents: incidentService.getSnapshot() });
  }

  if (req.method === 'GET' && parsedUrl.pathname.startsWith('/api/incidents/')) {
    const incidentId = decodeURIComponent(parsedUrl.pathname.replace('/api/incidents/', ''));
    const incident = incidentService.incidents.get(incidentId);
    if (!incident) {
      return sendJson(res, 404, { error: 'Incident not found' });
    }
    return sendJson(res, 200, { incident });
  }

  const publicPath = path.join(__dirname, '..', 'public');
  let requestedPath = path.join(publicPath, parsedUrl.pathname);
  if (parsedUrl.pathname === '/') {
    requestedPath = path.join(publicPath, 'index.html');
  }

  if (!requestedPath.startsWith(publicPath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(requestedPath);
  serveFile(res, requestedPath, getContentType(ext));
});

server.listen(PORT, () => {
  logger.info('server listening', { port: PORT });
});

process.on('SIGINT', () => {
  logger.info('shutting down');
  incidentService.stop();
  server.close(() => {
    process.exit(0);
  });
});
