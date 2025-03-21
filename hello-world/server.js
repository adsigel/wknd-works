import express from 'express';
import cors from 'cors';
import { calculateCumulativeSales, getOrders } from './fetch_orders.js';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import SalesGoal from './backend/models/SalesGoal.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env' });

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wknd-dashboard', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const app = express();
const port = process.env.PORT || 5001;

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'https://wknd-dashboard.onrender.com'  // Updated frontend URL
].filter(Boolean); // Remove any undefined values

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working' });
});

// Middleware to parse JSON in request body (if needed)
app.use(express.json());

// Store the sales goals in memory (you might want to persist this in a database later)
const salesGoals = new Map();

// Helper function to get the key for a month/year combination
const getGoalKey = (year, month) => `${year}-${month}`;

// Default goal if none is set for a month
const DEFAULT_GOAL = 10000;

let currentSalesGoal = 8500; // Default sales goal

// API endpoint to get current sales goal
app.get('/api/sales/goal', async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    const date = new Date(year, month - 1, 1);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    const goal = await SalesGoal.findOne({ date });

    res.json({ goal: goal ? goal.goal : 0 });
  } catch (error) {
    console.error('Error fetching sales goal:', error);
    res.status(500).json({ error: 'Failed to fetch sales goal' });
  }
});

// API endpoint to update sales goal
app.post('/api/sales/goal', async (req, res) => {
  try {
    const { goal, month, year } = req.body;
    if (typeof goal !== 'number' || goal <= 0) {
      return res.status(400).json({ error: 'Invalid goal value' });
    }

    const date = new Date(year, month - 1, 1);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }

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

// API endpoint to get sales data
app.get('/api/sales/:month', async (req, res) => {
  try {
    console.log('Received request for sales data:', {
      month: req.params.month,
      year: req.query.year,
      url: req.url
    });

    const month = parseInt(req.params.month);
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    console.log('Parsed values:', { month, year });
    
    // Validate month and year
    if (isNaN(month) || month < 1 || month > 12) {
      console.log('Invalid month:', month);
      return res.status(400).json({ error: 'Invalid month' });
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      console.log('Invalid year:', year);
      return res.status(400).json({ error: 'Invalid year' });
    }

    // Get the sales goal for this month
    const date = new Date(year, month - 1, 1);
    console.log('Created date:', date);
    
    if (isNaN(date.getTime())) {
      console.log('Invalid date created');
      return res.status(400).json({ error: 'Invalid date' });
    }

    // Get the sales goal from the database
    const goal = await SalesGoal.findOne({ date });
    console.log('Found goal:', goal);
    const salesGoal = goal ? goal.goal : 8500; // Default goal if none set

    // Get the sales data
    const data = await calculateCumulativeSales(month, year);
    console.log('Got sales data:', {
      datesLength: data.dates.length,
      dailySalesLength: data.dailySales.length,
      dailyAmountsLength: data.dailyAmounts.length
    });
    
    // Update the sales goal in the response
    data.salesGoal = salesGoal;
    data.projectedSales = Array(data.dates.length).fill(salesGoal);
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sales/recommend-projection', (req, res) => {
  // Return a simple recommendation based on typical retail patterns
  res.json({
    distribution: {
      'Monday': 0,
      'Tuesday': 0,
      'Wednesday': 15,
      'Thursday': 15,
      'Friday': 20,
      'Saturday': 30,
      'Sunday': 20
    }
  });
});

// // API endpoint to get sales report (optional, you can keep it if needed)
// app.get('/sales-report', async (req, res) => {
//   const { year, month, monthSalesGoal } = req.query;
  
//   if (!year || !month || !monthSalesGoal) {
//     return res.status(400).json({ error: 'Year, month, and monthSalesGoal are required' });
//   }

//   try {
//     const salesData = await calculateCumulativeSales(parseInt(year), parseInt(month), parseFloat(monthSalesGoal));
//     res.json(salesData);
//   } catch (error) {
//     console.error('Error generating sales report:', error);
//     res.status(500).json({ error: 'Failed to generate sales report' });
//   }
// });

const SETTINGS_FILE = path.join(__dirname, 'dashboard_settings.json');

// Default settings
const defaultSettings = {
  chartSettings: {
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
  },
  projectionSettings: {
    'Monday': 0,
    'Tuesday': 0,
    'Wednesday': 20,
    'Thursday': 20,
    'Friday': 20,
    'Saturday': 20,
    'Sunday': 20
  }
};

// Load settings from file or use defaults
let dashboardSettings;
try {
  if (fs.existsSync(SETTINGS_FILE)) {
    const fileContent = fs.readFileSync(SETTINGS_FILE, 'utf8');
    dashboardSettings = JSON.parse(fileContent);
    console.log('Loaded settings from file');
  } else {
    dashboardSettings = defaultSettings;
    // Save default settings to file
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
    console.log('Created new settings file with defaults');
  }
} catch (error) {
  console.error('Error loading settings:', error);
  dashboardSettings = defaultSettings;
}

// Helper function to save settings
const saveSettings = () => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(dashboardSettings, null, 2));
    console.log('Settings saved successfully');
  } catch (error) {
    console.error('Error saving settings:', error);
  }
};

