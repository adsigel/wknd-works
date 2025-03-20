import React, { useState, useEffect } from 'react';
import axios from 'axios';

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

const Settings = ({ onClose, chartSettings, onChartSettingsChange, projectionSettings, onProjectionSettingsChange }) => {
  // Local state for form values
  const [chartStyles, setChartStyles] = useState(chartSettings);
  const [projectionDistribution, setProjectionDistribution] = useState(projectionSettings);
  const [totalPercentage, setTotalPercentage] = useState(100);
  const [isValid, setIsValid] = useState(true);
  const [historicalData, setHistoricalData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Calculate total percentage whenever distribution changes
  useEffect(() => {
    const total = Object.values(projectionDistribution).reduce((sum, val) => sum + val, 0);
    setTotalPercentage(total);
    setIsValid(Math.abs(total - 100) < 0.01);
  }, [projectionDistribution]);

  const handleChartStyleChange = (series, property, value) => {
    const newStyles = {
      ...chartStyles,
      [series]: {
        ...chartStyles[series],
        [property]: value
      }
    };
    setChartStyles(newStyles);
  };

  const handleProjectionChange = (day, value) => {
    const numValue = parseFloat(value) || 0;
    const newDistribution = {
      ...projectionDistribution,
      [day]: numValue
    };
    setProjectionDistribution(newDistribution);
  };

  const analyzePastSales = async () => {
    setIsAnalyzing(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/analyze-sales`);
      setHistoricalData(response.data);
    } catch (error) {
      console.error('Error analyzing sales:', error);
      alert('Failed to analyze sales data. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isValid) {
      alert('Projection percentages must sum to 100%');
      return;
    }

    // Save both chart settings and projection settings
    onChartSettingsChange(chartStyles);
    onProjectionSettingsChange(projectionDistribution);
    onClose();
  };

  return (
    <div className="settings-modal">
      <div className="settings-content">
        <h2>Dashboard Settings</h2>
        
        <form onSubmit={handleSubmit}>
          <section>
            <h3>Chart Styling</h3>
            {Object.entries(chartStyles).map(([series, styles]) => (
              <div key={series} className="style-section">
                <h4>{series}</h4>
                <div className="style-inputs">
                  <ColorInput
                    label="Fill Color"
                    color={styles.backgroundColor}
                    onChange={(value) => handleChartStyleChange(series, 'backgroundColor', value)}
                  />
                  <ColorInput
                    label="Border Color"
                    color={styles.borderColor}
                    onChange={(value) => handleChartStyleChange(series, 'borderColor', value)}
                  />
                  <div className="border-width-group">
                    <label>Border Width:</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={styles.borderWidth}
                      onChange={(e) => handleChartStyleChange(series, 'borderWidth', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section>
            <h3>Customize Projection</h3>
            <div className="projection-header">
              <div>
                <p>Set the percentage of monthly sales goal for each day</p>
                <button 
                  type="button" 
                  onClick={analyzePastSales}
                  disabled={isAnalyzing}
                  style={{
                    marginTop: '10px',
                    padding: '8px 16px',
                    backgroundColor: '#8fab9e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Past Sales'}
                </button>
                {historicalData && (
                  <p style={{ marginTop: '10px', color: '#666', fontSize: '0.9em' }}>
                    Analyzed {historicalData.totalOrders} orders totaling {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(historicalData.totalSales)} over the past {historicalData.daysAnalyzed} days. You can use this to update your daily sales projections.
                  </p>
                )}
              </div>
              <div className={`total-percentage ${isValid ? 'valid' : 'invalid'}`}>
                Total: {totalPercentage.toFixed(1)}%
                {!isValid && <span className="error-message"> (Must equal 100%)</span>}
              </div>
            </div>
            <div className="projection-inputs">
              {Object.entries(projectionDistribution).map(([day, percentage]) => (
                <div key={day} className="projection-row">
                  <label className={!isValid ? 'invalid' : ''}>
                    {day}:
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={percentage}
                      onChange={(e) => handleProjectionChange(day, e.target.value)}
                      className={!isValid ? 'invalid' : ''}
                    />
                    %
                  </label>
                  {historicalData && (
                    <span className="historical-data">
                      Historical: {historicalData.percentages[day]}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="button-group">
            <button type="submit" disabled={!isValid}>Save Changes</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings; 