const fs = require('fs/promises');
const path = require('path');

const BessAsset = require('../../models/Bess');

function normaliseMetric(metric, assetId) {
  if (!metric || typeof metric !== 'object') {
    throw new Error(`Invalid metric payload for asset ${assetId || 'unknown'}`);
  }

  const timestamp = new Date(metric.timestamp);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Metric timestamp is invalid for asset ${assetId}`);
  }

  const stateOfCharge = Number(metric.stateOfCharge);
  const temperatureC = Number(metric.temperatureC);

  if (!Number.isFinite(stateOfCharge) || !Number.isFinite(temperatureC)) {
    throw new Error(`Metric numeric values are invalid for asset ${assetId}`);
  }

  return {
    timestamp,
    stateOfCharge,
    temperatureC,
  };
}

function normaliseAsset(record) {
  if (!record || typeof record !== 'object') {
    throw new Error('Each telemetry record must be an object');
  }

  const {
    assetId,
    site,
    region,
    capacityMWh,
    powerRatingMW,
    roundTripEfficiency,
    availability,
    status = 'online',
    metrics = [],
  } = record;

  if (!assetId) {
    throw new Error('Asset is missing an assetId');
  }

  const requiredNumericFields = {
    capacityMWh,
    powerRatingMW,
    roundTripEfficiency,
    availability,
  };

  for (const [field, value] of Object.entries(requiredNumericFields)) {
    if (!Number.isFinite(Number(value))) {
      throw new Error(`Asset ${assetId} is missing required numeric field ${field}`);
    }
  }

  const metricList = Array.isArray(metrics)
    ? metrics.map((metric) => normaliseMetric(metric, assetId))
    : [];

  return {
    assetId,
    site,
    region,
    capacityMWh: Number(capacityMWh),
    powerRatingMW: Number(powerRatingMW),
    roundTripEfficiency: Number(roundTripEfficiency),
    availability: Number(availability),
    status,
    metrics: metricList,
  };
}

async function loadTelemetryFromFile(filePath) {
  const resolved = path.resolve(filePath);
  const raw = await fs.readFile(resolved, 'utf-8');
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error('NASA telemetry file must contain an array of assets');
  }

  return data.map(normaliseAsset);
}

async function ingestTelemetry(records, options = {}) {
  if (!Array.isArray(records)) {
    throw new Error('records must be an array');
  }

  const logger = options.logger || console;
  const Model = options.model || BessAsset;

  let assetsProcessed = 0;
  let newAssets = 0;
  let metricsInserted = 0;

  for (const record of records) {
    const asset = normaliseAsset(record);
    assetsProcessed += 1;

    // Attempt to locate an existing asset.
    const existing = await Model.findOne({ assetId: asset.assetId });

    if (existing) {
      existing.site = asset.site;
      existing.region = asset.region;
      existing.capacityMWh = asset.capacityMWh;
      existing.powerRatingMW = asset.powerRatingMW;
      existing.roundTripEfficiency = asset.roundTripEfficiency;
      existing.availability = asset.availability;
      existing.status = asset.status;

      const existingIndex = new Set(
        existing.metrics.map((metric) => metric.timestamp.toISOString()),
      );

      for (const metric of asset.metrics) {
        const key = metric.timestamp.toISOString();
        if (!existingIndex.has(key)) {
          existing.metrics.push(metric);
          existingIndex.add(key);
          metricsInserted += 1;
        }
      }

      existing.lastUpdated = new Date();
      await existing.save();
      logger.debug?.(`Updated NASA telemetry for ${asset.assetId}`);
    } else {
      await Model.create({
        ...asset,
        lastUpdated: new Date(),
      });
      newAssets += 1;
      metricsInserted += asset.metrics.length;
      logger.debug?.(`Inserted NASA telemetry for ${asset.assetId}`);
    }
  }

  return { assetsProcessed, newAssets, metricsInserted };
}

async function ingestTelemetryFromFile(filePath, options = {}) {
  const records = await loadTelemetryFromFile(filePath);
  return ingestTelemetry(records, options);
}

async function fetchTelemetrySummary({ assetIds } = {}, options = {}) {
  const filter = Array.isArray(assetIds) && assetIds.length > 0
    ? { assetId: { $in: assetIds } }
    : {};

  const Model = options.model || BessAsset;
  const assets = await Model.find(filter);

  return assets.map((asset) => {
    const metrics = Array.isArray(asset.metrics) ? asset.metrics : [];
    const metricsCount = metrics.length;

    let latestTimestamp = null;
    let totalStateOfCharge = 0;

    for (const metric of metrics) {
      const metricTimestamp = new Date(metric.timestamp);
      if (!latestTimestamp || metricTimestamp > latestTimestamp) {
        latestTimestamp = metricTimestamp;
      }
      totalStateOfCharge += Number(metric.stateOfCharge) || 0;
    }

    const averageStateOfCharge = metricsCount > 0
      ? totalStateOfCharge / metricsCount
      : null;

    return {
      assetId: asset.assetId,
      site: asset.site,
      region: asset.region,
      metricsCount,
      latestTimestamp,
      averageStateOfCharge,
    };
  });
}

module.exports = {
  fetchTelemetrySummary,
  ingestTelemetry,
  ingestTelemetryFromFile,
  loadTelemetryFromFile,
  normaliseAsset,
  normaliseMetric,
};
