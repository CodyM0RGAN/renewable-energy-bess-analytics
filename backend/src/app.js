const express = require('express');
const cors = require('cors');

const BessAsset = require('../models/Bess');

function calculateDashboardMetrics(assets) {
  if (!assets.length) {
    return {
      totalAssets: 0,
      totalCapacityMWh: 0,
      averageAvailability: 0,
      averageRoundTripEfficiency: 0,
      capacityByRegion: [],
      statusBreakdown: [],
      stateOfChargeTrend: [],
    };
  }

  const totalCapacity = assets.reduce((sum, asset) => sum + (asset.capacityMWh || 0), 0);
  const averageAvailability =
    assets.reduce((sum, asset) => sum + (asset.availability || 0), 0) / assets.length;
  const averageEfficiency =
    assets.reduce((sum, asset) => sum + (asset.roundTripEfficiency || 0), 0) / assets.length;

  const capacityByRegionMap = new Map();
  const statusBreakdownMap = new Map();
  const trendBuckets = new Map();

  assets.forEach((asset) => {
    capacityByRegionMap.set(
      asset.region,
      (capacityByRegionMap.get(asset.region) || 0) + (asset.capacityMWh || 0)
    );
    statusBreakdownMap.set(asset.status, (statusBreakdownMap.get(asset.status) || 0) + 1);

    (asset.metrics || []).forEach((metric) => {
      const ts = new Date(metric.timestamp).toISOString();
      if (!trendBuckets.has(ts)) {
        trendBuckets.set(ts, []);
      }
      trendBuckets.get(ts).push(metric.stateOfCharge || 0);
    });
  });

  const capacityByRegion = Array.from(capacityByRegionMap.entries()).map(([region, capacity]) => ({
    region,
    capacityMWh: capacity,
  }));

  const statusBreakdown = Array.from(statusBreakdownMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));

  const stateOfChargeTrend = Array.from(trendBuckets.entries())
    .map(([timestamp, values]) => ({
      timestamp,
      averageStateOfCharge:
        values.length > 0
          ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
          : 0,
    }))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return {
    totalAssets: assets.length,
    totalCapacityMWh: Number(totalCapacity.toFixed(2)),
    averageAvailability: Number((averageAvailability * 100).toFixed(2)),
    averageRoundTripEfficiency: Number((averageEfficiency * 100).toFixed(2)),
    capacityByRegion,
    statusBreakdown,
    stateOfChargeTrend,
  };
}

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/bess/assets', async (req, res) => {
    try {
      const assets = await BessAsset.find().sort({ assetId: 1 }).lean();
      res.json({ assets });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load BESS assets', details: error.message });
    }
  });

  app.get('/api/bess/dashboard', async (req, res) => {
    try {
      const assets = await BessAsset.find().sort({ assetId: 1 }).lean();
      const metrics = calculateDashboardMetrics(assets);
      res.json({ assets, metrics });
    } catch (error) {
      res.status(500).json({ error: 'Failed to build dashboard metrics', details: error.message });
    }
  });

  app.post('/api/bess/assets', async (req, res) => {
    try {
      const asset = await BessAsset.create(req.body);
      res.status(201).json(asset);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create asset', details: error.message });
    }
  });

  app.post('/api/bess/assets/:assetId/metrics', async (req, res) => {
    const { assetId } = req.params;
    const { timestamp, stateOfCharge, temperatureC } = req.body;

    if (!timestamp || typeof stateOfCharge !== 'number' || typeof temperatureC !== 'number') {
      return res.status(400).json({
        error: 'timestamp, stateOfCharge, and temperatureC are required numeric values',
      });
    }

    try {
      const nextMetric = {
        timestamp: new Date(timestamp),
        stateOfCharge,
        temperatureC,
      };

      const asset = await BessAsset.findOneAndUpdate(
        { assetId },
        {
          $push: { metrics: nextMetric },
          $set: { lastUpdated: nextMetric.timestamp },
        },
        { new: true }
      );

      if (!asset) {
        return res.status(404).json({ error: 'Asset ' + assetId + ' not found' });
      }

      res.json(asset);
    } catch (error) {
      res.status(400).json({ error: 'Failed to append metric', details: error.message });
    }
  });

  return app;
}

module.exports = { createApp, calculateDashboardMetrics };
