const mongoose = require('mongoose');

let isConnected = false;

// Returns true on success, false on failure — never kills the process.
// A failed boot used to call process.exit(1), which crash-looped the host
// (Render 503) and looked "stuck on starting" until Mongo was reachable.
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    if (!isConnected) console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    isConnected = true;
    return true;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    isConnected = false;
    return false;
  }
};

mongoose.connection.on('disconnected', () => {
  if (isConnected) console.error('⚠️ MongoDB disconnected — background retry will pick it up');
  isConnected = false;
});

const isDbConnected = () => isConnected && mongoose.connection.readyState === 1;

module.exports = { connectDB, isDbConnected };
