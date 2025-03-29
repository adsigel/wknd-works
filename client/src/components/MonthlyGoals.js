import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MonthlyGoals.css';
import { format } from 'date-fns';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MonthlyGoals = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [goals, setGoals] = useState([]);
  const [editingGoal, setEditingGoal] = useState(null);
  const [tempGoal, setTempGoal] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMonthlyGoals = async () => {
    try {
      const response = await axios.get('/api/sales/goals');
      setGoals(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching monthly goals:', error);
      setError('Failed to fetch monthly goals');
      setLoading(false);
    }
  };

  const saveMonthlyGoal = async (month, year, goal) => {
    try {
      await axios.post('/api/sales/goal', {
        month,
        year,
        goal: Number(goal)
      });
      await fetchMonthlyGoals(); // Refresh the goals after saving
    } catch (error) {
      console.error('Error saving monthly goal:', error);
      setError('Failed to save monthly goal');
    }
  };

  useEffect(() => {
    fetchMonthlyGoals();
  }, []);

  const handleGoalUpdate = async (month) => {
    try {
      await saveMonthlyGoal(month, selectedYear, tempGoal);
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
            {editingGoal === goal.month ? (
              <form 
                className="goal-edit-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleGoalUpdate(goal.month);
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
                <span>{formatCurrency(goal.goal)}</span>
                <button 
                  className="edit-button"
                  onClick={() => {
                    setEditingGoal(goal.month);
                    setTempGoal(goal.goal.toString());
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MonthlyGoals; 