import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Settings.css';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ColorInput = ({ label, color, onChange }) => {
  // Convert rgba to hex
  const rgbaToHex = (rgba) => {
    // Parse rgba values
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return rgba; // Return as is if not rgba format
    
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    const a = match[4] ? parseFloat(match[4]) : 1;
    
    // Convert to hex
    const hex = '#' + 
      (r | 1 << 8).toString(16).slice(1) +
      (g | 1 << 8).toString(16).slice(1) +
      (b | 1 << 8).toString(16).slice(1);
    
    return hex;
  };

  // Convert hex to rgba
  const hexToRgba = (hex, alpha = 1) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Get current opacity from color string
  const getOpacity = (colorStr) => {
    const match = colorStr.match(/[\d.]+\)$/);
    return match ? parseFloat(match[0]) : 1;
  };

  const [hexValue, setHexValue] = useState(rgbaToHex(color));

  const handleHexChange = (e) => {
    const newHex = e.target.value;
    setHexValue(newHex);
    
    // Only update if it's a valid hex code
    if (/^#[0-9A-Fa-f]{6}$/.test(newHex)) {
      // If this is a background color (has opacity), preserve the opacity
      if (label.includes('Fill')) {
        const currentOpacity = getOpacity(color);
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
      const currentOpacity = getOpacity(color);
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

const Settings = ({ onClose, chartSettings, onChartSettingsChange, projectionSettings, onProjectionSettingsChange }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [editingGoal, setEditingGoal] = useState(null);
  const [tempGoal, setTempGoal] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('goals');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [localProjectionSettings, setLocalProjectionSettings] = useState(projectionSettings);
  const [localChartSettings, setLocalChartSettings] = useState(chartSettings);

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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const renderMonthlyGoals = () => (
    <div className="settings-section">
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

  const renderChartSettings = () => (
    <div className="settings-section">
      {Object.entries(localChartSettings).map(([series, settings]) => (
        <div key={series} className="style-section">
          <h4>{series}</h4>
          <div className="style-inputs">
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
            <ColorInput
              label="Border Color"
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
            <div className="border-width-group">
              <label>Border Width:</label>
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
      
      console.log('Starting sales analysis...');
      const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/sales/analyze`);
      console.log('Analysis response:', response.data);
      
      if (!response.data || !response.data.dailyDistribution) {
        throw new Error('Invalid response from server');
      }
      
      const { dailyDistribution } = response.data;
      
      // Update projection settings with the analyzed data
      const newSettings = {
        'Monday': Math.round(dailyDistribution.Monday * 100),
        'Tuesday': Math.round(dailyDistribution.Tuesday * 100),
        'Wednesday': Math.round(dailyDistribution.Wednesday * 100),
        'Thursday': Math.round(dailyDistribution.Thursday * 100),
        'Friday': Math.round(dailyDistribution.Friday * 100),
        'Saturday': Math.round(dailyDistribution.Saturday * 100),
        'Sunday': Math.round(dailyDistribution.Sunday * 100)
      };

      // Only update if the total is 100%
      const total = Object.values(newSettings).reduce((a, b) => a + b, 0);
      if (total === 100) {
        onProjectionSettingsChange(newSettings);
        console.log('Successfully updated projection settings:', newSettings);
      } else {
        console.error('Invalid total percentage:', total);
        setError(`Analysis resulted in invalid percentages (total: ${total}%). Please try again.`);
      }
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
    setLocalProjectionSettings(newSettings);
  };

  const handleChartSettingsChange = (newSettings) => {
    setLocalChartSettings(newSettings);
  };

  const handleClose = async () => {
    try {
      // Save projection settings if they've changed
      if (JSON.stringify(localProjectionSettings) !== JSON.stringify(projectionSettings)) {
        await onProjectionSettingsChange(localProjectionSettings);
      }

      // Save chart settings if they've changed
      if (JSON.stringify(localChartSettings) !== JSON.stringify(chartSettings)) {
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
        Set the percentage of monthly sales expected for each day of the week.
        These percentages will be used to project daily sales targets.
        Click "Analyze Past Sales" to automatically calculate optimal percentages based on historical data.
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

      <div className="total-percentage-section">
        <p className={`total-percentage ${
          Object.values(localProjectionSettings).reduce((a, b) => a + b, 0) === 100 ? 'valid' : 'invalid'
        }`}>
          Total: {Object.values(localProjectionSettings).reduce((a, b) => a + b, 0)}%
          {Object.values(localProjectionSettings).reduce((a, b) => a + b, 0) !== 100 && 
            <span className="error-message"> (Should equal 100%)</span>
          }
        </p>
      </div>
    </div>
  );

  return (
    <div className="settings-modal">
      <div className="settings-content">
        <h2>Settings</h2>
        
        <div className="settings-tabs">
          <button 
            className={`tab-button ${activeTab === 'goals' ? 'active' : ''}`}
            onClick={() => setActiveTab('goals')}
          >
            Monthly Goals
          </button>
          <button 
            className={`tab-button ${activeTab === 'chart' ? 'active' : ''}`}
            onClick={() => setActiveTab('chart')}
          >
            Chart Styling
          </button>
          <button 
            className={`tab-button ${activeTab === 'projection' ? 'active' : ''}`}
            onClick={() => setActiveTab('projection')}
          >
            Customize Projection
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'goals' && renderMonthlyGoals()}
          {activeTab === 'chart' && renderChartSettings()}
          {activeTab === 'projection' && renderProjectionSettings()}
        </div>

        <button className="close-button" onClick={handleClose}>
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default Settings; 