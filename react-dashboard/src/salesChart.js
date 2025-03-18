import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2'; // Still using Bar for the bar charts
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, LineController } from 'chart.js'; // Import PointElement and LineController
import { format } from 'date-fns';
import Settings from './Settings';
import './Settings.css';

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

const SalesChart = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const [dailySales, setDailySales] = useState([]);
  const [dailyAmounts, setDailyAmounts] = useState([]);
  const [dates, setDates] = useState([]);
  const [salesGoal, setSalesGoal] = useState(0);
  const [projectedSales, setProjectedSales] = useState([]);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [chartSettings, setChartSettings] = useState(defaultChartSettings);
  const [projectionSettings, setProjectionSettings] = useState(defaultProjectionSettings);

  // Add resize listener
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load settings from backend when component mounts
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/settings`);
        setChartSettings(response.data.chartSettings);
        setProjectionSettings(response.data.projectionSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
        // Fall back to defaults if we can't load from server
        setChartSettings(defaultChartSettings);
        setProjectionSettings(defaultProjectionSettings);
      }
    };
    loadSettings();
  }, []);

  const handleChartSettingsChange = async (newSettings) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/settings/chart`,
        newSettings
      );
      if (response.data.success) {
        setChartSettings(newSettings);
      }
    } catch (error) {
      console.error('Error saving chart settings:', error);
      // Optionally show error to user
    }
  };

  const handleProjectionSettingsChange = async (newSettings) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/settings/projection`,
        newSettings
      );
      if (response.data.success) {
        setProjectionSettings(newSettings);
        // Refresh sales data to update projections
        fetchSalesData(selectedMonth, selectedYear);
      }
    } catch (error) {
      console.error('Error saving projection settings:', error);
      // Optionally show error to user
    }
  };

  const fetchSalesData = async (month, year) => {
    setLoading(true);
    setError(null);
    const url = `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/sales/${month}`;
    try {
      console.log('Making request to:', url);
      console.log('Environment variables:', {
        REACT_APP_API_URL: process.env.REACT_APP_API_URL,
        NODE_ENV: process.env.NODE_ENV
      });
      const response = await axios.get(url);
      console.log('Response received:', response);
      setDailySales(response.data.dailySales);
      setDailyAmounts(response.data.dailyAmounts);
      setDates(response.data.dates);
      setSalesGoal(response.data.salesGoal);
      setProjectedSales(response.data.projectedSales);
    } catch (error) {
      console.error("Error fetching sales data:", error);
      console.error("Error details:", {
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

  const updateSalesGoal = async (newGoal) => {
    try {
      console.log('Sending new goal:', newGoal);
      const response = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/sales/goal`, { 
        goal: Number(newGoal),
        month: selectedMonth,
        year: selectedYear
      });
      console.log('Server response:', response.data);
      
      if (response.data.success) {
        setSalesGoal(newGoal);
        setIsEditingGoal(false);
        // Refresh the data with the new goal
        fetchSalesData(selectedMonth, selectedYear);
      } else {
        console.error('Failed to update goal:', response.data.error);
      }
    } catch (error) {
      console.error('Error updating sales goal:', error.response?.data || error.message);
    }
  };

  const handleGoalSubmit = (e) => {
    e.preventDefault();
    const newGoal = parseFloat(tempGoal);
    if (!isNaN(newGoal) && newGoal > 0) {
      updateSalesGoal(newGoal);
    } else {
      console.error('Invalid goal value:', tempGoal);
      // You might want to show an error message to the user here
    }
  };

  // Call fetchSalesData when the user selects a different month or year
  useEffect(() => {
    console.log('useEffect triggered with month:', selectedMonth, 'year:', selectedYear);
    fetchSalesData(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);
  
  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!dates || !Array.isArray(dates)) {
    console.log('Rendering error state - dates:', dates);
    return <div>Error: Invalid or missing dates data.</div>;
  }

  const fontFamily = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif";
  document.body.style.fontFamily = fontFamily;

  const options = {
    responsive: true,
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
            if (index !== -1 && dailyAmounts && dailyAmounts[index] !== undefined) {
              dailySalesAmount = dailyAmounts[index];
            } else {
              // Calculate from cumulative as fallback
              const currentCumulative = dailySales[dayIndex] || 0;
              const previousCumulative = dayIndex > 0 ? dailySales[dayIndex - 1] || 0 : 0;
              dailySalesAmount = currentCumulative - previousCumulative;
            }
            labels.push(`Daily Sales: $${formatNumber(dailySalesAmount)}`);

            // Show monthly sales to date (cumulative)
            const monthlyToDate = dailySales[dayIndex] || 0;
            labels.push(`Monthly Sales to Date: $${formatNumber(monthlyToDate)}`);

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
            return index + 1; // Just show the number
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
          return index !== -1 ? dailySales[index] : 0;
        }),
        ...chartSettings['Daily Sales']
      },
      {
        label: 'Projected Sales',
        data: filledProjectedSales,
        ...chartSettings['Projected Sales'],
        type: 'line',
        fill: false,
        borderDash: [5, 5]
      },
      {
        label: 'Sales Goal',
        data: Array(allDaysInMonth.length).fill(salesGoal),
        ...chartSettings['Sales Goal'],
        type: 'line',
        fill: false
      },
    ],
  };

  // Calculate stats for the metrics box
  const calculateStats = () => {
    // Get the current day's index based on numericDates
    const currentDayOfMonth = currentDay;
    const lastDayIndex = currentDayOfMonth - 1; // Convert to 0-based index
    const currentTotal = dailySales[lastDayIndex] || 0;
    
    // 1. $ to Target
    const dollarsToTarget = salesGoal - currentTotal;

    // 2. X of Y days hit
    let daysHit = 0;
    let totalOpenDays = 0;
    
    // Calculate today's goal
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
    const dayPercentage = (projectionSettings[dayName] || 0) / monthPercentageTotal;
    const todayGoal = salesGoal * dayPercentage;
    
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

      // Calculate actual daily sales
      const currentDaySales = index === 0 ? dailySales[0] : dailySales[index] - dailySales[index - 1];
      
      if (currentDaySales >= dailyGoal) {
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
      todayGoal
    };
  };

  const stats = calculateStats();

  // Format currency
  const formatCurrency = (amount) => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return formatter.format(amount);
  };

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', fontFamily }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label>Select Month: </label>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          <label style={{ marginLeft: '20px' }}>Year: </label>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {[2024, 2025].map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={() => setShowSettings(true)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#2c3d2f',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Settings
        </button>
      </div>

      <div style={{ marginBottom: '20px', fontFamily }}>
        {isEditingGoal ? (
          <form onSubmit={handleGoalSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label>Monthly Goal: $</label>
            <input
              type="number"
              value={tempGoal}
              onChange={(e) => setTempGoal(e.target.value)}
              style={{ width: '100px' }}
              autoFocus
            />
            <button type="submit">Save</button>
            <button type="button" onClick={() => setIsEditingGoal(false)}>Cancel</button>
          </form>
        ) : (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label>Monthly Goal: ${salesGoal.toLocaleString()}</label>
            <button onClick={() => {
              setTempGoal(salesGoal.toString());
              setIsEditingGoal(true);
            }}>Edit</button>
          </div>
        )}
      </div>

      <h2 style={{ fontFamily }}>{months.find(m => m.value === selectedMonth)?.label} {selectedYear}</h2>
      
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column-reverse' : 'row',
        gap: '20px', 
        alignItems: isMobile ? 'stretch' : 'flex-start'
      }}>
        <div style={{ flex: 1 }}>
          <Bar data={salesData} options={options} />
        </div>
        
        <div style={{
          minWidth: isMobile ? 'auto' : '200px',
          padding: '20px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          fontFamily,
          marginBottom: isMobile ? '20px' : '0'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#2c3d2f' }}>Stats</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#666' }}>Today's Sales Goal</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3d2f' }}>
                {formatCurrency(stats.todayGoal)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '14px', color: '#666' }}>$ to Target</div>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: 'bold',
                color: stats.dollarsToTarget > 0 ? '#d2815f' : '#8fab9e'
              }}>
                {formatCurrency(Math.abs(stats.dollarsToTarget))}
                {stats.dollarsToTarget > 0 ? ' under' : ' over'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '14px', color: '#666' }}>Days Hit Target</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3d2f' }}>
                {stats.daysHit} of {stats.totalOpenDays} days
              </div>
            </div>

            <div>
              <div style={{ fontSize: '14px', color: '#666' }}>$ from Plan</div>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: 'bold',
                color: stats.dollarsFromPlan >= 0 ? '#8fab9e' : '#d2815f'
              }}>
                {formatCurrency(Math.abs(stats.dollarsFromPlan))}
                {stats.dollarsFromPlan >= 0 ? ' ahead' : ' behind'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          chartSettings={chartSettings}
          onChartSettingsChange={handleChartSettingsChange}
          projectionSettings={projectionSettings}
          onProjectionSettingsChange={handleProjectionSettingsChange}
        />
      )}
    </div>
  );
};

export default SalesChart;