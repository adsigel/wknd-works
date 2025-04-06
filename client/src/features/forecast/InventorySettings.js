import React, { useState } from 'react';
import Modal from '../../components/Modal';
import './InventorySettings.css';

const InventorySettings = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('discounting');

  const renderDiscountingTab = () => {
    return (
      <div className="discounting-tab">
        <h3>Age-Based Discounting</h3>
        <div className="discount-grid">
          <div className="discount-row">
            <div className="age-range">0-30 days</div>
            <div className="discount-value">0% discount</div>
          </div>
          <div className="discount-row">
            <div className="age-range">31-60 days</div>
            <div className="discount-value">5% discount</div>
          </div>
          <div className="discount-row">
            <div className="age-range">61-90 days</div>
            <div className="discount-value">10% discount</div>
          </div>
          <div className="discount-row">
            <div className="age-range">90+ days</div>
            <div className="discount-value">15% discount</div>
          </div>
        </div>
      </div>
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
      onClose={onClose}
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
      </div>
    </Modal>
  );
};

export default InventorySettings; 