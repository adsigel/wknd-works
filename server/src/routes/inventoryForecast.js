import express from 'express';
import { 
  getForecast,
  refreshForecast,
  updateForecastConfig,
  updateInventoryForecast
} from '../services/inventoryForecastService.js';
import { createErrorResponse, createValidationError } from '../utils/errorUtils.js';
import { logError } from '../utils/loggingUtils.js';

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
        leadTimeWeeks: forecast.configuration.leadTimeWeeks
      },
      weeklyProjections: forecast.weeklyProjections.map(week => ({
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        projectedSales: week.projectedSales,
        endingRetailValue: week.endingRetailValue,
        endingDiscountedValue: week.endingDiscountedValue,
        isBelowThreshold: week.isBelowThreshold
      }))
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

export default router; 