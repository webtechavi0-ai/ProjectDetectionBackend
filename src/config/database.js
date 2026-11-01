const mongoose = require('mongoose');

const startFakeDB = async () => {
  // Dev-only dependency; required lazily so production never loads it.
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('geo_outreach_fake');

  const stop = async () => {
    await mongoose.disconnect();
    await mongod.stop();
  };
  process.once('SIGINT', () => stop().finally(() => process.exit(0)));
  process.once('SIGTERM', () => stop().finally(() => process.exit(0)));

  return uri;
};

const connectDB = async () => {
  try {
    const useFake = process.env.USE_FAKE_DB === 'true';
    const uri = useFake ? await startFakeDB() : process.env.MONGODB_URI;
    const conn = await mongoose.connect(uri);

    console.log(
      `✅ MongoDB Connected${useFake ? ' (in-memory fake)' : ''}: ${conn.connection.host}`
    );

    if (useFake) {
      await require('../scripts/seedFakeData')();
    }
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
