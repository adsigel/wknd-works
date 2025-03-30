import { 
  createUTCDate, 
  formatUTCDate,
  getFirstDayOfMonth,
  getLastDayOfMonth
} from '../utils/dateUtils.js';
import { 
  AppError, 
  createErrorResponse,
  createValidationError 
} from '../utils/errorUtils.js';
import { 
  logError, 
  logInfo, 
  logDebug 
} from '../utils/loggingUtils.js';
import InventoryForecast from '../models/InventoryForecast.js';
import Inventory from '../models/Inventory.js';
import SalesGoal from '../models/SalesGoal.js';

const DAYS_IN_WEEK = 7;

/**
 * Calculate daily sales distribution based on monthly goal
 * @param {number} monthlyGoal - The monthly sales goal
 * @param {Date} startDate - The start date of the month
 * @returns {Array<number>} Array of daily sales goals
 */
function calculateDailySales(monthlyGoal, startDate) {
  const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
  const dailyGoal = monthlyGoal / daysInMonth;
  
  // Create array of daily goals
  const dailyGoals = new Array(daysInMonth).fill(dailyGoal);
  
  // Adjust for day of week patterns
  for (let i = 0; i < daysInMonth; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dayOfWeek = date.getDay();
    
    // Adjust daily goal based on day of week
    // Weekend days (0=Sunday, 6=Saturday) typically have higher sales
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      dailyGoals[i] *= 1.5; // 50% higher on weekends
    }
    // Mid-week (Tue-Thu) typically has moderate sales
    else if (dayOfWeek >= 2 && dayOfWeek <= 4) {
      dailyGoals[i] *= 1.2; // 20% higher mid-week
    }
    // Monday and Friday typically have slightly lower sales
    else {
      dailyGoals[i] *= 0.9; // 10% lower on Monday and Friday
    }
  }
  
  return dailyGoals;
}

/**
 * Get sales goals for a date range
 * @param {Date} startDate - Start date
 * @param {number} weeks - Number of weeks to forecast
 * @returns {Promise<Array<number>>} Array of weekly sales goals
 */
async function getWeeklySalesGoals(startDate, weeks) {
  const weeklyGoals = [];
  let currentDate = new Date(startDate);
  
  for (let i = 0; i < weeks; i++) {
    // Calculate week start and end dates
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    // Get sales goals for both months if the week spans months
    const startMonth = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
    const endMonth = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), 1);
    
    // Get sales goals for both months
    const [startMonthGoal, endMonthGoal] = await Promise.all([
      SalesGoal.findOne({ date: startMonth }),
      startMonth.getTime() !== endMonth.getTime() ? SalesGoal.findOne({ date: endMonth }) : null
    ]);
    
    if (!startMonthGoal || (startMonth.getTime() !== endMonth.getTime() && !endMonthGoal)) {
      throw new AppError(`Missing sales goal for ${startMonth.toISOString()} or ${endMonth.toISOString()}`, 400);
    }
    
    // Calculate daily sales for both months
    const startMonthDailySales = calculateDailySales(startMonthGoal.goal, startMonth);
    const endMonthDailySales = startMonth.getTime() !== endMonth.getTime() 
      ? calculateDailySales(endMonthGoal.goal, endMonth)
      : null;
    
    // Calculate which days in each month are part of this week
    const startMonthDays = startMonth.getTime() === endMonth.getTime() 
      ? weekEnd.getDate() - weekStart.getDate() + 1
      : new Date(startMonth.getFullYear(), startMonth.getMonth() + 1, 0).getDate() - weekStart.getDate() + 1;
    
    const endMonthDays = startMonth.getTime() === endMonth.getTime() 
      ? 0
      : weekEnd.getDate();
    
    // Sum up the daily sales for this week
    let weekTotal = 0;
    
    // Add sales from start month
    weekTotal += startMonthDailySales
      .slice(weekStart.getDate() - 1, weekStart.getDate() - 1 + startMonthDays)
      .reduce((sum, goal) => sum + goal, 0);
    
    // Add sales from end month if week spans months
    if (endMonthDailySales) {
      weekTotal += endMonthDailySales
        .slice(0, endMonthDays)
        .reduce((sum, goal) => sum + goal, 0);
    }
    
    weeklyGoals.push(weekTotal);
    
    // Move to next week
    currentDate.setDate(currentDate.getDate() + DAYS_IN_WEEK);
  }
  
  return weeklyGoals;
}

/**
 * Calculate aggregate inventory values
 * @param {Array<Object>} inventoryItems - Array of inventory items
 * @returns {Object} Aggregate inventory values
 */
function calculateAggregateValues(inventoryItems) {
  return inventoryItems.reduce((acc, item) => {
    const retailValue = item.currentStock * item.retailPrice;
    const discountedValue = retailValue * item.discountFactor;
    
    return {
      totalInventoryCost: acc.totalInventoryCost + (item.currentStock * item.costPrice),
      totalRetailValue: acc.totalRetailValue + retailValue,
      totalDiscountedValue: acc.totalDiscountedValue + discountedValue
    };
  }, { totalInventoryCost: 0, totalRetailValue: 0, totalDiscountedValue: 0 });
}

/**
 * Generate weekly projections for aggregate inventory
 * @param {Date} startDate - Start date for projections
 * @param {number} forecastPeriodWeeks - Number of weeks to forecast
 * @param {Array<number>} weeklySales - Array of weekly sales projections
 * @param {Object} aggregateValues - Current aggregate inventory values
 * @returns {Array<Object>} Array of weekly projections
 */
