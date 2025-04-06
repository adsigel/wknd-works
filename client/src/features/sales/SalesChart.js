import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2'; // Still using Bar for the bar charts
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, LineController } from 'chart.js'; // Import PointElement and LineController
import { format } from 'date-fns';
import Settings from '../settings/Settings';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import '../settings/Settings.css';
import './SalesChart.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement, // Register PointElement for line charts
  Title,
  Tooltip,
  Legend,
  LineController
);

const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" }
];

const defaultChartSettings = {
  'Daily Sales': {
    backgroundColor: 'rgba(44, 61, 47, 0.6)',
    borderColor: 'rgba(44, 61, 47, 1)',
    borderWidth: 1
  },
  'Projected Sales': {
    backgroundColor: 'rgba(210, 129, 95, 0.2)',
    borderColor: 'rgba(210, 129, 95, 1)',
    borderWidth: 2
  },
  'Sales Goal': {
    backgroundColor: 'rgba(143, 171, 158, 0.2)',
    borderColor: 'rgba(143, 171, 158, 1)',
    borderWidth: 3
  }
};

const defaultProjectionSettings = {
  'Monday': 0,
  'Tuesday': 0,
  'Wednesday': 20,
  'Thursday': 20,
  'Friday': 20,
  'Saturday': 20,
  'Sunday': 20
};

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const SalesChart = ({ onMonthlyGoalsUpdate }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const [dailySales, setDailySales] = useState([]);
  const [dailyAmounts, setDailyAmounts] = useState([]);
  const [dates, setDates] = useState([]);
  const [salesGoal, setSalesGoal] = useState(0);
  const [projectedSales, setProjectedSales] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [chartSettings, setChartSettings] = useState(null);
  const [projectionSettings, setProjectionSettings] = useState(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Add resize listener
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load settings when component mounts
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        console.log('Fetching settings on component mount');
        const response = await axios.get(`${API_BASE_URL}/api/settings`);
        console.log('Received settings from server:', response.data);
        if (response.data) {
          // Set chart settings with fallback to defaults
          const newChartSettings = response.data.chartSettings || defaultChartSettings;
          console.log('Setting chart settings:', newChartSettings);
          setChartSettings(newChartSettings);

          // Set projection settings with fallback to defaults
          const newProjectionSettings = response.data.projectionSettings || defaultProjectionSettings;
          console.log('Setting projection settings:', newProjectionSettings);
          setProjectionSettings(newProjectionSettings);
          
          setSettingsLoaded(true);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        // Set defaults if we can't load settings
        setChartSettings(defaultChartSettings);
        setProjectionSettings(defaultProjectionSettings);
        setSettingsLoaded(true);
      }
    };

    fetchSettings();
  }, []); // Empty dependency array means this runs once when component mounts

  // Call fetchSalesData when the user selects a different month or year
  useEffect(() => {
    console.log('useEffect triggered with month:', selectedMonth, 'year:', selectedYear);
    if (settingsLoaded) {
      fetchSalesData(selectedMonth, selectedYear);
    }
  }, [selectedMonth, selectedYear, settingsLoaded]);

  const handleChartSettingsChange = async (newSettings) => {
    try {
      console.log('Saving chart settings:', newSettings);
      const response = await axios.post(`${API_BASE_URL}/api/settings`, {
        chartSettings: newSettings
      });
      
      if (response.data) {
        console.log('Successfully saved chart settings:', response.data);
        setChartSettings(newSettings);
      } else {
        console.error('Failed to save chart settings:', response.data);
        // Revert to previous settings if save failed
        const settingsResponse = await axios.get(`${API_BASE_URL}/api/settings`);
        if (settingsResponse.data.chartSettings) {
          console.log('Reverting to previous chart settings:', settingsResponse.data.chartSettings);
          setChartSettings(settingsResponse.data.chartSettings);
        }
      }
    } catch (error) {
      console.error('Error updating chart settings:', error);
      // Revert to previous settings on error
      try {
        const settingsResponse = await axios.get(`${API_BASE_URL}/api/settings`);
        if (settingsResponse.data.chartSettings) {
          console.log('Reverting to previous chart settings after error:', settingsResponse.data.chartSettings);
          setChartSettings(settingsResponse.data.chartSettings);
        }
      } catch (e) {
        console.error('Error reverting settings:', e);
      }
    }
  };

  const handleProjectionSettingsChange = async (newSettings) => {
    try {
      console.log('Saving projection settings:', newSettings);
      const response = await axios.post(`${API_BASE_URL}/api/settings`, {
        projectionSettings: newSettings
      });
      
      if (response.data) {
        console.log('Successfully saved projection settings:', response.data);
        setProjectionSettings(newSettings);
        // Refresh sales data to update projections
        fetchSalesData(selectedMonth, selectedYear);
      } else {
        console.error('Failed to save projection settings:', response.data);
        // Revert to previous settings if save failed
        const settingsResponse = await axios.get(`${API_BASE_URL}/api/settings`);
        if (settingsResponse.data.projectionSettings) {
          console.log('Reverting to previous projection settings:', settingsResponse.data.projectionSettings);
          setProjectionSettings(settingsResponse.data.projectionSettings);
        }
      }
    } catch (error) {
      console.error('Error updating projection settings:', error);
      // Revert to previous settings on error
      try {
        const settingsResponse = await axios.get(`${API_BASE_URL}/api/settings`);
        if (settingsResponse.data.projectionSettings) {
          console.log('Reverting to previous projection settings after error:', settingsResponse.data.projectionSettings);
          setProjectionSettings(settingsResponse.data.projectionSettings);
        }
      } catch (e) {
        console.error('Error reverting settings:', e);
      }
    }
  };

  const fetchSalesData = async (month, year) => {
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE_URL}/api/sales`;
      console.log('Fetching sales data for:', { month, year });
      const response = await axios.get(url, {
        params: {
          year,
          month
        }
      });

      console.log('Raw API response:', response.data);
      console.log('Sales data response:', {
        hasData: !!response.data,
        dates: response.data?.dates,
        dailySales: response.data?.dailySales,
        dailyAmounts: response.data?.dailyAmounts,
        projectedSales: response.data?.projectedSales,
        salesGoal: response.data?.salesGoal
      });

      if (response.data) {
        console.log('Setting state with:', {
          datesLength: response.data.dates?.length,
          dailySalesLength: response.data.dailySales?.length,
          dailyAmountsLength: response.data.dailyAmounts?.length,
          projectedSalesLength: response.data.projectedSales?.length
        });
        
        setDailySales(response.data.dailySales);
        setDailyAmounts(response.data.dailyAmounts);
        setDates(response.data.dates);
        setProjectedSales(response.data.projectedSales);
        setSalesGoal(response.data.salesGoal);
      } else {
        console.error('No data in response');
        setError('No data received from server');
      }
    } catch (error) {
      console.error('Error fetching sales data:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
        data: error.response?.data
      });
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Render loading state if settings haven't loaded yet
  if (!settingsLoaded) {
    return <div>Loading settings...</div>;
  }

  // Render loading state if fetching sales data
  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  console.log('Current state:', {
    dates,
    dailySales,
    dailyAmounts,
    projectedSales,
    salesGoal,
    selectedMonth,
    selectedYear
  });

  if (!dates || !Array.isArray(dates)) {
    console.error('Invalid dates data:', {
      dates,
      isArray: Array.isArray(dates),
      type: typeof dates,
      length: dates?.length
    });
    return <div>Error: Invalid or missing dates data.</div>;
  }

  const fontFamily = "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif";
  document.body.style.fontFamily = fontFamily;

  const options = {
    responsive: true,
    maintainAspectRatio: false, // Allow chart to determine its own height
    font: {
      family: fontFamily,
      weight: 500
    },
    plugins: {
      tooltip: {
        titleFont: { 
          family: fontFamily,
          weight: 600
        },
        bodyFont: { 
          family: fontFamily,
          weight: 400
        },
        callbacks: {
          title: function(context) {
            const dayIndex = Array.isArray(context) ? context[0].dataIndex : context.dataIndex;
            const date = new Date(selectedYear, selectedMonth - 1, dayIndex + 1);
            const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
            return `${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} (${dayOfWeek})`;
          },
          label: function(context) {
            const dayIndex = Array.isArray(context) ? context[0].dataIndex : context.dataIndex;
            const labels = [];

            // Format numbers with commas
            const formatNumber = (num) => {
              return new Intl.NumberFormat('en-US', { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              }).format(num);
            };

            // Get daily sales goal for this day
            const date = new Date(selectedYear, selectedMonth - 1, dayIndex + 1);
            const dayOfWeek = date.getDay();
            const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
            const dayPercentage = (projectionSettings[dayName] || 0) / monthPercentageTotal;
            const dailyGoal = salesGoal * dayPercentage;

            // Always show daily goal
            labels.push(`Daily Goal: $${formatNumber(dailyGoal)}`);

            // Get actual daily sales from dailyAmounts
            const index = numericDates.indexOf(dayIndex + 1);
            let dailySalesAmount = 0;
            let cumulativeSalesAmount = 0;
            
            if (index !== -1 && dailyAmounts && dailyAmounts[index] !== undefined) {
              // Get daily amount for this day
              dailySalesAmount = dailyAmounts[index];
              // Calculate cumulative amount up to this day
              cumulativeSalesAmount = dailyAmounts
                .slice(0, index + 1)
                .reduce((sum, amount) => sum + amount, 0);
            }

            // Show both daily and cumulative sales
            labels.push(`Daily Sales: $${formatNumber(dailySalesAmount)}`);
            labels.push(`Total Sales to Date: $${formatNumber(cumulativeSalesAmount)}`);

            return labels;
          },
          labelColor: function() {
            return false; // This removes the color box
          }
        }
      },
      legend: {
        display: true,
        labels: {
          font: {
            family: fontFamily,
            weight: 500
          },
          usePointStyle: true,
          pointStyle: function(context) {
            // Use different styles for each series
            switch(context.text) {
              case 'Daily Sales':
                return 'rect';
              case 'Projected Sales':
              case 'Sales Goal':
                return 'line';
              default:
                return 'rect';
            }
          },
          pointStyleWidth: function(context) {
            // Make lines longer than rectangles
            return context.text === 'Daily Sales' ? 16 : 40;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Day of the Month',
          font: { 
            size: 14, 
            weight: 600,
            family: fontFamily
          }
        },
        ticks: {
          font: {
            family: fontFamily,
            weight: 400
          },
          callback: function(value, index) {
            // Only show every other tick on small screens
            return window.innerWidth < 768 && index % 2 !== 0 ? '' : index + 1;
          }
        }
      },
      y: {
        title: {
          display: true,
          text: 'Total Sales',
          font: { 
            size: 14, 
            weight: 600,
            family: fontFamily
          }
        },
        ticks: {
          font: {
            family: fontFamily,
            weight: 400
          },
          callback: function(value) {
            return typeof value === 'number' && !isNaN(value)
              ? `$${Math.round(value).toLocaleString()}`
              : '$0';
          }
        }
      }
    },
    datasets: {
      bar: {
        hidden: false
      },
      line: {
        hidden: false
      }
    }
  };

  const generateDaysArray = (year, month) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  const allDaysInMonth = generateDaysArray(2025, selectedMonth);

  // Get today's date
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  // Filter numeric dates for the selected month
  const numericDates = dates
    .map(date => {
      const parsedDate = new Date(date);
      return parsedDate.getMonth() + 1 === selectedMonth ? parsedDate.getDate() : null;
    })
    .filter(day => day !== null);

  // Fill missing days with 0 sales, but only for past dates
  const filledDailySales = allDaysInMonth.map(day => {
    // If it's the current month and the day hasn't occurred yet, return null
    if (selectedMonth === currentMonth && day > currentDay) {
      return null;
    }
    const index = numericDates.indexOf(day);
    return index !== -1 ? dailySales[index] : 0;
  });

  // Define store open days (closed on Mondays and Tuesdays)
  const openDaysInMonth = allDaysInMonth.filter(day => {
    const dayOfWeek = new Date(2025, selectedMonth - 1, day).getDay();
    return dayOfWeek !== 1 && dayOfWeek !== 2; // 1 is Monday, 2 is Tuesday
  });

  const dailyProjectedGoal = salesGoal / openDaysInMonth.length;

  // Calculate projected sales with normalized daily goals
  let cumulativeProjectedSales = 0;
  
  // First, calculate the total percentage points that will be used in the month
  const monthPercentageTotal = allDaysInMonth.reduce((total, day) => {
    const date = new Date(2025, selectedMonth - 1, day);
    const dayOfWeek = date.getDay();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
    return total + (projectionSettings[dayName] || 0);
  }, 0);

  // Now calculate projected sales for each day
  const filledProjectedSales = allDaysInMonth.map(day => {
    const date = new Date(2025, selectedMonth - 1, day);
    const dayOfWeek = date.getDay();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
    
    // Get the percentage for this day and normalize it relative to the total percentage points
    const dayPercentage = (projectionSettings[dayName] || 0) / monthPercentageTotal;
    
    // Calculate this day's portion of the monthly goal
    const dailyGoal = salesGoal * dayPercentage;
    
    // Add this day's projected sales to the cumulative total
    cumulativeProjectedSales += dailyGoal;
    
    return cumulativeProjectedSales;
  });

  const salesData = {
    labels: allDaysInMonth.map(day => `Day ${day}`),
    datasets: [
      {
        label: 'Daily Sales',
        data: allDaysInMonth.map(day => {
          if (selectedMonth === currentMonth && day > currentDay) {
            return null;
          }
          const index = numericDates.indexOf(day);
          if (index === -1) return 0;
          
          // Calculate cumulative total up to this day
          return dailyAmounts
            .slice(0, index + 1)
            .reduce((sum, amount) => sum + amount, 0);
        }),
        ...chartSettings['Daily Sales'],
        type: 'bar'  // Explicitly set type for Daily Sales
      },
      {
        label: 'Projected Sales',
        data: filledProjectedSales,
        ...chartSettings['Projected Sales'],
        type: 'line',
        fill: false,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0
      },
      {
        label: 'Monthly Sales Goal',
        data: Array(allDaysInMonth.length).fill(salesGoal),
        ...chartSettings['Sales Goal'],
        type: 'line',
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0
      },
    ],
  };

  // Calculate stats for the metrics box
  const calculateStats = () => {
    // Get the current day's index based on numericDates
    const currentDayOfMonth = currentDay;
    const lastDayIndex = currentDayOfMonth - 1; // Convert to 0-based index
    
    // Use cumulativeAmounts for the current total
    const currentTotal = dailyAmounts.reduce((sum, amount, index) => {
      return index <= lastDayIndex ? sum + amount : sum;
    }, 0);
    
    // 1. $ to Target
    const dollarsToTarget = salesGoal - currentTotal;

    // 2. X of Y days hit
    let daysHit = 0;
    let totalOpenDays = 0;
    
    // Calculate today's goal and actual sales
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
    const dayPercentage = (projectionSettings[dayName] || 0) / monthPercentageTotal;
    const todayGoal = salesGoal * dayPercentage;
    
    // Get today's actual sales
    const todaySales = dailyAmounts[lastDayIndex] || 0;
    const todayGoalMet = todaySales >= todayGoal;
    
    allDaysInMonth.forEach((day, index) => {
      // Only count days up to current day
      if (index >= currentDayOfMonth) {
        return;
      }

      const date = new Date(selectedYear, selectedMonth - 1, day);
      const dayOfWeek = date.getDay();
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
      
      // Skip if the store is closed (Monday/Tuesday)
      if (projectionSettings[dayName] === 0) {
        return;
      }

      totalOpenDays++;

      // Calculate daily goal for this day
      const dayPercentage = (projectionSettings[dayName] || 0) / monthPercentageTotal;
      const dailyGoal = salesGoal * dayPercentage;

      // Get actual daily sales for this day
      const actualSales = dailyAmounts[index] || 0;
      
      if (actualSales >= dailyGoal) {
        daysHit++;
      }
    });

    // 3. $ from Plan - compare against projected sales for current day
    const projectedToDate = filledProjectedSales[lastDayIndex];
    const dollarsFromPlan = currentTotal - projectedToDate;

    return {
      dollarsToTarget,
      daysHit,
      totalOpenDays,
      dollarsFromPlan,
      todayGoal,
      todayGoalMet
    };
  };

  const stats = calculateStats();

  const handleSettingsClose = () => {
    setShowSettings(false);
    // Refresh data when settings are closed (saved)
    fetchSalesData(selectedMonth, selectedYear);
    // Notify parent that monthly goals have been updated
    if (onMonthlyGoalsUpdate) {
      onMonthlyGoalsUpdate();
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title" style={{ fontSize: '24px', marginBottom: '24px' }}>
          {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
        </h2>
        
        <div className="controls-section">
          <div className="controls-group">
            <div className="control-item">
              <label>Select Month:</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                {months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="control-item">
              <label>Year:</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                {[2024, 2025].map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="control-item">
              <label>Monthly Goal:</label>
              <span style={{ color: '#2c3d2f', fontWeight: 500 }}>${salesGoal.toLocaleString()}</span>
            </div>
          </div>

          <button 
            className="settings-button"
            onClick={() => setShowSettings(true)}
          >
            Settings
          </button>
        </div>
      </div>

      <div className="chart-section">
        <div className="chart-container">
          <Bar data={salesData} options={options} />
        </div>
        
        <div className="stats-panel">
          <h3 className="stats-title">Stats</h3>
          
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-label">Today's Sales Goal</div>
              <div className="stat-value">
                {formatCurrency(stats.todayGoal)}
                {stats.todayGoalMet && <span role="img" aria-label="celebration">🎉</span>}
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-label">$ to Monthly Goal</div>
              <div className={`stat-value ${stats.dollarsToTarget > 0 ? 'under' : 'over'}`}>
                {formatCurrency(Math.abs(stats.dollarsToTarget))}
                {stats.dollarsToTarget > 0 ? ' under' : ' over'}
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-label">Days Hit Target</div>
              <div className="stat-value">
                {stats.daysHit} of {stats.totalOpenDays} days
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-label">$ from Day-to-Day Projection</div>
              <div className={`stat-value ${stats.dollarsFromPlan >= 0 ? 'over' : 'under'}`}>
                {formatCurrency(Math.abs(stats.dollarsFromPlan))}
                {stats.dollarsFromPlan >= 0 ? ' ahead' : ' behind'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="settings-modal">
          <div className="settings-content">
            <Settings
              onClose={handleSettingsClose}
              chartSettings={chartSettings}
              onChartSettingsChange={handleChartSettingsChange}
              projectionSettings={projectionSettings}
              onProjectionSettingsChange={handleProjectionSettingsChange}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesChart;