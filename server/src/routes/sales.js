import express from 'express';
import { calculateCumulativeSales } from '../services/orderService.js';
import SalesGoal from '../models/SalesGoal.js';

const router = express.Router();

// Default route - returns current month's data
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();
    
    console.log('Fetching sales data for:', { month, year });
    
    if (!month || month < 1 || month > 12) {
      console.error('Invalid month:', month);
      return res.status(400).json({ error: 'Invalid month' });
    }
    
    // Get real sales data
    const result = await calculateCumulativeSales(month, year);
    
    // Get the sales goal
    const date = new Date(year, month - 1, 1);
    const goalDoc = await SalesGoal.findOne({ date }) || { goal: 8500 };
    
    // Add the goal to the result
    result.salesGoal = goalDoc.goal;
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

// Get all monthly goals
router.get('/goals', async (req, res) => {
  console.log('GET /api/sales/goals - Received request:', {
    query: req.query,
    url: req.url,
    path: req.path
  });
  
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    console.log('Fetching monthly goals for year:', year);
    
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
    
    console.log('Returning goals:', goals);
    res.json(goals);
  } catch (error) {
    console.error('Error fetching monthly goals:', error);
    res.status(500).json({ error: 'Failed to fetch monthly goals' });
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

// Analyze past sales to determine daily distribution
router.get('/analyze', async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();

    console.log('\n========== STARTING SALES ANALYSIS ==========');
    console.log('Analysis period:', { 
      month, 
      year,
      rawMonth: req.query.month,
      rawYear: req.query.year 
    });

    if (!month || month < 1 || month > 12) {
      console.error('Invalid month value:', {
        month,
        rawMonth: req.query.month,
        type: typeof month
      });
      return res.status(400).json({ error: `Invalid month: ${month}. Month must be between 1 and 12.` });
    }

    // Get sales data for the current month
    const result = await calculateCumulativeSales(month, year);
    
    // Calculate daily distribution
    const dailyTotals = {
      'Sunday': 0,
      'Monday': 0,
      'Tuesday': 0,
      'Wednesday': 0,
      'Thursday': 0,
      'Friday': 0,
      'Saturday': 0
    };
    
    const dailyCounts = { ...dailyTotals };
    
    console.log('\n========== PROCESSING DATES ==========');
    
    // Sum up sales by day of week
    result.dates.forEach((dateStr, index) => {
      // Parse the YYYY-MM-DD date string
      const [dateYear, dateMonth, dateDay] = dateStr.split('-').map(Number);
      // Create date object in local timezone
      const localDate = new Date(dateYear, dateMonth - 1, dateDay);
      const dayOfWeek = localDate.getDay();
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
      const amount = result.dailyAmounts[index] || 0;
      
      console.log('Processing date:', {
        dateStr,
        parsedDate: `${dateYear}-${dateMonth}-${dateDay}`,
        localDate: localDate.toLocaleString(),
        dayOfWeek,
        dayName,
        amount
      });
      
      dailyTotals[dayName] += amount;
      if (amount > 0) {
        dailyCounts[dayName]++;
      }
    });
    
    console.log('\n========== DAILY SUMMARY ==========');
    console.log('Daily Totals:', dailyTotals);
    console.log('Daily Counts:', dailyCounts);
    
    // Calculate average daily sales
    const totalSales = Object.values(dailyTotals).reduce((sum, val) => sum + val, 0);
    const dailyDistribution = {};
    
    Object.entries(dailyTotals).forEach(([day, total]) => {
      dailyDistribution[day] = totalSales > 0 ? total / totalSales : 0;
    });

    console.log('\n========== FINAL RESULTS ==========');
    console.log('Total Sales:', totalSales);
    console.log('Daily Distribution:', dailyDistribution);
    console.log('====================================\n');
    
    res.json({
      dailyDistribution,
      dailyTotals,
      dailyCounts,
      totalSales
    });
  } catch (error) {
    console.error('Error analyzing sales data:', error);
    res.status(500).json({ error: 'Failed to analyze sales data' });
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

export default router; 