#!/usr/bin/env node
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const { fetchTelemetrySummary } = require('../src/ingestion/nasaTelemetry');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bess_analytics';
const assetIds = process.argv.slice(2);

function formatTimestamp(ts) {
  return ts instanceof Date && !Number.isNaN(ts.getTime()) ? ts.toISOString() : 'n/a';
}

async function run() {
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(MONGO_URI);

    const summary = await fetchTelemetrySummary({ assetIds });

    if (summary.length === 0) {
      if (assetIds.length > 0) {
        console.log(`No telemetry found for asset IDs: ${assetIds.join(', ')}`);
      } else {
        console.log('No BESS telemetry records found in MongoDB.');
      }
      return;
    }

    for (const asset of summary) {
      console.log(`Asset ${asset.assetId} (${asset.site}, ${asset.region})`);
      console.log(`  Telemetry samples: ${asset.metricsCount}`);
      console.log(`  Latest sample: ${formatTimestamp(asset.latestTimestamp)}`);
      console.log(
        `  Avg state-of-charge: ${asset.averageStateOfCharge !== null
          ? asset.averageStateOfCharge.toFixed(3)
          : 'n/a'}`,
      );
      console.log('');
    }
  } catch (error) {
    console.error('Failed to verify NASA telemetry:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
