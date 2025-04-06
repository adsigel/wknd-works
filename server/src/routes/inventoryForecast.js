import express from 'express';
import { 
  getForecast,
  refreshForecast,
  updateForecastConfig,
  updateInventoryForecast
} from '../services/inventoryForecastService.js';
import { createErrorResponse, createValidationError } from '../utils/errorUtils.js';
import { logError } from '../utils/loggingUtils.js';
import InventoryForecast from '../models/InventoryForecast.js';

const router = express.Router();

// Get current forecast
router.get('/', async (req, res) => {
  try {
    const forecast = await getForecast();
    res.json(forecast);
  } catch (error) {
    logError('Error getting forecast', error);
    if (error.statusCode === 404) {
      res.status(404).json(createErrorResponse(error));
    } else {
      res.status(500).json(createErrorResponse(error));
    }
  }
});

// Test endpoint to generate forecast
router.post('/test', async (req, res) => {
  try {
    // First refresh inventory data
    await refreshForecast(12);
    
    // Get the forecast
    const forecast = await getForecast();
    
    // Format the response for easier reading
    const formattedForecast = {
      currentState: {
        totalInventoryCost: forecast.currentState.totalInventoryCost,
        totalRetailValue: forecast.currentState.totalRetailValue,
        totalDiscountedValue: forecast.currentState.totalDiscountedValue,
        lastUpdated: forecast.currentState.lastUpdated
      },
      configuration: {
        forecastPeriodWeeks: forecast.configuration.forecastPeriodWeeks,
        minimumWeeksBuffer: forecast.configuration.minimumWeeksBuffer,
        leadTimeWeeks: forecast.configuration.leadTimeWeeks,
        discountSettings: forecast.configuration.discountSettings,
        salesDistribution: forecast.configuration.salesDistribution
      },
      weeklyProjections: forecast.weeklyProjections.map(week => ({
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        projectedSales: week.projectedSales,
        endingRetailValue: week.endingRetailValue,
        endingDiscountedValue: week.endingDiscountedValue,
        isBelowThreshold: week.isBelowThreshold
      })),
      inventoryData: forecast.inventoryData
    };
    
    res.json(formattedForecast);
  } catch (error) {
    logError('Error generating test forecast', error);
    res.status(500).json(createErrorResponse(error));
  }
});

// Manually refresh forecast data from Shopify
router.post('/refresh', async (req, res) => {
  try {
    const { forecastPeriodWeeks } = req.body;
    const result = await refreshForecast(forecastPeriodWeeks);
    res.json(result);
  } catch (error) {
    logError('Error refreshing forecast', error);
    res.status(500).json(createErrorResponse(error));
  }
});

// Update forecast configuration
router.patch('/config', async (req, res) => {
  try {
    const forecast = await updateForecastConfig(req.body);
    res.json(forecast);
  } catch (error) {
    logError('Error updating forecast config', error);
    if (error.statusCode === 400) {
      res.status(400).json(createValidationError(error.message));
    } else if (error.statusCode === 404) {
      res.status(404).json(createErrorResponse(error));
    } else {
      res.status(500).json(createErrorResponse(error));
    }
  }
});

// Update discount settings
router.post('/discount-settings', async (req, res) => {
  try {
    const { discountSettings, salesDistribution } = req.body;
    
    // Validate discount settings
    if (!discountSettings || typeof discountSettings !== 'object') {
      return res.status(400).json({ error: 'Invalid discount settings format' });
    }

    // Validate sales distribution
    if (!salesDistribution || typeof salesDistribution !== 'object') {
      return res.status(400).json({ error: 'Invalid sales distribution format' });
    }

    const requiredRanges = ['0-30', '31-60', '61-90', '90+'];
    
    // Validate discount settings ranges
    for (const range of requiredRanges) {
      const value = discountSettings[range];
      if (typeof value !== 'number' || value < 0 || value > 100) {
        return res.status(400).json({ 
          error: `Invalid discount value for range ${range}. Must be a number between 0 and 100` 
        });
      }
    }

    // Validate sales distribution ranges
    for (const range of requiredRanges) {
      const value = salesDistribution[range];
      if (typeof value !== 'number' || value < 0 || value > 100) {
        return res.status(400).json({ 
          error: `Invalid sales distribution value for range ${range}. Must be a number between 0 and 100` 
        });
      }
    }

    // Validate sales distribution total equals 100%
    const totalDistribution = Object.values(salesDistribution).reduce((sum, value) => sum + value, 0);
    if (Math.abs(totalDistribution - 100) > 0.01) { // Allow for small floating point differences
      return res.status(400).json({
        error: 'Sales distribution must total 100%'
      });
    }

    // Find the current forecast
    let forecast = await InventoryForecast.findOne();
    if (!forecast) {
      forecast = new InventoryForecast();
    }

    // Update settings
    forecast.configuration.discountSettings = discountSettings;
    forecast.configuration.salesDistribution = salesDistribution;
    await forecast.save();

    // Recalculate forecast with new settings
    await updateInventoryForecast(new Date());

    // Get updated forecast
    forecast = await InventoryForecast.findOne();
    res.json(forecast);
  } catch (error) {
    logError('Error updating discount settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update restock settings
router.post('/restock-settings', async (req, res) => {
  try {
    const { minimumWeeksBuffer } = req.body;
    
    // Validate minimum weeks buffer
    if (typeof minimumWeeksBuffer !== 'number' || minimumWeeksBuffer < 1 || minimumWeeksBuffer > 52) {
      return res.status(400).json({ 
        error: 'Minimum weeks buffer must be a number between 1 and 52' 
      });
    }

    // Find the current forecast
    let forecast = await InventoryForecast.findOne();
    if (!forecast) {
      forecast = new InventoryForecast();
    }

    // Update settings
    forecast.configuration.minimumWeeksBuffer = minimumWeeksBuffer;
    await forecast.save();

    // Recalculate forecast with new settings
    await updateInventoryForecast(new Date());

    // Get updated forecast
    forecast = await InventoryForecast.findOne();
    res.json(forecast);
  } catch (error) {
    logError('Error updating restock settings:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 