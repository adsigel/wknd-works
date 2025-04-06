import React, { useState } from 'react';
import SalesChart from '../sales/SalesChart';
import InventoryForecast from './InventoryForecast';
import './ForecastDashboard.css';

const ForecastDashboard = () => {
  const [activeTab, setActiveTab] = useState('sales');
  const [monthlyGoalsUpdated, setMonthlyGoalsUpdated] = useState(false);

  const handleMonthlyGoalsUpdate = () => {
    // Trigger a refresh of the inventory forecast when monthly goals are updated
    setMonthlyGoalsUpdated(true);
  };

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
          onClick={() => {
            setActiveTab('inventory');
            // Reset the flag when switching to inventory tab
            setMonthlyGoalsUpdated(false);
          }}
        >
          Inventory Forecast
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'sales' && (
          <div className="sales-forecast">
            <SalesChart onMonthlyGoalsUpdate={handleMonthlyGoalsUpdate} />
          </div>
        )}
        {activeTab === 'inventory' && (
          <div className="inventory-forecast">
            <InventoryForecast shouldRefresh={monthlyGoalsUpdated} onRefreshComplete={() => setMonthlyGoalsUpdated(false)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ForecastDashboard; 