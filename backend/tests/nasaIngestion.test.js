const assert = require('node:assert/strict');
const path = require('node:path');
const { afterEach, test } = require('node:test');

const {
  fetchTelemetrySummary,
  ingestTelemetry,
  loadTelemetryFromFile,
} = require('../src/ingestion/nasaTelemetry');

const silentLogger = {
  debug() {},
};

class InMemoryBessModel {
  constructor() {
    this.docs = new Map();
  }

  reset() {
    this.docs.clear();
  }

  _cloneMetrics(metrics = []) {
    return metrics.map((metric) => ({
      timestamp: new Date(metric.timestamp),
      stateOfCharge: Number(metric.stateOfCharge),
      temperatureC: Number(metric.temperatureC),
    }));
  }

  _serialise(doc) {
    return {
      assetId: doc.assetId,
      site: doc.site,
      region: doc.region,
      capacityMWh: doc.capacityMWh,
      powerRatingMW: doc.powerRatingMW,
      roundTripEfficiency: doc.roundTripEfficiency,
      availability: doc.availability,
      status: doc.status,
      lastUpdated: doc.lastUpdated ? new Date(doc.lastUpdated) : undefined,
      metrics: this._cloneMetrics(doc.metrics),
    };
  }

  async findOne(filter) {
    const doc = this.docs.get(filter.assetId);
    if (!doc) return null;
    return this._createDoc(doc);
  }

  async create(payload) {
    const doc = this._serialise(payload);
    this.docs.set(doc.assetId, doc);
    return this._createDoc(doc);
  }

  async find(filter = {}) {
    let docs = Array.from(this.docs.values());
    if (filter.assetId) {
      if (filter.assetId.$in) {
        const ids = new Set(filter.assetId.$in);
        docs = docs.filter((doc) => ids.has(doc.assetId));
      } else {
        docs = docs.filter((doc) => doc.assetId === filter.assetId);
      }
    }
    return docs.map((doc) => this._serialise(doc));
  }

  async deleteMany() {
    this.reset();
  }

  _createDoc(source) {
    const model = this;
    const doc = this._serialise(source);
    return {
      ...doc,
      metrics: this._cloneMetrics(doc.metrics),
      async save() {
        this.lastUpdated = this.lastUpdated ? new Date(this.lastUpdated) : new Date();
        model.docs.set(this.assetId, model._serialise(this));
      },
    };
  }
}

const model = new InMemoryBessModel();

afterEach(async () => {
  await model.deleteMany();
});

const datasetPath = path.join(
  __dirname,
  '..',
  'data',
  'nasa-bess-telemetry-sample.json',
);

test('loadTelemetryFromFile normalises NASA telemetry dataset', async () => {
  const assets = await loadTelemetryFromFile(datasetPath);
  assert.equal(assets.length, 2);
  assert.equal(assets[0].assetId, 'nasa-bess-001');
  assert.equal(assets[0].metrics.length, 3);
  assert.ok(assets[0].metrics[0].timestamp instanceof Date);
});

test('ingestTelemetry inserts new NASA assets and metrics', async () => {
  const payload = await loadTelemetryFromFile(datasetPath);
  const result = await ingestTelemetry(payload, { model, logger: silentLogger });

  assert.deepEqual(result, {
    assetsProcessed: 2,
    newAssets: 2,
    metricsInserted: 6,
  });

  const stored = await model.findOne({ assetId: 'nasa-bess-002' });
  assert.ok(stored, 'Asset should be persisted');
  assert.equal(stored.metrics.length, 3);
});

test('ingestTelemetry appends only new telemetry samples based on timestamp', async () => {
  const payload = await loadTelemetryFromFile(datasetPath);
  await ingestTelemetry(payload, { model, logger: silentLogger });

  const incrementalPayload = [
    {
      ...payload[0],
      metrics: [
        payload[0].metrics[0],
        {
          timestamp: new Date('2024-01-08T03:00:00Z').toISOString(),
          stateOfCharge: 0.8,
          temperatureC: 22.9,
        },
      ],
    },
  ];

  const result = await ingestTelemetry(incrementalPayload, { model, logger: silentLogger });
  assert.deepEqual(result, {
    assetsProcessed: 1,
    newAssets: 0,
    metricsInserted: 1,
  });

  const stored = await model.findOne({ assetId: 'nasa-bess-001' });
  assert.equal(stored.metrics.length, 4);
});

test('fetchTelemetrySummary returns aggregated telemetry details', async () => {
  const payload = await loadTelemetryFromFile(datasetPath);
  await ingestTelemetry(payload, { model, logger: silentLogger });

  const [summary] = await fetchTelemetrySummary({ assetIds: ['nasa-bess-001'] }, { model });
  assert.ok(summary, 'Summary should be returned for nasa-bess-001');
  assert.equal(summary.assetId, 'nasa-bess-001');
  assert.equal(summary.metricsCount, 3);
  assert.equal(summary.site, 'NASA Glenn Research Center');
  assert.equal(summary.region, 'Ohio');
  assert.ok(summary.latestTimestamp instanceof Date);
  assert.ok(summary.averageStateOfCharge > 0.6 && summary.averageStateOfCharge < 0.8);
});

test('fetchTelemetrySummary returns empty array for unknown assetIds', async () => {
  const result = await fetchTelemetrySummary({ assetIds: ['non-existent-asset'] }, { model });
  assert.deepEqual(result, [], 'Should return empty array when no assetIds match');
});
