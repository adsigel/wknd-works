import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from '../../components/Modal';
import './InventorySettings.css';

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

  const totalSalesDistribution = Object.values(salesDistribution).reduce((sum, value) => sum + value, 0);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get('/api/inventory-forecast');
        const forecast = response.data;
        if (forecast?.configuration) {
          setDiscountSettings(forecast.configuration.discountSettings);
          setSalesDistribution(forecast.configuration.salesDistribution);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        setError('Failed to load settings');
      }
    };

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

  const handleSave = async () => {
    if (totalSalesDistribution !== 100) {
      setError('Sales distribution must total 100%');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await axios.post('/api/inventory-forecast/discount-settings', {
        discountSettings,
        salesDistribution
      });
      setHasUnsavedChanges(false);
      onClose();
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
      <div className="restocking-tab">
        <h3>Restocking Settings</h3>
        <div className="restock-info">
          <div className="restock-row">
            <div className="restock-label">Minimum Buffer</div>
            <div className="restock-value">6 weeks</div>
          </div>
        </div>
      </div>
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
        </div>

        <div className="tab-content">
          {activeTab === 'discounting' && renderDiscountingTab()}
          {activeTab === 'restocking' && renderRestockingTab()}
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