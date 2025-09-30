const mongoose = require('mongoose');

const metricSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true },
    stateOfCharge: { type: Number, required: true },
    temperatureC: { type: Number, required: true },
  },
  { _id: false }
);

const bessSchema = new mongoose.Schema(
  {
    assetId: { type: String, required: true, unique: true },
    site: { type: String, required: true },
    region: { type: String, required: true },
    capacityMWh: { type: Number, required: true },
    powerRatingMW: { type: Number, required: true },
    roundTripEfficiency: { type: Number, required: true },
    availability: { type: Number, required: true },
    status: {
      type: String,
      enum: ['online', 'maintenance', 'fault', 'commissioning'],
      default: 'online',
    },
    lastUpdated: { type: Date, default: Date.now },
    metrics: { type: [metricSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('BessAsset', bessSchema);
