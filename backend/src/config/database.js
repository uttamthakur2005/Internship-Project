const mongoose = require('mongoose');

async function connectDatabase(uri = process.env.MONGO_URI) {
  if (!uri) throw new Error('MONGODB_URI is required');

  try {
    await mongoose.connect(uri);
    console.log('connected to DB');
    return mongoose.connection;
  } catch (error) {
    throw new Error(`MongoDB connection failed: ${error.message}`);
  }
}

module.exports = { connectDatabase };
