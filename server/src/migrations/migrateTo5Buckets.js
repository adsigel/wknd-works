import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import InventoryForecast from '../models/InventoryForecast.js';
import { logInfo, logError, logDebug } from '../utils/loggingUtils.js';

const NEW_BUCKET_STRUCTURE = {
  discountSettings: {
    '0-30': 0,
    '31-60': 0,
    '61-90': 0,
    '91-180': 40,
    '180+': 50
  },
  salesDistribution: {
    '0-30': 20,
    '31-60': 20,
    '61-90': 20,
    '91-180': 20,
    '180+': 20
  }
};

async function migrateForecastData() {
  try {
    logInfo('Starting migration to 5-bucket structure...');

    // Get the current forecast document
    const currentForecast = await InventoryForecast.findOne();
    
    if (!currentForecast) {
      logInfo('No existing forecast found. Creating new forecast with 5-bucket structure...');
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
          ...NEW_BUCKET_STRUCTURE
        },
        weeklyProjections: [],
        inventoryData: []
      });
      await newForecast.save();
      logInfo('Created new forecast with 5-bucket structure');
      return;
    }

    logInfo('Found existing forecast. Migrating to 5-bucket structure...');
    
    // Store original values for logging
    const originalConfig = JSON.parse(JSON.stringify(currentForecast.configuration));

    // Migrate discount settings
    if (currentForecast.configuration.discountSettings['90+']) {
      const oldDiscount = currentForecast.configuration.discountSettings['90+'];
      currentForecast.configuration.discountSettings['91-180'] = 40;
      currentForecast.configuration.discountSettings['180+'] = 50;
      delete currentForecast.configuration.discountSettings['90+'];
      
      logDebug('Migrated discount settings', {
        old: { '90+': oldDiscount },
        new: {
          '91-180': currentForecast.configuration.discountSettings['91-180'],
          '180+': currentForecast.configuration.discountSettings['180+']
        }
      });
    }

    // Migrate sales distribution
    // Force replace the entire sales distribution with the new structure
    currentForecast.configuration.salesDistribution = {
      '0-30': 40,
      '31-60': 10,
      '61-90': 25,
      '91-180': 15,
      '180+': 10
    };
    
    // Force replace the entire discount settings with the new structure
    currentForecast.configuration.discountSettings = {
      '0-30': 0,
      '31-60': 10,
      '61-90': 20,
      '91-180': 40,
      '180+': 70
    };
    
    logDebug('Updated configuration to new structure', {
      salesDistribution: currentForecast.configuration.salesDistribution,
      discountSettings: currentForecast.configuration.discountSettings
    });

    // Save the updated forecast
    await currentForecast.save();

    logInfo('Migration completed successfully', {
      originalConfig,
      newConfig: currentForecast.configuration
    });

  } catch (error) {
    logError('Error during migration:', error);
    throw error;
  }
}

export async function runMigration() {
  try {
    // Connect to MongoDB
    const mongoURI = 'mongodb://localhost:27017/wknd-dashboard';
    logInfo('Connecting to MongoDB...');
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logInfo('Connected to MongoDB successfully');

    await migrateForecastData();
    logInfo('Migration completed successfully');
    
    // Close the connection
    await mongoose.connection.close();
  } catch (error) {
    logError('Migration failed:', error);
    throw error;
  }
}

// Allow running directly or as import
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default runMigration; 