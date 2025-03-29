import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './InventorySettings.css';

const InventorySettings = ({ onSettingsChange, hideButtons = false, onClose = () => {} }) => {
  const [settings, setSettings] = useState({
    discountRanges: {
      range1: { days: 30, discount: 0.15 },
      range2: { days: 60, discount: 0.25 },
      range3: { days: 90, discount: 0.40 }
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/settings');
      if (response.data.inventorySettings) {
        setSettings(response.data.inventorySettings);
      }
    } catch (error) {
      console.error('Error fetching inventory settings:', error);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDaysChange = (range, value) => {
    const newSettings = {
      ...settings,
      discountRanges: {
        ...settings.discountRanges,
        [range]: {
          ...settings.discountRanges[range],
          days: parseInt(value) || 0
        }
      }
    };
    setSettings(newSettings);
  };

  const handleDiscountChange = (range, value) => {
    console.log(`Updating ${range} discount to:`, value);
    // Convert percentage to decimal (e.g., 80% -> 0.80)
    const decimalValue = parseFloat(value) / 100;
    
    const updatedSettings = {
      ...settings,
      discountRanges: {
        ...settings.discountRanges,
        [range]: {
          ...settings.discountRanges[range],
          discount: decimalValue
        }
      }
    };
    
    setSettings(updatedSettings);
    // Notify parent of settings change
    if (onSettingsChange) {
      onSettingsChange(updatedSettings);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Saving settings:', settings);
      await axios.post('/api/settings', {
        inventorySettings: settings
      });

      if (onSettingsChange) {
        onSettingsChange(settings);
      }

      setLoading(false);
      if (!hideButtons) {
        onClose();
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
      setLoading(false);
    }
  };

  const refreshInventorySummary = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First, get the latest settings
      const settingsResponse = await axios.get('/api/settings');
      if (settingsResponse.data.inventorySettings) {
        setSettings(settingsResponse.data.inventorySettings);
      }

      // Then get a fresh summary
      const response = await axios.get('/api/inventory/summary?forceRefresh=true');

      // Notify parent component that summary has been refreshed
      if (onSettingsChange) {
        await onSettingsChange(settings);
      }
    } catch (error) {
      console.error('Error refreshing inventory summary:', error);
      setError('Failed to refresh inventory summary');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="inventory-settings">
      <h3>Inventory Discount Settings</h3>
      <div className="settings-grid">
        {Object.entries(settings.discountRanges).map(([range, { days, discount }]) => (
          <div key={range} className="setting-row">
            <div className="setting-label">
              {`${days} days:`}
            </div>
            <div className="setting-input">
              <input
                type="number"
                min="0"
                max="100"
                value={Math.round(discount * 100)}
                onChange={(e) => handleDiscountChange(range, e.target.value)}
              />
              <span>%</span>
            </div>
          </div>
        ))}
      </div>
      {!hideButtons && (
        <div className="button-container">
          <button onClick={onClose}>Cancel</button>
          <button onClick={saveSettings} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default InventorySettings; 