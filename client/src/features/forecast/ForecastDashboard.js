import React, { useState } from 'react';
import SalesChart from '../sales/SalesChart';
import InventoryForecast from './InventoryForecast';
import './ForecastDashboard.css';

const ForecastDashboard = () => {
  const [activeTab, setActiveTab] = useState('sales');

  return (
    <div className="forecast-dashboard">
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          Sales Forecast
        </button>
        <button
          className={`tab ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Inventory Forecast
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'sales' && (
          <div className="sales-forecast">
            <SalesChart />
          </div>
        )}
        {activeTab === 'inventory' && (
          <div className="inventory-forecast">
            <InventoryForecast />
          </div>
        )}
      </div>
    </div>
  );
};

export default ForecastDashboard; 