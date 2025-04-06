import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/formatters';
import InventoryAgeBreakdown from './InventoryAgeBreakdown';
import InventorySettings from './InventorySettings';
import './InventoryForecast.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const InventoryForecast = () => {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingStep, setLoadingStep] = useState('initializing');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    console.log('Component mounted, API URL:', API_BASE_URL);
    fetchForecast();
  }, []);

  const fetchForecast = async () => {
    try {
      setLoading(true);
      setError(null);
      setLoadingStep('connecting');
      console.log('Starting forecast fetch...');
      
      const response = await axios.get(`${API_BASE_URL}/api/inventory-forecast`, {
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response received:', response.status);
      console.log('Minimum weeks buffer from server:', response.data.configuration.minimumWeeksBuffer);
      
      // Transform the data to match the expected structure
      const transformedData = {
        ...response.data,
        currentInventoryValue: response.data.currentState.totalRetailValue,
        currentDiscountedValue: response.data.currentState.totalDiscountedValue,
        minimumBuffer: response.data.configuration.minimumWeeksBuffer * response.data.weeklyProjections[0].projectedSales,
        weeklySalesAmount: response.data.weeklyProjections[0].projectedSales,
        inventoryData: response.data.inventoryData || []
      };
      
      console.log('Transformed data minimum buffer:', transformedData.minimumBuffer);
      console.log('Weekly sales amount:', transformedData.weeklySalesAmount);
      
      setLoadingStep('processing');
      setForecast(transformedData);
      setLoadingStep('complete');
    } catch (error) {
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMessage = 'Failed to load inventory forecast';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. The server is taking too long to respond.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Forecast endpoint not found. Please check if the server is running.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error occurred. Please try again later.';
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Unable to connect to the server. Please check if the server is running.';
      }
      
      setError(errorMessage);
      setLoadingStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
    // Only fetch fresh data if we're not already loading
    if (!loading) {
      fetchForecast();
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">
          {loadingStep === 'initializing' && 'Initializing...'}
          {loadingStep === 'connecting' && 'Connecting to server...'}
          {loadingStep === 'processing' && 'Processing forecast data...'}
          {loadingStep === 'error' && 'Error occurred'}
        </div>
        <div className="loading-details">
          {loadingStep === 'connecting' && 'This may take a few minutes as we calculate inventory projections...'}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error">{error}</div>
        <button 
          className="retry-button"
          onClick={fetchForecast}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="error-container">
        <div className="error">No forecast data available</div>
        <button 
          className="retry-button"
          onClick={fetchForecast}
        >
          Refresh Data
        </button>
      </div>
    );
  }

  const chartData = {
    labels: forecast.weeklyProjections.map(proj => 
      format(new Date(proj.weekStart), 'MMM d')
    ),
    datasets: [
      {
        label: 'Retail Value',
        data: forecast.weeklyProjections.map(proj => proj.endingRetailValue),
        borderColor: 'rgba(44, 61, 47, 1)',
        backgroundColor: 'rgba(44, 61, 47, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Discounted Value',
        data: forecast.weeklyProjections.map(proj => proj.endingDiscountedValue),
        borderColor: 'rgba(210, 129, 95, 1)',
        backgroundColor: 'rgba(210, 129, 95, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Minimum Buffer',
        data: forecast.weeklyProjections.map(proj => 
          proj.projectedSales * forecast.configuration.minimumWeeksBuffer
        ),
        borderColor: 'rgba(143, 171, 158, 0.5)',
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return formatCurrency(value);
          }
        }
      }
    }
  };

  return (
    <div className="inventory-forecast">
      <div className="forecast-header">
        <h2>Inventory Forecast</h2>
        <div className="header-buttons">
          <button 
            className="settings-button"
            onClick={() => setIsSettingsOpen(true)}
          >
            Settings
          </button>
          <button 
            className="refresh-button"
            onClick={fetchForecast}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="loading-steps">
            <div className={`step ${loadingStep >= 1 ? 'active' : ''}`}>
              Connecting to server...
            </div>
            <div className={`step ${loadingStep >= 2 ? 'active' : ''}`}>
              Fetching inventory data...
            </div>
            <div className={`step ${loadingStep >= 3 ? 'active' : ''}`}>
              Calculating forecast...
            </div>
            <div className={`step ${loadingStep >= 4 ? 'active' : ''}`}>
              Preparing visualization...
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-state">
          <div className="error-message">{error}</div>
          <button 
            className="retry-button"
            onClick={fetchForecast}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && forecast && (
        <>
          <InventoryAgeBreakdown inventoryData={forecast.inventoryData} />

          <div className="forecast-chart">
            <Line data={chartData} options={options} />
          </div>

          <div className="threshold-alerts">
            {(() => {
              console.log('Weekly projections:', forecast.weeklyProjections);
              const firstBelowThreshold = forecast.weeklyProjections.find(proj => {
                console.log('Checking projection:', {
                  weekStart: proj.weekStart,
                  endingDiscountedValue: proj.endingDiscountedValue,
                  projectedSales: proj.projectedSales,
                  isBelowThreshold: proj.isBelowThreshold
                });
                return proj.isBelowThreshold;
              });
              console.log('First below threshold:', firstBelowThreshold);
              
              if (firstBelowThreshold) {
                const minimumBuffer = forecast.configuration.minimumWeeksBuffer;
                const minimumBufferValue = firstBelowThreshold.projectedSales * minimumBuffer;
                return (
                  <div className="alert-card">
                    <div className="alert-date">
                      Suggested Inventory Reorder before week of {format(new Date(firstBelowThreshold.weekStart), 'MMM d')}
                    </div>
                    <div className="alert-message">
                      Based on your projected sales goals, your discounted inventory value of {formatCurrency(firstBelowThreshold.endingDiscountedValue)} will fall below the minimum buffer of {minimumBuffer} weeks of sales coverage ({formatCurrency(minimumBufferValue)}).
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </>
      )}

      <InventorySettings
        isOpen={isSettingsOpen}
        onClose={handleSettingsClose}
      />
    </div>
  );
};

export default InventoryForecast; 