import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2'; // Still using Bar for the bar charts
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, LineController } from 'chart.js'; // Import PointElement and LineController
import { format } from 'date-fns';

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


const SalesChart = () => {
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [dailySales, setDailySales] = useState([]);
  const [dates, setDates] = useState([]);
  const [salesGoal, setSalesGoal] = useState(0);
  const [projectedSales, setProjectedSales] = useState([]);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const options = {
    responsive: true,
    plugins: {
      tooltip: {
        callbacks: {
          label: function (context) {
            let value = context.raw;
            return typeof value === 'number' && !isNaN(value)
              ? `$${value.toFixed(2)}`
              : '$0.00';
          },
        },
      },
      legend: {
        display: true, // Ensures the legend is visible
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Day of the Month', // X-axis label
          font: { size: 14, weight: 'bold' },
        },
      },
      y: {
        title: {
          display: true,
          text: 'Total Sales', // Y-axis label
          font: { size: 14, weight: 'bold' },
        },
        ticks: {
          callback: function (value) {
            return typeof value === 'number' && !isNaN(value)
              ? `$${value.toFixed(2)}`
              : '$0.00';
          },
        },
      },
    },
    datasets: {
      bar: {
        hidden: false // Ensure bar charts are visible by default
      },
      line: {
        hidden: false // Ensure line charts are visible by default
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
  let cumulativeProjectedSales = 0;

  const filledProjectedSales = allDaysInMonth.map(day => {
    const dayOfWeek = new Date(2025, selectedMonth - 1, day).getDay();
    if (dayOfWeek !== 1 && dayOfWeek !== 2) { // Only add projected sales for open days
      cumulativeProjectedSales += dailyProjectedGoal;
    }
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
        backgroundColor: 'rgba(44, 61, 47, 0.6)',
        borderColor: 'rgba(44, 61, 47, 1)',
        borderWidth: 1,
      },
      {
        label: 'Projected Sales',
        data: filledProjectedSales,
        backgroundColor: 'rgba(210, 129, 95, 0.2)',
        borderColor: 'rgba(210, 129, 95, 1)',
        borderWidth: 2,
        borderDash: [5, 5],
        type: 'line',
        fill: false
      },
      {
        label: 'Sales Goal',
        data: Array(allDaysInMonth.length).fill(salesGoal),
        backgroundColor: 'rgba(143, 171, 158, 0.2)',
        borderColor: 'rgba(143, 171, 158, 1)',
        borderWidth: 3,
        type: 'line',
        fill: false
      },
    ],
  };

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
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

        <div style={{ marginLeft: '20px' }}>
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
      </div>

      <h2>Sales for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</h2>
      <Bar data={salesData} options={options} />
    </div>
  );
};

export default SalesChart;