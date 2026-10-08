import app from './app.js';
import { env, validateEnv } from './config/env.js';

validateEnv();

const preferredPort = parseInt(env.PORT, 10) || 5000;

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`=========================================`);
    console.log(` AgriGuide Express Backend Server`);
    console.log(` Running on: http://localhost:${port}`);
    console.log(` Health check: http://localhost:${port}/api/health`);
    console.log(` Environment: ${env.NODE_ENV}`);
    console.log(`=========================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server] Port ${port} is occupied (macOS ControlCenter / AirPlay Receiver often uses port 5000).`);
      const nextPort = port + 1;
      console.log(`[Server] Retrying on fallback port http://localhost:${nextPort}...`);
      startServer(nextPort);
    } else {
      console.error('[Server] Unexpected listen error:', err);
    }
  });
}

startServer(preferredPort);
