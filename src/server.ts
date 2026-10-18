import { createServer, Server as HTTPServer } from 'http';
import app from './app';
import { initiateSuperAdmin } from './app/DB';
import config from './config';

const port = config.port;

async function main() {
  const server: HTTPServer = createServer(app);

  server.listen(port, async () => {
    console.info(`🚀 Server running on port ${port} [${config.env}]`);
    await initiateSuperAdmin();
  });

  const gracefulShutdown = (signal: string) => {
    console.info(`\n${signal} received — shutting down gracefully`);
    server.close(() => {
      console.info('✅ HTTP server closed');
      process.exit(0);
    });

    // Force exit if server hasn't closed in 10s
    setTimeout(() => {
      console.error('⚠️  Forcibly shutting down after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('uncaughtException', (error: Error) => {
    console.error('💥 Uncaught Exception:', error.message, error.stack);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('💥 Unhandled Rejection:', reason);
    gracefulShutdown('unhandledRejection');
  });

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

main();