// Get current dashboard settings
app.get('/api/settings', (req, res) => {
  console.log('GET /api/settings - Sending settings:', dashboardSettings);
  res.json(dashboardSettings);
});

// Update chart settings
app.post('/api/settings/chart', (req, res) => {
  try {
    console.log('POST /api/settings/chart - Received body:', req.body);
    const newSettings = req.body;
    
    // Validate the structure of newSettings
    if (!newSettings || typeof newSettings !== 'object') {
      throw new Error('Invalid settings format');
    }
    
    // Ensure all required series are present
    const requiredSeries = ['Daily Sales', 'Projected Sales', 'Sales Goal'];
    for (const series of requiredSeries) {
      if (!newSettings[series]) {
        throw new Error(`Missing settings for ${series}`);
      }
    }
    
    dashboardSettings.chartSettings = newSettings;
    saveSettings(); // Save to file
    console.log('Updated chart settings:', dashboardSettings.chartSettings);
    res.json({ success: true, settings: dashboardSettings.chartSettings });
  } catch (error) {
    console.error('Error updating chart settings:', error);
    console.error('Request body:', req.body);
    res.status(500).json({ error: error.message });
  }
});

// Update projection settings
app.post('/api/settings/projection', (req, res) => {
  try {
    console.log('POST /api/settings/projection - Received body:', req.body);
    const newSettings = req.body;
    
    // Validate the structure of newSettings
    if (!newSettings || typeof newSettings !== 'object') {
      throw new Error('Invalid settings format');
    }
    
    // Validate that all days are present
    const requiredDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const day of requiredDays) {
      if (typeof newSettings[day] !== 'number') {
        throw new Error(`Missing or invalid percentage for ${day}`);
      }
    }
    
    // Validate that percentages sum to 100
    const total = Object.values(newSettings).reduce((sum, val) => sum + Number(val), 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(`Projection percentages must sum to 100% (got ${total.toFixed(2)}%)`);
    }
    
    dashboardSettings.projectionSettings = newSettings;
    saveSettings(); // Save to file
    console.log('Updated projection settings:', dashboardSettings.projectionSettings);
    res.json({ success: true, settings: dashboardSettings.projectionSettings });
  } catch (error) {
    console.error('Error updating projection settings:', error);
    console.error('Request body:', req.body);
    res.status(500).json({ error: error.message });
  }
});

// Analyze historical sales distribution
app.get('/api/analyze-sales', async (req, res) => {
  try {
    // Get today's date
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 90); // Go back 90 days

    // Initialize totals for each day of the week
    const dayTotals = {
      'Sunday': 0,
      'Monday': 0,
      'Tuesday': 0,
      'Wednesday': 0,
      'Thursday': 0,
      'Friday': 0,
      'Saturday': 0
    };
    const dayCounts = { ...dayTotals };

    // Get orders for the last 90 days
    const orders = await getOrders(startDate.toISOString());
    
    // Calculate total sales for each day of the week
    orders.forEach(order => {
      const orderDate = new Date(order.created_at);
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][orderDate.getDay()];
      dayTotals[dayOfWeek] += parseFloat(order.total_price);
      dayCounts[dayOfWeek]++;
    });

    // Calculate total sales across all days
    const totalSales = Object.values(dayTotals).reduce((sum, val) => sum + val, 0);

    // Calculate percentages
    const percentages = {};
    Object.keys(dayTotals).forEach(day => {
      percentages[day] = totalSales > 0 ? Math.round(dayTotals[day] / totalSales * 100) : 0;
    });

    // Ensure percentages sum to 100
    const totalPercentage = Object.values(percentages).reduce((sum, val) => sum + val, 0);
    if (totalPercentage !== 100 && totalPercentage > 0) {
      // Add/subtract the difference from the day with the highest sales
      const highestDay = Object.entries(dayTotals)
        .reduce((a, b) => (a[1] > b[1] ? a : b))[0];
      percentages[highestDay] += (100 - totalPercentage);
    }

    const totalOrders = Object.values(dayCounts).reduce((sum, val) => sum + val, 0);

    res.json({
      percentages,
      totalSales,
      totalOrders,
      daysAnalyzed: 90
    });
  } catch (error) {
    console.error('Error analyzing sales:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