function generateWeeklyProjections(
  startDate,
  forecastPeriodWeeks,
  weeklySales,
  aggregateValues
) {
  const projections = [];
  let currentRetailValue = aggregateValues.totalRetailValue;
  let currentDiscountedValue = aggregateValues.totalDiscountedValue;
  let currentCost = aggregateValues.totalInventoryCost;

  // If we have no inventory data, return empty projections
  if (!currentRetailValue || !currentDiscountedValue || !currentCost) {
    logInfo('No inventory data available for projections');
    return [];
  }

  for (let i = 0; i < forecastPeriodWeeks; i++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (i * 7));
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Calculate weekly sales (default to 0 if not provided)
    const weeklySalesAmount = weeklySales[i] || 0;

    // Calculate ending values
    const endingRetailValue = Math.max(0, currentRetailValue - weeklySalesAmount);
    const endingDiscountedValue = Math.max(0, currentDiscountedValue - weeklySalesAmount);
    const endingCost = Math.max(0, currentCost - (weeklySalesAmount * (currentCost / currentRetailValue)));

    // Check if inventory is below threshold
    const isBelowThreshold = endingRetailValue < (weeklySalesAmount * 6); // 6 weeks buffer

    // Update current values for next week
    currentRetailValue = endingRetailValue;
    currentDiscountedValue = endingDiscountedValue;
    currentCost = endingCost;

    projections.push({
      weekStart: formatUTCDate(weekStart),
      weekEnd: formatUTCDate(weekEnd),
      projectedSales: weeklySalesAmount,
      endingRetailValue,
      endingDiscountedValue,
      endingCost,
      isBelowThreshold
    });
  }

  return projections;
}

/**
 * Update forecast for aggregate inventory
 * @param {Date} startDate - Start date for projections
 * @param {number} forecastPeriodWeeks - Number of weeks to forecast
 * @returns {Promise<Object>} Updated forecast
 */
export async function updateInventoryForecast(startDate, forecastPeriodWeeks = 12) {
  try {
    // Get all inventory items
    const inventoryItems = await Inventory.find();
    
    // Calculate aggregate values
    const aggregateValues = calculateAggregateValues(inventoryItems);
    
    // Get weekly sales goals for the forecast period
    const weeklySales = await getWeeklySalesGoals(startDate, forecastPeriodWeeks);
    
    // Generate projections
    const weeklyProjections = generateWeeklyProjections(
      startDate,
      forecastPeriodWeeks,
      weeklySales,
      aggregateValues
    );
    
    // Update or create forecast
    let forecast = await InventoryForecast.findOne();
    
    if (!forecast) {
      forecast = new InventoryForecast({
        totalInventoryCost: aggregateValues.totalInventoryCost,
        totalRetailValue: aggregateValues.totalRetailValue,
        totalDiscountedValue: aggregateValues.totalDiscountedValue,
        lastShopifyUpdate: new Date(),
        weeklyProjections,
        forecastPeriodWeeks
      });
    } else {
      forecast.totalInventoryCost = aggregateValues.totalInventoryCost;
      forecast.totalRetailValue = aggregateValues.totalRetailValue;
      forecast.totalDiscountedValue = aggregateValues.totalDiscountedValue;
      forecast.lastShopifyUpdate = new Date();
      forecast.weeklyProjections = weeklyProjections;
      forecast.forecastPeriodWeeks = forecastPeriodWeeks;
    }
    
    await forecast.save();
    return forecast;
  } catch (error) {
    logError('Error updating inventory forecast', error);
    throw error;
  }
}

/**
 * Refresh forecast data from Shopify
 * @param {number} forecastPeriodWeeks - Number of weeks to forecast
 * @returns {Promise<Object>} Result of the refresh operation
 */
export async function refreshForecast(forecastPeriodWeeks = 12) {
  try {
    const startDate = new Date();
    await updateInventoryForecast(startDate, forecastPeriodWeeks);
    return { message: 'Forecast refreshed successfully' };
  } catch (error) {
    logError('Error refreshing forecast', error);
    throw error;
  }
}

/**
 * Get current forecast
 * @returns {Promise<Object>} The forecast
 */
export async function getForecast() {
  try {
    const forecast = await InventoryForecast.findOne();
    
    if (!forecast) {
      throw new AppError('No forecast found', 404);
    }
    
    return forecast;
  } catch (error) {
    logError('Error getting forecast', error);
    throw error;
  }
}

/**
 * Update forecast configuration
 * @param {Object} config - Configuration updates
 * @returns {Promise<Object>} Updated forecast
 */
export async function updateForecastConfig(config) {
  try {
    const { forecastPeriodWeeks, minimumWeeksBuffer, leadTimeWeeks } = config;
    
    if (forecastPeriodWeeks && (forecastPeriodWeeks < 1)) {
      throw new AppError('Forecast period weeks must be at least 1', 400);
    }
    
    if (minimumWeeksBuffer && (minimumWeeksBuffer < 1)) {
      throw new AppError('Minimum weeks buffer must be at least 1', 400);
    }
    
    if (leadTimeWeeks && (leadTimeWeeks < 1)) {
      throw new AppError('Lead time weeks must be at least 1', 400);
    }
    
    const forecast = await getForecast();
    
    if (forecastPeriodWeeks) forecast.forecastPeriodWeeks = forecastPeriodWeeks;
    if (minimumWeeksBuffer) forecast.minimumWeeksBuffer = minimumWeeksBuffer;
    if (leadTimeWeeks) forecast.leadTimeWeeks = leadTimeWeeks;
    
    await forecast.save();
    return forecast;
  } catch (error) {
    logError('Error updating forecast config', error);
    throw error;
  }
} 