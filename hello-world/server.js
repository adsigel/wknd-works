import express from 'express';
import cors from 'cors';
import { calculateCumulativeSales } from './fetch_orders.js';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config({ path: '.env' });

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

// API endpoint to get sales data
app.get('/api/sales/:month', async (req, res) => {
  try {
    const month = parseInt(req.params.month);
    const data = await calculateCumulativeSales(month);
    
    res.json({
      dailySales: data.dailySales,
      dailyAmounts: data.dailyAmounts,
      dates: data.dates,
      salesGoal: currentSalesGoal,
      projectedSales: data.projectedSales
    });
  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to update sales goal
app.post('/api/sales/goal', (req, res) => {
  const { goal } = req.body;
  if (typeof goal === 'number' && goal > 0) {
    currentSalesGoal = goal;
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid goal value' });
  }
});

// API endpoint to get current sales goal
app.get('/api/sales/goal', (req, res) => {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const goalKey = getGoalKey(year, month);
    const goal = salesGoals.get(goalKey) || DEFAULT_GOAL;
    res.json({ goal });
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

// Store settings in memory for now (can be moved to a database later)
let dashboardSettings = {
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
    console.log('Updated projection settings:', dashboardSettings.projectionSettings);
    res.json({ success: true, settings: dashboardSettings.projectionSettings });
  } catch (error) {
    console.error('Error updating projection settings:', error);
    console.error('Request body:', req.body);
    res.status(500).json({ error: error.message });
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
