import express from 'express';
import { calculateCumulativeSales } from '../../fetch_orders.js';
import SalesGoal from '../models/SalesGoal.js';

const router = express.Router();

// Get all monthly goals
router.get('/goals', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const goals = [];
    
    // Generate array of months for the year
    for (let month = 1; month <= 12; month++) {
      const date = new Date(year, month - 1, 1);
      const goal = await SalesGoal.findOne({ date });
      goals.push({
        month,
        year,
        goal: goal ? goal.goal : 8500 // Default goal if none set
      });
    }
    
    res.json(goals);
  } catch (error) {
    console.error('Error fetching monthly goals:', error);
    res.status(500).json({ error: 'Failed to fetch monthly goals' });
  }
});

// Get sales data for a specific month
router.get('/:month', async (req, res) => {
  try {
    const month = parseInt(req.params.month);
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    console.log('Fetching sales data for:', { month, year });
    
    if (!month || month < 1 || month > 12) {
      console.error('Invalid month:', month);
      return res.status(400).json({ error: 'Invalid month' });
    }
    
    const result = await calculateCumulativeSales(month, year);
    console.log('Raw sales data result:', result);
    console.log('Sales data result:', {
      hasDates: !!result.dates,
      datesLength: result.dates?.length,
      hasDailySales: !!result.dailySales,
      dailySalesLength: result.dailySales?.length,
      hasDailyAmounts: !!result.dailyAmounts,
      dailyAmountsLength: result.dailyAmounts?.length,
      salesGoal: result.salesGoal,
      dates: result.dates,
      firstDate: result.dates?.[0],
      lastDate: result.dates?.[result.dates?.length - 1]
    });
    
    if (!result.dates || !Array.isArray(result.dates)) {
      console.error('Invalid dates data in result:', {
        dates: result.dates,
        isArray: Array.isArray(result.dates),
        type: typeof result.dates
      });
      return res.status(500).json({ error: 'Invalid dates data generated' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

// Get sales goal for a specific month
router.get('/goal', async (req, res) => {
  try {
    const month = parseInt(req.query.month);
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    if (!month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Invalid month' });
    }

    const date = new Date(year, month - 1, 1);
    const goal = await SalesGoal.findOne({ date });
    res.json({ goal: goal ? goal.goal : 8500 }); // Return default goal if none set
  } catch (error) {
    console.error('Error fetching sales goal:', error);
    res.status(500).json({ error: 'Failed to fetch sales goal' });
  }
});

// Update sales goal for a specific month
router.post('/goal', async (req, res) => {
  try {
    const { goal, month, year } = req.body;
    
    if (!goal || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Invalid goal or month' });
    }
    
    const date = new Date(year, month - 1, 1);
    await SalesGoal.findOneAndUpdate(
      { date },
      { goal },
      { upsert: true, new: true }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating sales goal:', error);
    res.status(500).json({ error: 'Failed to update sales goal' });
  }
});

export default router; 