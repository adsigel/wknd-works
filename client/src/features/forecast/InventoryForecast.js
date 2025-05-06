import React, { useState } from 'react';
import InventoryScenarios from './InventoryScenarios';
import './InventoryForecast.css';

export default function InventoryForecast() {
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);

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
          message: `Sync failed: ${data.error || 'Unknown error'}`
        });
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: `Sync failed: ${err.message}`
      });
    }
    setSyncing(false);
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
      <InventoryScenarios />
    </div>
  );
} 