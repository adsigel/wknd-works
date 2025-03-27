import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './InventorySettings.css';

const InventorySettings = () => {
  const [settings, setSettings] = useState({
    discountRanges: {
      range1: { days: 30, discount: 0.15 },
      range2: { days: 60, discount: 0.25 },
      range3: { days: 90, discount: 0.40 }
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/settings`);
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
    const newSettings = {
      ...settings,
      discountRanges: {
        ...settings.discountRanges,
        [range]: {
          ...settings.discountRanges[range],
          discount: parseFloat(value) / 100 // Convert percentage to decimal
        }
      }
    };
    setSettings(newSettings);
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/settings`, {
        inventorySettings: settings
      });
    } catch (error) {
      console.error('Error saving inventory settings:', error);
      setError('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const refreshInventorySummary = async () => {
    try {
      setRefreshing(true);
      const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/inventory/summary`);
      // The summary will be automatically updated in the UI through the parent component
    } catch (error) {
      console.error('Error refreshing inventory summary:', error);
      setError('Failed to refresh inventory summary');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="inventory-settings">
      <h3>Inventory Discount Configuration</h3>
      <div className="discount-ranges">
        {Object.entries(settings.discountRanges).map(([range, { days, discount }], index) => (
          <div key={range} className="discount-range">
            <h4>Range {index + 1}</h4>
            <div className="range-inputs">
              <div className="input-group">
                <label>Days in Inventory:</label>
                <input
                  type="number"
                  min="0"
                  value={days}
                  onChange={(e) => handleDaysChange(range, e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Discount Percentage:</label>
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
          </div>
        ))}
      </div>

      <div className="settings-actions">
        <button 
          className="save-button" 
          onClick={saveSettings}
          disabled={loading}
        >
          Save Changes
        </button>
        <button
          className="refresh-button"
          onClick={refreshInventorySummary}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh Summary'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default InventorySettings; 