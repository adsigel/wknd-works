import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Settings.css';
import InventorySummary from './components/InventorySummary';
import InventorySettings from './components/InventorySettings';
import MonthlyGoals from './components/MonthlyGoals';
import { formatCurrency } from '../../utils/formatters';
import { rgbaToHex, hexToRgba } from '../../utils/colors';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ColorInput = ({ label, color, onChange }) => {
  const [hexValue, setHexValue] = useState(rgbaToHex(color));

  const handleHexChange = (e) => {
    const newHex = e.target.value;
    setHexValue(newHex);
    
    // Only update if it's a valid hex code
    if (/^#[0-9A-Fa-f]{6}$/.test(newHex)) {
      // If this is a background color (has opacity), preserve the opacity
      if (label.includes('Fill')) {
        const currentOpacity = parseFloat(color.match(/[\d.]+\)$/)[0]);
        onChange(hexToRgba(newHex, currentOpacity));
      } else {
        onChange(hexToRgba(newHex, 1));
      }
    }
  };

  const handleColorPickerChange = (e) => {
    const newHex = e.target.value;
    setHexValue(newHex);
    
    // If this is a background color (has opacity), preserve the opacity
    if (label.includes('Fill')) {
      const currentOpacity = parseFloat(color.match(/[\d.]+\)$/)[0]);
      onChange(hexToRgba(newHex, currentOpacity));
    } else {
      onChange(hexToRgba(newHex, 1));
    }
  };

  return (
    <div className="color-input-group">
      <label>{label}:</label>
      <div className="color-inputs">
        <input
          type="color"
          value={hexValue}
          onChange={handleColorPickerChange}
        />
        <input
          type="text"
          value={hexValue}
          onChange={handleHexChange}
          placeholder="#000000"
          pattern="^#[0-9A-Fa-f]{6}$"
          title="Valid hex color code (e.g., #FF0000)"
        />
      </div>
    </div>
  );
};

