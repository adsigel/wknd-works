import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MonthlyGoals.css';
import { format } from 'date-fns';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MonthlyGoals = ({ onGoalsChange }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [goals, setGoals] = useState([]);
  const [tempGoals, setTempGoals] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMonthlyGoals = async () => {
    try {
      const response = await axios.get(`/api/sales/goals?year=${selectedYear}`);
      setGoals(response.data);
      // Initialize tempGoals with current goals
      const initialTempGoals = {};
      response.data.forEach(goal => {
        initialTempGoals[goal.month] = goal.goal.toString();
      });
      setTempGoals(initialTempGoals);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching monthly goals:', error);
      setError('Failed to fetch monthly goals');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyGoals();
  }, [selectedYear]);

  const handleGoalChange = (month, value) => {
    setTempGoals(prev => ({
      ...prev,
      [month]: value
    }));
    
    // Notify parent of all current goals
    const updatedGoals = goals.map(goal => ({
      ...goal,
      goal: goal.month === month ? Number(value) || 0 : Number(tempGoals[goal.month] || goal.goal)
    }));
    onGoalsChange(updatedGoals);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="monthly-goals">
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

      <div className="monthly-goals-grid">
        {goals.map((goal) => (
          <div key={`${goal.month}-${goal.year}`} className="goal-item">
            <div className="goal-month">{format(new Date(goal.year, goal.month - 1), 'MMMM')}</div>
            <div className="goal-input">
              <span className="currency-symbol">$</span>
              <input
                type="number"
                value={tempGoals[goal.month] || ''}
                onChange={(e) => handleGoalChange(goal.month, e.target.value)}
                placeholder="Enter goal"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MonthlyGoals; 