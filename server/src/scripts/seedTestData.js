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
    discountFactor: 0.8, // 20% discount
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
    discountFactor: 0.6, // 40% discount
    shrinkageFactor: 0.98,
    lastUpdated: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000), // 95 days ago
    lastReceivedDate: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000), // 95 days ago
    historicalMovement: [],
    averageDailySales: 0.1
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