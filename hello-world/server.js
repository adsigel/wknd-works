import express from 'express';
import cors from 'cors';
import { calculateCumulativeSales, getOrders } from './fetch_orders.js';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import SalesGoal from './backend/models/SalesGoal.js';
import Settings from './backend/models/Settings.js';
import Order from './backend/models/Order.js';
import { MongoClient } from 'mongodb';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env' });

// MongoDB connection
console.log('Starting server initialization...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV);

// Use the MongoDB URI as-is without modifications
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wknd-dashboard';

console.log('MongoDB URI:', mongoUri ? 'URI is set' : 'URI is not set');
if (mongoUri) {
  // Mask the password in the URI for security
  const maskedUri = mongoUri.replace(
    /mongodb\+srv:\/\/([^:]+):([^@]+)@/,
    'mongodb+srv://$1:****@'
  );
  console.log('MongoDB URI (masked):', maskedUri);
}
console.log('PORT:', process.env.PORT || 5001);

// Add error handlers for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', {
    name: error.name,
    message: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Monitor MongoDB connection state
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
  console.log('Database name:', mongoose.connection.db.databaseName);
  console.log('Connection state:', mongoose.connection.readyState);
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', {
    name: err.name,
    message: err.message,
    code: err.code,
    stack: err.stack
  });
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
  console.log('Connection state:', mongoose.connection.readyState);
});

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

// Middleware to check MongoDB connection
app.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('MongoDB not connected. State:', mongoose.connection.readyState);
    return res.status(503).json({ error: 'Database connection not available' });
  }
  next();
});

// Store the sales goals in memory (you might want to persist this in a database later)
const salesGoals = new Map();

// Helper function to get the key for a month/year combination
const getGoalKey = (year, month) => `${year}-${month}`;

// Default goal if none is set for a month
const DEFAULT_GOAL = 10000;

let currentSalesGoal = 8500; // Default sales goal

// Get all monthly goals for a year
app.get('/api/sales/goals', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const goals = [];
    
    // Generate array of months for the year
    for (let month = 1; month <= 12; month++) {
      const date = new Date(year, month - 1, 1);
      const goal = await SalesGoal.findOne({ date });
      goals.push({
        month,
        goal: goal ? goal.goal : 8500 // Default goal if none set
      });
    }
    
    res.json(goals);
  } catch (error) {
    console.error('Error fetching monthly goals:', error);
    res.status(500).json({ error: 'Failed to fetch monthly goals' });
  }
});

// Get sales goal for a specific month
app.get('/api/sales/goal', async (req, res) => {
  const { month, year } = req.query;
  
  if (!month || !year) {
    return res.status(400).json({ error: 'Month and year are required' });
  }

  try {
    console.log('Fetching sales goal for:', { month, year });
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    
    // Create a date object for the first day of the month
    const date = new Date(year, month - 1, 1);
    console.log('Looking for goal with date:', date);

    const salesGoal = await SalesGoal.findOne({ date });
    console.log('Found sales goal:', salesGoal);

    if (!salesGoal) {
      console.log('No sales goal found for this month');
      return res.json({ goal: 0 });
    }

    res.json({ goal: salesGoal.goal });
  } catch (error) {
    console.error('Error fetching sales goal:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
      connectionState: mongoose.connection.readyState
    });
    res.status(500).json({ error: 'Failed to fetch sales goal' });
  }
});

