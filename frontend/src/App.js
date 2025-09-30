import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import './App.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';
const trimmedBaseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
const requestUrl = (trimmedBaseUrl ? trimmedBaseUrl : '') + '/api/bess/dashboard';

function formatNumber(value, fractionDigits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });
}

function App() {
  const [assets, setAssets] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function fetchDashboard() {
      try {
        const response = await axios.get(requestUrl);
        if (!isMounted) {
          return;
        }
        const payload = response.data || {};
        setAssets(payload.assets || []);
        setMetrics(payload.metrics || null);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        console.error('Failed to load dashboard', err);
        setError('Unable to load BESS analytics dashboard.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const capacityChartData = useMemo(() => {
    if (!assets.length) {
      return null;
    }
    return {
      labels: assets.map((asset) => asset.assetId),
      datasets: [
        {
          label: 'Storage Capacity (MWh)',
          data: assets.map((asset) => asset.capacityMWh || 0),
          backgroundColor: '#22c55e',
        },
      ],
    };
  }, [assets]);

  const stateOfChargeChartData = useMemo(() => {
    if (!metrics || !Array.isArray(metrics.stateOfChargeTrend) || metrics.stateOfChargeTrend.length === 0) {
      return null;
    }
    return {
      labels: metrics.stateOfChargeTrend.map((point) => new Date(point.timestamp).toLocaleDateString()),
      datasets: [
        {
          label: 'Average State of Charge (%)',
          data: metrics.stateOfChargeTrend.map((point) => point.averageStateOfCharge || 0),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.25)',
          tension: 0.35,
          pointRadius: 3,
        },
      ],
    };
  }, [metrics]);

  const statusBreakdown = useMemo(() => {
    if (!metrics || !Array.isArray(metrics.statusBreakdown)) {
      return [];
    }
    return metrics.statusBreakdown.slice().sort((a, b) => b.count - a.count);
  }, [metrics]);

  const summary = useMemo(() => {
    if (!metrics) {
      return [];
    }
    return [
      { label: 'Total Assets', value: formatNumber(metrics.totalAssets) },
      { label: 'Fleet Capacity (MWh)', value: formatNumber(metrics.totalCapacityMWh, 1) },
      { label: 'Avg Availability', value: formatNumber(metrics.averageAvailability, 1) + '%' },
      { label: 'Avg Round-Trip Efficiency', value: formatNumber(metrics.averageRoundTripEfficiency, 1) + '%' },
    ];
  }, [metrics]);

  if (loading) {
    return (
      <div className="App">
        <p className="status">Loading BESS analytics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App">
        <p className="status error">{error}</p>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App__header">
        <h1>Renewable Energy BESS Analytics</h1>
        <p>Track storage performance, capacity, and operational health across the fleet.</p>
      </header>

      <section className="metrics-grid">
        {summary.map((item) => (
          <div className="metric-card" key={item.label}>
            <span className="metric-label">{item.label}</span>
            <span className="metric-value">{item.value}</span>
          </div>
        ))}
      </section>

      <section className="charts-grid">
        <div className="chart-card">
          <div className="chart-card__header">
            <h2>Capacity by Asset</h2>
            <span className="chart-card__subtitle">Rated storage volume (MWh)</span>
          </div>
          {capacityChartData ? (
            <Bar
              data={capacityChartData}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  title: { display: false },
                },
                scales: {
                  x: { ticks: { maxRotation: 0 } },
                  y: { beginAtZero: true },
                },
              }}
            />
          ) : (
            <p className="chart-placeholder">No capacity data available.</p>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-card__header">
            <h2>Average State of Charge</h2>
            <span className="chart-card__subtitle">Daily fleet average (%)</span>
          </div>
          {stateOfChargeChartData ? (
            <Line
              data={stateOfChargeChartData}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                },
                scales: {
                  y: { beginAtZero: true, suggestedMax: 100 },
                },
              }}
            />
          ) : (
            <p className="chart-placeholder">No state-of-charge history captured yet.</p>
          )}
        </div>
      </section>

      <section className="status-section">
        <h2>Status Breakdown</h2>
        <ul className="status-list">
          {statusBreakdown.length === 0 && <li>No status telemetry available.</li>}
          {statusBreakdown.map((item) => (
            <li key={item.status}>
              <span className="status-label">{item.status}</span>
              <span className="status-count">{item.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="table-section">
        <h2>Asset Snapshot</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Asset ID</th>
                <th>Site</th>
                <th>Region</th>
                <th>Capacity (MWh)</th>
                <th>Power (MW)</th>
                <th>Availability</th>
                <th>Efficiency</th>
                <th>Status</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.assetId}>
                  <td>{asset.assetId}</td>
                  <td>{asset.site}</td>
                  <td>{asset.region}</td>
                  <td>{formatNumber(asset.capacityMWh, 1)}</td>
                  <td>{formatNumber(asset.powerRatingMW, 1)}</td>
                  <td>{formatNumber((asset.availability || 0) * 100, 1)}%</td>
                  <td>{formatNumber((asset.roundTripEfficiency || 0) * 100, 1)}%</td>
                  <td className={'status-pill status-pill--' + (asset.status || 'unknown')}>{asset.status}</td>
                  <td>{asset.lastUpdated ? new Date(asset.lastUpdated).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default App;
