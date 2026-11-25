require('dotenv').config();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { connectDatabase } = require('../config/database');

async function seedAdmin() {
  const { SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;
  if (!SEED_ADMIN_NAME || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD || SEED_ADMIN_PASSWORD.length < 8) {
    throw new Error('Set SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, and an 8+ character SEED_ADMIN_PASSWORD');
  }
  await connectDatabase();
  try {
    const existing = await User.findOne({ role: 'admin', isActive: true });
    if (existing) throw new Error('An active admin already exists; refusing to create another seed admin');
    const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);
    await User.create({
      name: SEED_ADMIN_NAME,
      email: SEED_ADMIN_EMAIL.trim().toLowerCase(),
      passwordHash,
      role: 'admin',
      isActive: true
    });
    console.log(`Created initial admin ${SEED_ADMIN_EMAIL.trim().toLowerCase()}`);
  } finally {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  }
}

seedAdmin().catch((error) => {
  console.error('Unable to seed admin:', error.message);
  process.exitCode = 1;
});
