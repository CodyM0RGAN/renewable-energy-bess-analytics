#!/usr/bin/env node
const path = require('path');

const mongoose = require('mongoose');
const dotenv = require('dotenv');

const { ingestTelemetryFromFile } = require('../src/ingestion/nasaTelemetry');

dotenv.config();

const datasetArg = process.argv[2];
const datasetPath = datasetArg
  ? path.resolve(process.cwd(), datasetArg)
  : path.join(__dirname, '..', 'data', 'nasa-bess-telemetry-sample.json');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bess_analytics';

async function run() {
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(MONGO_URI);
    console.log(`Connected to MongoDB at ${MONGO_URI}`);

    const { assetsProcessed, newAssets, metricsInserted } = await ingestTelemetryFromFile(
      datasetPath,
      { logger: console },
    );

    console.log(`Processed ${assetsProcessed} NASA BESS assets from ${datasetPath}`);
    console.log(`New assets inserted: ${newAssets}`);
    console.log(`Telemetry points ingested: ${metricsInserted}`);
  } catch (error) {
    console.error('NASA telemetry ingestion failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
