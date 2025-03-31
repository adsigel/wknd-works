import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Inventory from '../models/Inventory.js';
import { logInfo } from '../utils/loggingUtils.js';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceDir = path.dirname(path.dirname(path.dirname(__dirname)));

// Load environment variables
dotenv.config({ path: path.join(workspaceDir, '.env') });

const testInventory = [
  {
    productId: 'TEST-001',
    shopifyProductId: '123456789',
    variant: {
      id: '987654321',
      title: 'Default',
      sku: 'TEST-001'
    },
    name: 'Test Product 1',
    category: 'Test Category',
    currentStock: 100,
    costPrice: 50,
    retailPrice: 100,
    discountFactor: 1.0,
    shrinkageFactor: 0.98,
    lastUpdated: new Date(),
    historicalMovement: [
      {
        date: new Date(),
        quantity: -5,
        type: 'sale',
        price: 100
      }
    ],
    averageDailySales: 5,
    lastReceivedDate: new Date()
  },
  {
    productId: 'TEST-002',
    shopifyProductId: '123456790',
    variant: {
      id: '987654322',
      title: 'Default',
      sku: 'TEST-002'
    },
    name: 'Test Product 2',
    category: 'Test Category',
    currentStock: 75,
    costPrice: 30,
    retailPrice: 60,
    discountFactor: 0.9,
    shrinkageFactor: 0.98,
    lastUpdated: new Date(),
    historicalMovement: [
      {
        date: new Date(),
        quantity: -3,
        type: 'sale',
        price: 60
      }
    ],
    averageDailySales: 3,
    lastReceivedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
  },
  {
    productId: 'TEST-003',
    shopifyProductId: '123456791',
    variant: {
      id: '987654323',
      title: 'Default',
      sku: 'TEST-003'
    },
    name: 'Test Product 3',
    category: 'Test Category',
    currentStock: 50,
    costPrice: 20,
    retailPrice: 40,
    discountFactor: 0.8,
    shrinkageFactor: 0.98,
    lastUpdated: new Date(),
    historicalMovement: [
      {
        date: new Date(),
        quantity: -2,
        type: 'sale',
        price: 40
      }
    ],
    averageDailySales: 2,
    lastReceivedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
  }
];

async function seedTestData() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-manager';
    await mongoose.connect(mongoUri);
    logInfo('Connected to MongoDB', { context: 'seed' });

    // Clear existing inventory data
    await Inventory.deleteMany({});
    logInfo('Cleared existing inventory data', { context: 'seed' });

    // Insert test data
    const result = await Inventory.insertMany(testInventory);
    logInfo(`Inserted ${result.length} test inventory items`, { context: 'seed' });

    // Log the total inventory value
    const totalCost = result.reduce((sum, item) => sum + (item.costPrice * item.currentStock), 0);
    const totalRetail = result.reduce((sum, item) => sum + (item.retailPrice * item.currentStock), 0);
    logInfo(`Total inventory cost: $${totalCost}`, { context: 'seed' });
    logInfo(`Total retail value: $${totalRetail}`, { context: 'seed' });

    // Disconnect from MongoDB
    await mongoose.disconnect();
    logInfo('Disconnected from MongoDB', { context: 'seed' });

    process.exit(0);
  } catch (error) {
    logInfo('Error seeding test data', { 
      context: 'seed',
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

seedTestData(); 