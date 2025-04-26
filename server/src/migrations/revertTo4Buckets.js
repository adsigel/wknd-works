import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import InventoryForecast from '../models/InventoryForecast.js';

const MONGODB_URI = 'mongodb+srv://wknd_admin:wkndadmin123@wknd-works.xg6ps.mongodb.net/wknd-dashboard?retryWrites=true&w=majority&appName=wknd-works';

const FOUR_BUCKET_STRUCTURE = {
  discountSettings: {
    '0-30': 0,
    '31-60': 5,
    '61-90': 10,
    '90+': 15
  },
  salesDistribution: {
    '0-30': 25,
    '31-60': 25,
    '61-90': 25,
    '90+': 25
  }
};

async function connectToDatabase() {
  try {
    console.log('Connecting to production database...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000
    });
    console.log('Successfully connected to production database');
    
    // Log available collections to debug
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log('Available collections:', collectionNames);
    
    // Check if our collection exists
    if (!collectionNames.includes('inventoryforecasts')) {
      console.log('inventoryforecasts collection does not exist, will be created automatically');
    } else {
      // If it exists, let's see what's in it
      const count = await mongoose.connection.db.collection('inventoryforecasts').countDocuments();
      console.log(`Found ${count} documents in inventoryforecasts collection`);
      
      if (count > 0) {
        const sample = await mongoose.connection.db.collection('inventoryforecasts').findOne();
        console.log('Sample document:', JSON.stringify(sample, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Failed to connect to production database:', error);
    throw error;
  }
}

async function revertForecastData() {
  try {
    await connectToDatabase();
    console.log('Starting reversion to 4-bucket structure...');

    // Get the current forecast document
    const currentForecast = await InventoryForecast.findOne();
    
    if (!currentForecast) {
      console.log('No existing forecast found. Creating new forecast with 4-bucket structure...');
      const newForecast = new InventoryForecast({
        currentState: {
          totalInventoryCost: 0,
          totalRetailValue: 0,
          totalDiscountedValue: 0,
          lastUpdated: new Date()
        },
        configuration: {
          forecastPeriodWeeks: 12,
          minimumWeeksBuffer: 6,
          leadTimeWeeks: 2,
          ...FOUR_BUCKET_STRUCTURE
        },
        weeklyProjections: [],
        inventoryData: []
      });
      await newForecast.save();
      console.log('Created new forecast with 4-bucket structure');
      return;
    }

    console.log('Found existing forecast. Reverting to 4-bucket structure...');
    
    // Store original values for logging
    const originalConfig = JSON.parse(JSON.stringify(currentForecast.configuration));
    console.log('Current configuration:', JSON.stringify(originalConfig, null, 2));

    // Revert to 4-bucket structure
    currentForecast.configuration.discountSettings = FOUR_BUCKET_STRUCTURE.discountSettings;
    currentForecast.configuration.salesDistribution = FOUR_BUCKET_STRUCTURE.salesDistribution;
    
    console.log('Updated configuration to 4-bucket structure:', {
      salesDistribution: currentForecast.configuration.salesDistribution,
      discountSettings: currentForecast.configuration.discountSettings
    });

    // Save the updated forecast
    await currentForecast.save();

    console.log('Reversion completed successfully');

  } catch (error) {
    console.error('Error during reversion:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

// Run the reversion
revertForecastData(); 