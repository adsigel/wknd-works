import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Settings.css';
import MonthlyGoals from './components/MonthlyGoals';
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
  chartSettings: initialChartSettings,
  onChartSettingsChange,
  projectionSettings: initialProjectionSettings,
  onProjectionSettingsChange
}) => {
  const [activeTab, setActiveTab] = useState('goals');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showProjections, setShowProjections] = useState(true);
  const [chartSettings, setChartSettings] = useState(initialChartSettings || {
    'Daily Sales': {
      backgroundColor: 'rgba(119, 187, 65, 0.6)',
      borderColor: 'rgba(44, 61, 47, 1)',
      borderWidth: 0
    },
    'Projected Sales': {
      backgroundColor: 'rgba(210, 129, 95, 0.2)',
      borderColor: 'rgba(148, 33, 146, 1)',
      borderWidth: 2
    },
    'Sales Goal': {
      backgroundColor: 'rgba(143, 171, 158, 0.2)',
      borderColor: 'rgba(0, 46, 122, 1)',
      borderWidth: 3
    }
  });
  const [projectionSettings, setProjectionSettings] = useState(initialProjectionSettings || {
    Monday: 5,
    Tuesday: 5,
    Wednesday: 9,
    Thursday: 11,
    Friday: 13,
    Saturday: 38,
    Sunday: 29
  });
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [projectionError, setProjectionError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const validateProjectionSettings = (settings) => {
    const total = Object.values(settings).reduce((sum, value) => sum + value, 0);
    if (total > 100) {
      setProjectionError('Daily distribution percentages must sum to 100% or less');
      return false;
    }
    setProjectionError('');
    return true;
  };

  const handleProjectionChange = (day, value) => {
    const newSettings = { ...projectionSettings, [day]: value };
    setProjectionSettings(newSettings);
    validateProjectionSettings(newSettings);
  };

  const handleMonthlyGoalsChange = (newGoals) => {
    setMonthlyGoals(newGoals);
  };

  const handleClose = async () => {
    if (!validateProjectionSettings(projectionSettings)) {
      return; // Don't close if validation fails
    }
    
    try {
      // Save settings
      await axios.post('/api/settings', {
        chartSettings,
        projectionSettings
      });

      // Save monthly goals
      const goalPromises = monthlyGoals.map(goal => 
        axios.post('/api/sales/goal', {
          month: goal.month,
          year: goal.year,
          goal: Number(goal.goal)
        })
      );
      await Promise.all(goalPromises);

      // Call the callbacks before closing
      if (onChartSettingsChange) {
        onChartSettingsChange(chartSettings);
      }
      if (onProjectionSettingsChange) {
        onProjectionSettingsChange(projectionSettings);
      }
      
      // Close the modal which will trigger a data refresh
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings');
    }
  };

  const handleChartSettingChange = (dataset, property, value) => {
    const newSettings = {
      ...chartSettings,
      [dataset]: {
        ...chartSettings[dataset],
        [property]: value
      }
    };
    setChartSettings(newSettings);
  };

  const renderMonthlyGoals = () => (
    <MonthlyGoals onGoalsChange={handleMonthlyGoalsChange} />
  );

  const renderChartSettings = () => (
    <div className="settings-section">
      <div className="chart-appearance-section">
        {Object.entries(chartSettings).map(([dataset, settings]) => (
          <div key={dataset} className="dataset-settings">
            <h3>{dataset}</h3>
            <div className="settings-grid">
              <div className="setting-row">
                <div className="setting-group">
                  <label>Color:</label>
                  <div className="color-inputs">
                    <input
                      type="color"
                      value={settings.backgroundColor}
                      onChange={(e) => handleChartSettingChange(dataset, 'backgroundColor', e.target.value)}
                    />
                    <input
                      type="text"
                      value={settings.backgroundColor}
                      onChange={(e) => handleChartSettingChange(dataset, 'backgroundColor', e.target.value)}
                    />
                  </div>
                </div>
                <div className="setting-group">
                  <label>Thickness:</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={settings.borderWidth}
                    onChange={(e) => handleChartSettingChange(dataset, 'borderWidth', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderProjectionSettings = () => (
    <div className="settings-section">
      <div className="projection-settings">
        <div className="projection-header">
          <h3>Daily Sales Distribution</h3>
          <button 
            className={`analyze-button ${isAnalyzing ? 'loading' : ''}`}
            onClick={async () => {
              setIsAnalyzing(true);
              try {
                const response = await axios.get('/api/sales/analyze');
                const { dailyDistribution } = response.data;
                // Convert distribution to our settings format
                const newProjectionSettings = {
                  Monday: Math.round(dailyDistribution.Monday * 100),
                  Tuesday: Math.round(dailyDistribution.Tuesday * 100),
                  Wednesday: Math.round(dailyDistribution.Wednesday * 100),
                  Thursday: Math.round(dailyDistribution.Thursday * 100),
                  Friday: Math.round(dailyDistribution.Friday * 100),
                  Saturday: Math.round(dailyDistribution.Saturday * 100),
                  Sunday: Math.round(dailyDistribution.Sunday * 100)
                };
                setProjectionSettings(newProjectionSettings);
                validateProjectionSettings(newProjectionSettings);
              } catch (error) {
                console.error('Error analyzing sales distribution:', error);
              } finally {
                setIsAnalyzing(false);
              }
            }}
            disabled={isAnalyzing}
            title="Get recommendations for daily sales distribution based on your past 90 days of sales"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Past Sales'}
          </button>
        </div>
        <p className="projection-description">
          Set the expected distribution of sales across the week. These percentages will be used to project daily sales from your monthly goals.
        </p>
        {projectionError && (
          <div className="error-message">
            {projectionError}
          </div>
        )}
        <div className="projection-settings-grid">
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
            <React.Fragment key={day}>
              <label htmlFor={`${day.toLowerCase()}-percentage`}>{day}:</label>
              <input
                id={`${day.toLowerCase()}-percentage`}
                type="number"
                min="0"
                max="100"
                value={projectionSettings[day]}
                onChange={(e) => handleProjectionChange(day, parseInt(e.target.value) || 0)}
              />
              <span>%</span>
            </React.Fragment>
          ))}
        </div>
      </div>
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
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="tab-content">
          {activeTab === 'goals' && renderMonthlyGoals()}
          {activeTab === 'chart' && renderChartSettings()}
          {activeTab === 'projection' && renderProjectionSettings()}
        </div>

        <div className="modal-footer">
          <button className="save-button" onClick={handleClose}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings; 