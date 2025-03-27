import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Settings.css';
import InventorySummary from './components/InventorySummary';
import InventorySettings from './components/InventorySettings';

// ... existing imports and code ...

const renderMonthlyGoals = () => (
  <div className="settings-section">
    <div className="inventory-section">
      <InventorySummary />
      <InventorySettings />
    </div>
    <div className="year-selector">
      <label>Year:</label>
      <select 
        value={selectedYear} 
        onChange={(e) => setSelectedYear(Number(e.target.value))}
      >
        {[2024, 2025].map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
    </div>

    {loading ? (
      <div>Loading monthly goals...</div>
    ) : error ? (
      <div className="error">{error}</div>
    ) : (
      <div className="monthly-goals-grid">
        {monthlyGoals.map(({ month, goal }) => (
          <div key={month} className="goal-item">
            <div className="goal-month">{months[month - 1]}</div>
            {editingGoal === month ? (
              <form 
                className="goal-edit-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleGoalUpdate(month);
                }}
              >
                <input
                  type="number"
                  value={tempGoal}
                  onChange={(e) => setTempGoal(e.target.value)}
                  placeholder="Enter goal"
                  autoFocus
                />
                <button type="submit">Save</button>
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingGoal(null);
                    setTempGoal('');
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="goal-value">
                <span>{formatCurrency(goal)}</span>
                <button 
                  className="edit-button"
                  onClick={() => {
                    setEditingGoal(month);
                    setTempGoal(goal.toString());
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

// ... rest of the component code ... 