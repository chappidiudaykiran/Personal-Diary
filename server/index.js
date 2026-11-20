require('dotenv').config();
const app = require('./src/app');
const { connectDB } = require('./src/config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Listen FIRST so the process stays alive and health checks answer even
  // while the database is still waking up. The DB connects in the
  // background and keeps retrying — the app serves degraded responses
  // (`db: "down"` on /api/health) until Mongo is reachable instead of
  // crash-looping and looking "stuck on starting".
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  if (await connectDB()) return;

  console.error('⏳ MongoDB not reachable — retrying in background every 10s...');
  const retry = setInterval(async () => {
    if (await connectDB()) clearInterval(retry);
  }, 10000);
};

startServer();
