const fs = require('fs/promises');
const path = require('path');

const BessAsset = require('../models/Bess');

async function seedDatabase() {
  const existingCount = await BessAsset.countDocuments();
  if (existingCount > 0) {
    return { seeded: false, count: existingCount };
  }

  const seedPath = path.join(__dirname, '..', 'data', 'sample-bess-assets.json');
  const raw = await fs.readFile(seedPath, 'utf-8');
  const records = JSON.parse(raw);

  if (!Array.isArray(records) || records.length === 0) {
    return { seeded: false, count: 0 };
  }

  await BessAsset.insertMany(records);
  return { seeded: true, count: records.length };
}

module.exports = { seedDatabase };
