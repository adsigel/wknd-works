import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';
import salesRoutes from './routes/sales.js';
import settingsRoutes from './routes/settings.js';
import inventoryRoutes from './routes/inventory.js';
import inventoryForecastRoutes from './routes/inventoryForecast.js';
import mongoose from 'mongoose';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logInfo, logError } from './utils/loggingUtils.js';
import Inventory from './models/Inventory.js';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceDir = path.dirname(path.dirname(__dirname));

// Load environment variables
dotenv.config({ path: path.join(workspaceDir, '.env') });
logInfo('Loading environment variables from: ' + path.join(workspaceDir, '.env'));

const testInventory = [
  {
    productId: 'prod_1',
    shopifyProductId: 'shopify_1',
    variant: {
      id: 'var_1',
      title: '3-4T',
      sku: 'NS-TD-3T'
    },
    name: 'Norsu Toddler Fleece Collar Sweatshirt Dress in Twig - 3-4T',
    category: 'Toddler',
    currentStock: 10,
    costPrice: 750,
    retailPrice: 1500,
    discountFactor: 1.0,
    shrinkageFactor: 0.98,
    lastUpdated: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    lastReceivedDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    historicalMovement: [],
    averageDailySales: 0.5
  },
  {
    productId: 'prod_2',
    shopifyProductId: 'shopify_2',
    variant: {
      id: 'var_2',
      title: '5-6T',
      sku: 'NS-TD-5T'
    },
    name: 'Norsu Toddler Fleece Collar Sweatshirt Dress in Twig - 5-6T',
    category: 'Toddler',
    currentStock: 5,
    costPrice: 750,
    retailPrice: 1500,
    discountFactor: 0.8,
    shrinkageFactor: 0.98,
    lastUpdated: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
    lastReceivedDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
    historicalMovement: [],
    averageDailySales: 0.3
  },
  {
    productId: 'prod_3',
    shopifyProductId: 'shopify_3',
    variant: {
      id: 'var_3',
      title: '7-8T',
      sku: 'NS-TD-7T'
    },
    name: 'Norsu Toddler Fleece Collar Sweatshirt Dress in Twig - 7-8T',
    category: 'Toddler',
    currentStock: 3,
    costPrice: 750,
    retailPrice: 1500,
    discountFactor: 0.6,
    shrinkageFactor: 0.98,
    lastUpdated: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000), // 95 days ago
    lastReceivedDate: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000), // 95 days ago
    historicalMovement: [],
    averageDailySales: 0.1
  }
];

async function checkAndSeedTestData() {
  try {
    const count = await Inventory.countDocuments();
    if (count === 0) {
      logInfo('No inventory items found. Seeding test data...');
      await Inventory.insertMany(testInventory);
      logInfo(`Seeded ${testInventory.length} test inventory items`);
      
      // Log the total inventory value
      const totalCost = testInventory.reduce((sum, item) => sum + (item.costPrice * item.currentStock), 0);
      const totalRetail = testInventory.reduce((sum, item) => sum + (item.retailPrice * item.currentStock), 0);
      logInfo(`Total inventory cost: $${totalCost}`);
      logInfo(`Total retail value: $${totalRetail}`);
    } else {
      logInfo(`Found ${count} existing inventory items. Skipping test data seeding.`);
    }
  } catch (error) {
    logError('Error checking/seeding test data:', error);
  }
}

const app = express();
const port = process.env.PORT || 5001;

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(limiter);

// Add request logging middleware
app.use(requestLogger);

// API Routes
app.use('/api/sales', salesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/inventory-forecast', inventoryForecastRoutes);

// Serve static files from React build directory
const clientBuildPath = path.join(workspaceDir, 'client', 'build');
console.log('Serving static files from:', clientBuildPath);
app.use(express.static(clientBuildPath));

// Handle client-side routing
app.get('*', (req, res) => {
  // Don't redirect API routes
  if (!req.url.startsWith('/api')) {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully');
    console.log('MongoDB URI:', process.env.MONGODB_URI);
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// Add mongoose connection event handlers
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});

// Add error handling middleware (must be last)
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await connectDatabase();
    await checkAndSeedTestData();
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 