// Update sales goal for a specific month
app.post('/api/sales/goal', async (req, res) => {
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

// Get sales data for a specific month
app.get('/api/sales/:month', async (req, res) => {
  try {
    const month = parseInt(req.params.month);
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    if (!month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Invalid month' });
    }
    
    const result = await calculateCumulativeSales(month, year);
    res.json(result);
  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.status(500).json({ error: 'Failed to fetch sales data' });
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

// Get current dashboard settings
app.get('/api/settings', async (req, res) => {
  try {
    console.log('GET /api/settings - Fetching settings from database');
    let settings = await Settings.findOne();
    
    if (!settings) {
      // If no settings exist, create default settings
      settings = new Settings(defaultSettings);
      await settings.save();
      console.log('Created new settings with defaults');
    }
    
    console.log('Sending settings:', settings);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update chart settings
app.post('/api/settings/chart', async (req, res) => {
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
    
    // Find existing settings or create new ones
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(defaultSettings);
    }
    
    // Update chart settings
    settings.chartSettings = newSettings;
    await settings.save();
    
    console.log('Updated chart settings:', settings.chartSettings);
    res.json({ success: true, settings: settings.chartSettings });
  } catch (error) {
    console.error('Error updating chart settings:', error);
    console.error('Request body:', req.body);
    res.status(500).json({ error: error.message });
  }
});

// Update projection settings
app.post('/api/settings/projection', async (req, res) => {
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
    
    // Find existing settings or create new ones
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(defaultSettings);
    }
    
    // Update projection settings
    settings.projectionSettings = newSettings;
    await settings.save();
    
    console.log('Updated projection settings:', settings.projectionSettings);
    res.json({ success: true, settings: settings.projectionSettings });
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

// Helper function to generate mock orders for analysis
function generateMockOrders() {
  const orders = [];
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  // Generate 90 days of mock data
  for (let i = 0; i < 90; i++) {
    const date = new Date(threeMonthsAgo);
    date.setDate(date.getDate() + i);
    
    // Skip Mondays and Tuesdays (store is closed)
    if (date.getDay() === 1 || date.getDay() === 2) continue;
    
    // Generate random sales amount between $100 and $1000
    const amount = Math.random() * 900 + 100;
    
    orders.push({
      date: date,
      amount: amount
    });
  }
  
  return orders;
}

// Analyze past sales data to calculate daily distribution
app.get('/api/sales/analyze', async (req, res) => {
  try {
    console.log('Starting sales analysis...');
    
    // Get today's date
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 90); // Go back 90 days
    console.log('Analyzing data from:', startDate.toISOString(), 'to', today.toISOString());

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

    // Get sales data for the last 3 months
    for (let i = 0; i < 3; i++) {
      const month = today.getMonth() - i;
      const year = today.getFullYear();
      console.log(`Fetching data for month ${month + 1}, year ${year}`);
      
      try {
        const salesData = await calculateCumulativeSales(month + 1, year);
        console.log(`Received sales data for ${month + 1}/${year}:`, {
          dates: salesData.dates.length,
          dailyAmounts: salesData.dailyAmounts.length
        });
        
        // Process each day's sales
        salesData.dates.forEach((date, index) => {
          const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
          const dailyAmount = salesData.dailyAmounts[index];
          dayTotals[dayOfWeek] += dailyAmount;
          dayCounts[dayOfWeek]++;
        });
      } catch (error) {
        console.error(`Error fetching data for month ${month + 1}:`, error);
        // Continue with next month if one fails
        continue;
      }
    }

    console.log('Day totals:', dayTotals);
    console.log('Day counts:', dayCounts);

    // Calculate total sales across all days
    const totalSales = Object.values(dayTotals).reduce((sum, val) => sum + val, 0);
    console.log('Total sales:', totalSales);

    // Calculate percentages
    const dailyDistribution = {};
    Object.keys(dayTotals).forEach(day => {
      dailyDistribution[day] = totalSales > 0 ? dayTotals[day] / totalSales : 0;
    });

    console.log('Initial daily distribution:', dailyDistribution);

    // Ensure percentages sum to 100
    const totalPercentage = Object.values(dailyDistribution).reduce((sum, val) => sum + val, 0);
    console.log('Initial total percentage:', totalPercentage);

    if (totalPercentage !== 100 && totalPercentage > 0) {
      // Add/subtract the difference from the day with the highest sales
      const highestDay = Object.entries(dayTotals)
        .reduce((a, b) => (a[1] > b[1] ? a : b))[0];
      dailyDistribution[highestDay] += (100 - totalPercentage) / 100;
      console.log('Adjusted daily distribution:', dailyDistribution);
    }

    // Send the response
    console.log('Sending response with daily distribution:', dailyDistribution);
    res.json({ dailyDistribution });
  } catch (error) {
    console.error('Error analyzing sales data:', error);
    res.status(500).json({ error: 'Failed to analyze sales data' });
  }
});

// Test direct MongoDB connection first
async function testMongoConnection() {
  console.log('Testing direct MongoDB connection...');
  const client = new MongoClient(mongoUri, {
    serverApi: {
      version: '1',
      strict: true,
      deprecationErrors: true,
    }
  });

  try {
    await client.connect();
    console.log('Direct MongoDB connection successful!');
    await client.db().command({ ping: 1 });
    console.log('Ping successful!');
    await client.close();
    return true;
  } catch (error) {
    console.error('Direct MongoDB connection test failed:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return false;
  }
}

// Connect to MongoDB and start server
testMongoConnection().then(success => {
  if (!success) {
    console.error('Failed to connect to MongoDB. Exiting...');
    process.exit(1);
  }

  mongoose.connect(mongoUri, {
    serverApi: {
      version: '1',
      strict: true,
      deprecationErrors: true,
    },
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000
  })
  .then(async () => {
    try {
      await mongoose.connection.db.command({ ping: 1 });
      console.log('Successfully connected to MongoDB!');
      console.log('Database name:', mongoose.connection.db.databaseName);
      console.log('Connection state:', mongoose.connection.readyState);
      
      app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
      });
    } catch (error) {
      console.error('Error during MongoDB connection verification:', error);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('MongoDB connection error details:', {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    process.exit(1);
  });
});
