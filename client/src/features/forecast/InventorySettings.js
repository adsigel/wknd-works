import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from '../../components/Modal';
import './InventorySettings.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

const DiscountingTab = ({ 
  discountSettings, 
  onDiscountChange,
  salesDistribution,
  onSalesDistributionChange,
  totalSalesDistribution
}) => {
  const ageBuckets = ['0-30', '31-60', '61-90', '90+'];

  return (
    <div className="discounting-tab">
      <div className="settings-section">
        <h3>Discount Percentages</h3>
        <p className="section-description">Set discount percentages for each age range of inventory.</p>
        {ageBuckets.map(bucket => (
          <div key={bucket} className="discount-row">
            <label>{bucket} days:</label>
            <div className="input-group">
              <input
                type="number"
                min="0"
                max="100"
                value={discountSettings[bucket] || 0}
                onChange={(e) => onDiscountChange(bucket, Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
              />
              <span className="input-suffix">%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="settings-section">
        <h3>Sales Distribution</h3>
        <p className="section-description">Set the percentage of sales that come from each age range. Total must equal 100%.</p>
        {ageBuckets.map(bucket => (
          <div key={bucket} className="discount-row">
            <label>{bucket} days:</label>
            <div className="input-group">
              <input
                type="number"
                min="0"
                max="100"
                value={salesDistribution[bucket] || 0}
                onChange={(e) => onSalesDistributionChange(bucket, Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
              />
              <span className="input-suffix">%</span>
            </div>
          </div>
        ))}
        <div className="total-row">
          <label>Total:</label>
          <span className={totalSalesDistribution === 100 ? 'valid' : 'invalid'}>
            {totalSalesDistribution}%
          </span>
        </div>
      </div>
    </div>
  );
};

const RestockingTab = ({ minimumWeeksBuffer, onMinimumWeeksBufferChange }) => {
  return (
    <div className="restocking-tab">
      <h3>Restocking Settings</h3>
      <p className="section-description">Configure when to trigger restock warnings based on projected inventory levels.</p>
      <div className="restock-info">
        <div className="restock-row">
          <label>Minimum Buffer:</label>
          <div className="input-group">
            <input
              type="number"
              min="1"
              max="52"
              value={minimumWeeksBuffer}
              onChange={(e) => onMinimumWeeksBufferChange(Math.min(52, Math.max(1, parseInt(e.target.value) || 1)))}
            />
            <span className="input-suffix">weeks</span>
          </div>
          <p className="setting-help">
            Trigger restock warnings when projected inventory falls below this many weeks of expected sales.
          </p>
        </div>
      </div>
    </div>
  );
};

const IgnoredInventoryTab = ({ ignoreInventoryOlderThanDays, onIgnoreInventoryChange }) => {
  return (
    <div className="ignored-inventory-tab">
      <h3>Ignored Inventory</h3>
      <p className="section-description">
        Set a threshold (in days) to value all inventory older than this at $0 in discounted value calculations. Default is 180 days. Minimum is 91 days.
      </p>
      <div className="ignored-row">
        <label>Ignore inventory older than:</label>
        <div className="input-group">
          <input
            type="number"
            min="91"
            value={ignoreInventoryOlderThanDays}
            onChange={e => onIgnoreInventoryChange(Math.max(91, parseInt(e.target.value) || 180))}
          />
          <span className="input-suffix">days</span>
        </div>
      </div>
    </div>
  );
};

const InventorySettings = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('discounting');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState(null);
  const [discountSettings, setDiscountSettings] = useState({
    '0-30': 0,
    '31-60': 5,
    '61-90': 10,
    '90+': 15
  });
  const [salesDistribution, setSalesDistribution] = useState({
    '0-30': 25,
    '31-60': 25,
    '61-90': 25,
    '90+': 25
  });
  const [minimumWeeksBuffer, setMinimumWeeksBuffer] = useState(6);
  const [ignoreInventoryOlderThanDays, setIgnoreInventoryOlderThanDays] = useState(180);

  const totalSalesDistribution = Object.values(salesDistribution).reduce((sum, value) => sum + value, 0);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/inventory-forecast`);
      const forecast = response.data;
      if (forecast?.configuration) {
        setDiscountSettings(forecast.configuration.discountSettings);
        setSalesDistribution(forecast.configuration.salesDistribution);
        setMinimumWeeksBuffer(forecast.configuration.minimumWeeksBuffer || 6);
        setIgnoreInventoryOlderThanDays(forecast.configuration.ignoreInventoryOlderThanDays || 180);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setError('Failed to load settings');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const handleDiscountChange = (bucket, value) => {
    setDiscountSettings(prev => ({
      ...prev,
      [bucket]: value
    }));
    setHasUnsavedChanges(true);
  };

  const handleSalesDistributionChange = (bucket, value) => {
    setSalesDistribution(prev => ({
      ...prev,
      [bucket]: value
    }));
    setHasUnsavedChanges(true);
  };

  const handleMinimumWeeksBufferChange = (value) => {
    setMinimumWeeksBuffer(value);
    setHasUnsavedChanges(true);
  };

  const handleIgnoreInventoryChange = (value) => {
    setIgnoreInventoryOlderThanDays(value);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (activeTab === 'discounting' && totalSalesDistribution !== 100) {
      setError('Sales distribution must total 100%');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      // Always send all config fields
      const configPayload = {
        discountSettings,
        salesDistribution,
        minimumWeeksBuffer,
        ignoreInventoryOlderThanDays
      };
      if (activeTab === 'discounting') {
        await axios.post(`${API_BASE_URL}/api/inventory-forecast/discount-settings`, configPayload);
      } else if (activeTab === 'restocking') {
        await axios.post(`${API_BASE_URL}/api/inventory-forecast/restock-settings`, configPayload);
      } else if (activeTab === 'ignored') {
        await axios.patch(`${API_BASE_URL}/api/inventory-forecast/config`, configPayload);
      }
      setHasUnsavedChanges(false);
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const renderDiscountingTab = () => {
    return (
      <DiscountingTab
        discountSettings={discountSettings}
        onDiscountChange={handleDiscountChange}
        salesDistribution={salesDistribution}
        onSalesDistributionChange={handleSalesDistributionChange}
        totalSalesDistribution={totalSalesDistribution}
      />
    );
  };

  const renderRestockingTab = () => {
    return (
      <RestockingTab
        minimumWeeksBuffer={minimumWeeksBuffer}
        onMinimumWeeksBufferChange={handleMinimumWeeksBufferChange}
      />
    );
  };

  const renderIgnoredInventoryTab = () => {
    return (
      <IgnoredInventoryTab
        ignoreInventoryOlderThanDays={ignoreInventoryOlderThanDays}
        onIgnoreInventoryChange={handleIgnoreInventoryChange}
      />
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Inventory Settings"
    >
      <div className="inventory-settings">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'discounting' ? 'active' : ''}`}
            onClick={() => setActiveTab('discounting')}
          >
            Discounting
          </button>
          <button
            className={`tab ${activeTab === 'restocking' ? 'active' : ''}`}
            onClick={() => setActiveTab('restocking')}
          >
            Restocking
          </button>
          <button
            className={`tab ${activeTab === 'ignored' ? 'active' : ''}`}
            onClick={() => setActiveTab('ignored')}
          >
            Ignored Inventory
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'discounting' && renderDiscountingTab()}
          {activeTab === 'restocking' && renderRestockingTab()}
          {activeTab === 'ignored' && renderIgnoredInventoryTab()}
        </div>

        <div className="modal-footer">
          <button 
            className="save-button" 
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default InventorySettings; 