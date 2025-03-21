const express = require('express');
const router = express.Router();
const SalesGoal = require('../models/SalesGoal');

// Get monthly sales goals for a range of months
router.get('/goals', async (req, res) => {
  try {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    const endDate = new Date(today.getFullYear(), today.getMonth() + 12, 1);

    const goals = await SalesGoal.find({
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: 1 });

    // Format the response
    const formattedGoals = goals.map(goal => ({
      year: goal.date.getFullYear(),
      month: goal.date.getMonth() + 1,
      goal: goal.goal
    }));

    res.json(formattedGoals);
  } catch (error) {
    console.error('Error fetching monthly goals:', error);
    res.status(500).json({ error: 'Failed to fetch monthly goals' });
  }
});

// Update sales goal for a specific month
router.post('/goal', async (req, res) => {
  try {
    const { goal, month, year } = req.body;
    
    if (typeof goal !== 'number' || goal <= 0) {
      return res.status(400).json({ error: 'Invalid goal value' });
    }

    // Create a date object for the first day of the month
    const date = new Date(year, month - 1, 1);

    // Find and update or create the goal for this month
    const updatedGoal = await SalesGoal.findOneAndUpdate(
      { date },
      { goal },
      { upsert: true, new: true }
    );

    res.json({ success: true, goal: updatedGoal });
  } catch (error) {
    console.error('Error updating sales goal:', error);
    res.status(500).json({ error: 'Failed to update sales goal' });
  }
});

// Get sales goal for a specific month
router.get('/goal', async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    const date = new Date(year, month - 1, 1);
    const goal = await SalesGoal.findOne({ date });

    res.json({ goal: goal ? goal.goal : 0 });
  } catch (error) {
    console.error('Error fetching sales goal:', error);
    res.status(500).json({ error: 'Failed to fetch sales goal' });
  }
}); 