const Settings = ({ 
  onClose, 
  chartSettings, 
  onChartSettingsChange, 
  projectionSettings, 
  onProjectionSettingsChange,
  selectedMonth = new Date().getMonth() + 1,
  selectedYear = new Date().getFullYear()
}) => {
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [editingGoal, setEditingGoal] = useState(null);
  const [tempGoal, setTempGoal] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('goals');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [localProjectionSettings, setLocalProjectionSettings] = useState(projectionSettings);
  const [localChartSettings, setLocalChartSettings] = useState(chartSettings);
  const inventorySummaryRef = React.useRef(null);
  const [inventorySettings, setInventorySettings] = useState(null);

  useEffect(() => {
    setLocalProjectionSettings(projectionSettings);
    setLocalChartSettings(chartSettings);
  }, [projectionSettings, chartSettings]);

  useEffect(() => {
    fetchMonthlyGoals();
  }, [selectedYear]);

  const fetchMonthlyGoals = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/sales/goals`, {
        params: { year: selectedYear }
      });
      setMonthlyGoals(response.data);
    } catch (error) {
      console.error('Error fetching monthly goals:', error);
      setError('Failed to fetch monthly goals');
      setMonthlyGoals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGoalUpdate = async (month) => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/sales/goal`, {
        month,
        year: selectedYear,
        goal: Number(tempGoal)
      });
      
      if (response.data.success) {
        setMonthlyGoals(prevGoals => 
          prevGoals.map(goal => 
            goal.month === month ? { ...goal, goal: Number(tempGoal) } : goal
          )
        );
        setEditingGoal(null);
        setTempGoal('');
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      setError('Failed to update goal');
    }
  };

  const renderMonthlyGoals = () => (
    <div className="settings-section">
      <div className="year-selector">
        <h3>Monthly Goals for {selectedYear}</h3>
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

  const renderChartSettings = () => (
    <div className="settings-section">
      {Object.entries(localChartSettings).map(([series, settings]) => (
        <div key={series} className="style-section">
          <h4>{series}</h4>
          <div className="style-inputs">
            {series === 'Daily Sales' && (
              <ColorInput
                label="Fill Color"
                color={settings.backgroundColor}
                onChange={(newColor) => {
                  handleChartSettingsChange({
                    ...localChartSettings,
                    [series]: {
                      ...settings,
                      backgroundColor: newColor
                    }
                  });
                }}
              />
            )}
            {series !== 'Daily Sales' && (
              <ColorInput
                label="Color"
                color={settings.borderColor}
                onChange={(newColor) => {
                  handleChartSettingsChange({
                    ...localChartSettings,
                    [series]: {
                      ...settings,
                      borderColor: newColor
                    }
                  });
                }}
              />
            )}
            <div className="border-width-group">
              <label>Thickness:</label>
              <input
                type="number"
                min="0"
                max="10"
                value={settings.borderWidth}
                onChange={(e) => {
                  handleChartSettingsChange({
                    ...localChartSettings,
                    [series]: {
                      ...settings,
                      borderWidth: Number(e.target.value)
                    }
                  });
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const analyzePastSales = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);
      
      console.log('Starting sales analysis with:', {
        month: selectedMonth,
        year: selectedYear,
        typeMonth: typeof selectedMonth,
        typeYear: typeof selectedYear
      });

      const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/sales/analyze`, {
        params: {
          month: selectedMonth,
          year: selectedYear
        }
      });
      console.log('Analysis response:', response.data);
      
      if (!response.data || !response.data.dailyDistribution) {
        throw new Error('Invalid response from server');
      }
      
      const { dailyDistribution } = response.data;
      
      // Update projection settings with the analyzed data
      let newSettings = {
        'Monday': Math.round(dailyDistribution.Monday * 100),
        'Tuesday': Math.round(dailyDistribution.Tuesday * 100),
        'Wednesday': Math.round(dailyDistribution.Wednesday * 100),
        'Thursday': Math.round(dailyDistribution.Thursday * 100),
        'Friday': Math.round(dailyDistribution.Friday * 100),
        'Saturday': Math.round(dailyDistribution.Saturday * 100),
        'Sunday': Math.round(dailyDistribution.Sunday * 100)
      };

      // Calculate total after initial rounding
      let total = Object.values(newSettings).reduce((a, b) => a + b, 0);
      
      // If total is not 100, adjust the largest value to make it 100
      if (total !== 100) {
        console.log('Adjusting rounded values to total 100%. Initial total:', total);
        
        // Find the day with the largest value
        const entries = Object.entries(newSettings);
        const largestDay = entries.reduce((max, curr) => 
          curr[1] > max[1] ? curr : max
        );
        
        // Adjust the largest value to make total exactly 100
        newSettings[largestDay[0]] += (100 - total);
        
        console.log('Adjusted settings:', newSettings);
        total = Object.values(newSettings).reduce((a, b) => a + b, 0);
        console.log('New total:', total);
      }

      // Only update local state, don't save to server yet
      setLocalProjectionSettings(newSettings);
      console.log('Updated local projection settings:', newSettings);

    } catch (error) {
      console.error('Error analyzing past sales:', error);
      setError(error.response?.data?.error || error.message || 'Failed to analyze past sales data');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleProjectionChange = (day, value) => {
    const newValue = value === '' ? 0 : Number(value);
    const newSettings = {
      ...localProjectionSettings,
      [day]: newValue
    };
    console.log('Updating local projection settings:', newSettings);
    setLocalProjectionSettings(newSettings);
  };

  const handleChartSettingsChange = (newSettings) => {
    setLocalChartSettings(newSettings);
  };

  const handleClose = async () => {
    try {
      // Save projection settings if they've changed and total is 100%
      if (JSON.stringify(localProjectionSettings) !== JSON.stringify(projectionSettings)) {
        const total = Object.values(localProjectionSettings).reduce((sum, val) => sum + val, 0);
        if (total === 100) {
          console.log('Saving changed projection settings:', localProjectionSettings);
          await onProjectionSettingsChange(localProjectionSettings);
        } else {
          console.error('Cannot save projection settings - total must be 100%');
          setError('Total percentage must equal 100% before saving');
          return;
        }
      }

      // Save chart settings if they've changed
      if (JSON.stringify(localChartSettings) !== JSON.stringify(chartSettings)) {
        console.log('Saving changed chart settings:', localChartSettings);
        await onChartSettingsChange(localChartSettings);
      }

      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings. Please try again.');
    }
  };

  const renderProjectionSettings = () => (
    <div className="settings-section">
      <div className="projection-header">
        <h3>Daily Sales Distribution</h3>
        <button 
          className={`analyze-button ${isAnalyzing ? 'analyzing' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            analyzePastSales();
          }}
          disabled={isAnalyzing}
          type="button"
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Past Sales'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <p className="projection-description">
        Set the percentage of monthly sales expected for each day of the week. These percentages will be used to project daily sales targets. Click "Analyze Past Sales" to automatically calculate optimal percentages based on historical data.
      </p>

      <div className="projection-settings-container">
        {Object.entries(localProjectionSettings).map(([day, percentage]) => (
          <div key={day} className="projection-setting">
            <label>{day}:</label>
            <input
              type="number"
              value={percentage}
              onChange={(e) => handleProjectionChange(day, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            />
            <span>%</span>
          </div>
        ))}
      </div>

      <div className={`total-percentage ${Object.values(localProjectionSettings).reduce((a, b) => a + b, 0) === 100 ? 'valid' : 'invalid'}`}>
        Total: {Object.values(localProjectionSettings).reduce((a, b) => a + b, 0)}%
        {Object.values(localProjectionSettings).reduce((a, b) => a + b, 0) !== 100 && ' (Must equal 100%)'}
      </div>
    </div>
  );

  const handleInventorySettingsChange = (newSettings) => {
    console.log('Inventory settings changed:', newSettings);
    setInventorySettings(newSettings);
  };

  const handleInventorySettingChange = (range, value) => {
    const newValue = value === '' ? 0 : Number(value) / 100; // Convert percentage to decimal
    const newSettings = {
      ...inventorySettings || {
        discountRanges: {
          range1: { days: 30, discount: 0.15 },
          range2: { days: 60, discount: 0.25 },
          range3: { days: 90, discount: 0.40 }
        }
      },
      discountRanges: {
        ...inventorySettings?.discountRanges || {},
        [range]: {
          days: range === 'range1' ? 30 : range === 'range2' ? 60 : 90,
          discount: newValue
        }
      }
    };
    handleInventorySettingsChange(newSettings);
  };

  const handleSettingsChange = async () => {
    console.log('Settings changed, refreshing summary');
    try {
      // First, save the current settings
      if (inventorySettings) {
        console.log('Saving inventory settings:', inventorySettings);
        await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/settings`, {
          inventorySettings
        });
      }

      // Then refresh the summary
      if (inventorySummaryRef.current) {
        await inventorySummaryRef.current.refreshSummary();
      }
    } catch (error) {
      console.error('Error refreshing summary:', error);
      setError('Failed to refresh summary');
    }
  };

  const handleInventorySave = async () => {
    console.log('Saving inventory settings and refreshing summary');
    try {
      await handleSettingsChange();
      handleClose();
    } catch (error) {
      console.error('Error saving and refreshing:', error);
      setError('Failed to save settings and refresh summary');
    }
  };

  const renderInventorySettings = () => (
    <div className="settings-section">
      <div className="inventory-discount-section">
        <h3>Inventory Discount Settings</h3>
        <p className="inventory-discount-description">
          Set different discount levels for different inventory ages to get a more realistic sense of your inventory value. Use this with your monthly sales goals to plan your inventory buys.
        </p>
        <div className="discount-settings-container">
          <div className="discount-setting">
            <label>30 days:</label>
            <input
              type="number"
              min="0"
              max="100"
              value={inventorySettings?.discountRanges?.range1?.discount * 100 || 15}
              onChange={(e) => handleInventorySettingChange('range1', e.target.value)}
            />
            <span>%</span>
          </div>
          <div className="discount-setting">
            <label>60 days:</label>
            <input
              type="number"
              min="0"
              max="100"
              value={inventorySettings?.discountRanges?.range2?.discount * 100 || 25}
              onChange={(e) => handleInventorySettingChange('range2', e.target.value)}
            />
            <span>%</span>
          </div>
          <div className="discount-setting">
            <label>90 days:</label>
            <input
              type="number"
              min="0"
              max="100"
              value={inventorySettings?.discountRanges?.range3?.discount * 100 || 40}
              onChange={(e) => handleInventorySettingChange('range3', e.target.value)}
            />
            <span>%</span>
          </div>
        </div>
      </div>
      <InventorySummary ref={inventorySummaryRef} />
    </div>
  );

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-header-content">
            <h2>Settings</h2>
            <div className="tabs">
              <button
                className={`tab ${activeTab === 'goals' ? 'active' : ''}`}
                onClick={() => setActiveTab('goals')}
              >
                Monthly Goals
              </button>
              <button
                className={`tab ${activeTab === 'chart' ? 'active' : ''}`}
                onClick={() => setActiveTab('chart')}
              >
                Chart Styling
              </button>
              <button
                className={`tab ${activeTab === 'projection' ? 'active' : ''}`}
                onClick={() => setActiveTab('projection')}
              >
                Customize Projection
              </button>
              <button
                className={`tab ${activeTab === 'inventory' ? 'active' : ''}`}
                onClick={() => setActiveTab('inventory')}
              >
                Inventory
              </button>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="tab-content">
          {activeTab === 'goals' && renderMonthlyGoals()}
          {activeTab === 'chart' && renderChartSettings()}
          {activeTab === 'projection' && renderProjectionSettings()}
          {activeTab === 'inventory' && renderInventorySettings()}
        </div>

        <div className="modal-footer">
          {activeTab === 'inventory' ? (
            <>
              <button 
                className="refresh-button" 
                onClick={handleSettingsChange}
                disabled={loading}
              >
                Refresh Summary
              </button>
              <button 
                className="save-button" 
                onClick={handleInventorySave}
                disabled={loading}
              >
                Save Changes
              </button>
            </>
          ) : (
            <button className="save-button" onClick={handleClose}>
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings; 