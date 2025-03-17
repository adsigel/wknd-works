import express from 'express';
import { calculateCumulativeSales } from './fetch_orders.js'; // Import the function from fetch_orders.js
import dotenv from 'dotenv';
import cors from 'cors';
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

// Store the sales goal in memory (you might want to persist this in a database later)
let currentSalesGoal = 10000;

// API endpoint to get sales data
app.get('/api/sales/:month', async (req, res) => {
    console.log('Sales endpoint hit with params:', req.params);
    try {
      const month = parseInt(req.params.month) || new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      console.log(`Fetching data for ${year}-${month}`);
      console.log('Environment variables:', {
        SHOPIFY_SHOP_NAME: process.env.SHOPIFY_SHOP_NAME ? 'Set' : 'Not set',
        SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN ? 'Set' : 'Not set'
      });
      const salesData = await calculateCumulativeSales(year, month, currentSalesGoal);
      const response = {
        dailySales: salesData.map(d => d.dailySales),
        dates: salesData.map(d => d.date),
        salesGoal: currentSalesGoal,
        projectedSales: salesData.map(d => d.cumulativeProjectedDailySales)
      };
      console.log('Sending response:', response);
      res.json(response);
    } catch (error) {
      console.error('Error fetching sales data:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      res.status(500).json({ 
        error: 'Failed to retrieve sales data',
        details: error.message,
        response: error.response?.data
      });
    }
  });

// API endpoint to update sales goal
app.post('/api/sales/goal', async (req, res) => {
    try {
      console.log('Received goal update request:', req.body);
      const { goal } = req.body;
      console.log('Parsed goal value:', goal);
      
      if (typeof goal !== 'number' || isNaN(goal)) {
        console.log('Invalid goal value received:', goal);
        return res.status(400).json({ error: 'Invalid sales goal' });
      }
      
      currentSalesGoal = goal;
      console.log('Updated sales goal to:', currentSalesGoal);
      res.json({ success: true, newGoal: currentSalesGoal });
    } catch (error) {
      console.error('Error updating sales goal:', error);
      res.status(500).json({ error: 'Failed to update sales goal' });
    }
  });

// API endpoint to get current sales goal
app.get('/api/sales/goal', (req, res) => {
    res.json({ goal: currentSalesGoal });
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

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
