import React, { useState, useEffect } from 'react';
import InventoryScenarios from './InventoryScenarios';
import './InventoryForecast.css';

const NO_COST_OPTIONS = [
  { value: 'exclude', label: 'Exclude From Inventory' },
  { value: 'assumeMargin', label: 'Assume 50% Margin' },
];

export default function InventoryForecast() {
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const [noCostInventoryHandling, setNoCostInventoryHandling] = useState('exclude');
  const [loading, setLoading] = useState(false);

  const handleSyncInventory = async () => {
    setSyncing(true);
    setToast(null);
    try {
      const res = await fetch('/api/inventory/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setToast({
          type: 'success',
          message: `Inventory sync complete! Created: ${data.summary?.created ?? 0}, Updated: ${data.summary?.updated ?? 0}, Skipped: ${data.summary?.skipped ?? 0}, Total: ${data.summary?.total ?? 0}`
        });
      } else {
        setToast({
          type: 'error',
          message: `Sync failed: ${data.error || data.details || 'Unknown error'}`
        });
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: `Sync failed: ${err.message}`
      });
    } finally {
      setSyncing(false);
    }
  };

  // Fetch current setting on mount
  useEffect(() => {
    async function fetchSetting() {
      setLoading(true);
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        setNoCostInventoryHandling(data.noCostInventoryHandling || 'exclude');
      } catch (e) {
        // handle error
      }
      setLoading(false);
    }
    fetchSetting();
  }, []);

  // Handler for changing the picklist
  const handleNoCostChange = async (e) => {
    const value = e.target.value;
    setNoCostInventoryHandling(value);
    
    // Save the setting in the background
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noCostInventoryHandling: value }),
    }).catch(e => {
      setToast({
        type: 'error',
        message: `Failed to save setting: ${e.message}`
      });
    });
  };

  return (
    <div className="inventory-forecast">
      <h2>Inventory Forecast</h2>
      <button
        onClick={handleSyncInventory}
        disabled={syncing}
        style={{
          marginBottom: 24,
          padding: '8px 20px',
          fontSize: 16,
          borderRadius: 6,
          background: '#1976d2',
          color: '#fff',
          border: 'none',
          cursor: syncing ? 'not-allowed' : 'pointer',
          opacity: syncing ? 0.7 : 1
        }}
      >
        {syncing ? 'Refreshing...' : 'Refresh Inventory from Shopify'}
      </button>
      {toast && (
        <div
          style={{
            margin: '12px 0',
            padding: '10px 18px',
            borderRadius: 6,
            background: toast.type === 'success' ? '#e8f5e9' : '#ffebee',
            color: toast.type === 'success' ? '#388e3c' : '#d32f2f',
            fontWeight: 500,
            boxShadow: '0 2px 8px rgba(0,0,0,0.07)'
          }}
        >
          {toast.message}
        </div>
      )}
      <InventoryScenarios noCostInventoryHandling={noCostInventoryHandling} />
      
      <div style={{ marginTop: 32, padding: 16, borderTop: '1px solid #eee' }}>
        <label htmlFor="no-cost-inventory" style={{ fontWeight: 600, marginRight: 12 }}>
          No Cost Inventory:
        </label>
        <select
          id="no-cost-inventory"
          value={noCostInventoryHandling}
          onChange={handleNoCostChange}
          disabled={syncing}
          style={{ padding: 8, minWidth: 200 }}
        >
          {NO_COST_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
} 