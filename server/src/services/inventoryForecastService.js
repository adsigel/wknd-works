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
  const DEFAULT_GOAL = 8500;
  
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
    
    // Use default goal if not found
    const startGoal = startMonthGoal?.goal || DEFAULT_GOAL;
    const endGoal = endMonthGoal?.goal || DEFAULT_GOAL;
    
    logDebug('Sales goals:', {
      startMonth: startMonth.toISOString(),
      endMonth: endMonth.toISOString(),
      startGoal,
      endGoal,
      isSpanningMonths: startMonth.getTime() !== endMonth.getTime()
    });
    
    // Calculate daily sales for both months
    const startMonthDailySales = calculateDailySales(startGoal, startMonth);
    const endMonthDailySales = startMonth.getTime() !== endMonth.getTime() 
      ? calculateDailySales(endGoal, endMonth)
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
  logDebug('Calculating aggregates for items:', 
    inventoryItems.map(item => ({
      id: item._id,
      stock: item.currentStock,
      retail: item.retailPrice,
      discount: item.discountFactor
    }))
  );

  const aggregates = inventoryItems.reduce((acc, item) => {
    // Ensure all values are numbers and have defaults
    const currentStock = Number(item.currentStock) || 0;
    const retailPrice = Number(item.retailPrice) || 0;
    const costPrice = Number(item.costPrice) || 0;
    const discountFactor = Number(item.discountFactor) || 1;
    
    const retailValue = currentStock * retailPrice;
    const discountedValue = retailValue * discountFactor;
    
    logDebug(`Item calculation:`, {
      id: item._id,
      currentStock,
      retailPrice,
      costPrice,
      discountFactor,
      retailValue,
      discountedValue
    });
    
    return {
      totalInventoryCost: acc.totalInventoryCost + (currentStock * costPrice),
      totalRetailValue: acc.totalRetailValue + retailValue,
      totalDiscountedValue: acc.totalDiscountedValue + discountedValue
    };
  }, { totalInventoryCost: 0, totalRetailValue: 0, totalDiscountedValue: 0 });

  logDebug('Final aggregate values:', aggregates);
  return aggregates;
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

    // Calculate ending retail value
    const endingRetailValue = Math.max(0, currentRetailValue - weeklySalesAmount);
    
    // Calculate ending discounted value using the progressive discount
    const endingDiscountedValue = calculateDiscountedValue(endingRetailValue, weekStart);

    // Calculate ending cost proportionally
    const endingCost = Math.max(0, currentCost * (endingRetailValue / currentRetailValue));

    // Check if inventory is below threshold using discounted value
    const minimumBuffer = weeklySalesAmount * 6; // 6 weeks buffer
    const isBelowThreshold = endingDiscountedValue < minimumBuffer;

    // Update current values for next week
    currentRetailValue = endingRetailValue;
    currentDiscountedValue = endingDiscountedValue;
    currentCost = endingCost;

    projections.push({
      weekStart: weekStart,
      weekEnd: weekEnd,
      projectedSales: weeklySalesAmount,
      endingRetailValue,
      endingDiscountedValue,
      endingCost,
      isBelowThreshold,
      minimumBuffer // Add this for debugging
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
  const MAX_RETRIES = 3;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      // Get all inventory items
      const inventoryItems = await Inventory.find();
      
      logDebug('Initial inventory items:', 
        inventoryItems.map(item => ({
          id: item._id,
          name: item.name,
          stock: item.currentStock,
          retail: item.retailPrice,
          cost: item.costPrice,
          date: item.lastReceivedDate
        }))
      );

      // Filter and transform inventory items
      const validInventoryItems = inventoryItems
        .map(item => ({
          ...item.toObject(),
          currentStock: Number(item.currentStock) || 0,
          retailPrice: Number(item.retailPrice) || 0,
          costPrice: Number(item.costPrice) || 0,
          discountFactor: 1, // Default discount factor
          lastReceivedDate: item.lastReceivedDate || item._id.getTimestamp()
        }))
        .filter(item => item.currentStock > 0 && item.retailPrice > 0);

      logDebug('Valid inventory items:', validInventoryItems);

      if (validInventoryItems.length === 0) {
        throw new Error('No valid inventory items found with stock and prices');
      }

      // Calculate aggregate values
      const aggregateValues = {
        totalInventoryCost: validInventoryItems.reduce((sum, item) => sum + (item.currentStock * item.costPrice), 0),
        totalRetailValue: validInventoryItems.reduce((sum, item) => sum + (item.currentStock * item.retailPrice), 0),
        totalDiscountedValue: validInventoryItems.reduce((sum, item) => {
          const retailValue = item.currentStock * item.retailPrice;
          return sum + calculateDiscountedValue(retailValue, new Date());
        }, 0)
      };

      logDebug('Aggregate values:', aggregateValues);

      // Get weekly sales goals and round to 2 decimal places
      const weeklySales = (await getWeeklySalesGoals(startDate, forecastPeriodWeeks))
        .map(amount => Math.round(amount * 100) / 100);

      logDebug('Weekly sales goals:', weeklySales);

      // Generate projections
      const weeklyProjections = generateWeeklyProjections(
        startDate,
        forecastPeriodWeeks,
        weeklySales,
        aggregateValues
      );

      // Process inventory items for age breakdown
      const inventoryData = validInventoryItems
        .map(item => {
          const lastReceived = new Date(item.lastReceivedDate || item._id.getTimestamp());
          const age = Math.max(0, Math.floor((new Date() - lastReceived) / (1000 * 60 * 60 * 24)));
          
          logDebug('Processing item for age breakdown:', {
            id: item._id,
            name: item.name,
            lastReceived: lastReceived.toISOString(),
            age,
            quantity: item.currentStock,
            retailPrice: item.retailPrice
          });

          return {
            id: item._id,
            name: item.name || 'Unnamed Item',
            quantity: item.currentStock,
            retailPrice: item.retailPrice,
            costPrice: item.costPrice,
            lastReceivedDate: lastReceived.toISOString(),
            age
          };
        })
        .filter(item => item.quantity > 0);

      logDebug('Processed inventory data:', {
        totalItems: inventoryData.length,
        sampleItem: inventoryData[0],
        ageDistribution: inventoryData.reduce((acc, item) => {
          const ageGroup = item.age <= 30 ? '0-30' :
                          item.age <= 60 ? '31-60' :
                          item.age <= 90 ? '61-90' :
                          item.age <= 120 ? '91-120' : '120+';
          acc[ageGroup] = (acc[ageGroup] || 0) + 1;
          return acc;
        }, {})
      });

      // Create forecast document
      const forecastData = {
        currentState: {
          totalInventoryCost: Math.round(aggregateValues.totalInventoryCost * 100) / 100,
          totalRetailValue: Math.round(aggregateValues.totalRetailValue * 100) / 100,
          totalDiscountedValue: Math.round(aggregateValues.totalDiscountedValue * 100) / 100,
          lastUpdated: new Date()
        },
        configuration: {
          forecastPeriodWeeks,
          minimumWeeksBuffer: 6,
          leadTimeWeeks: 2
        },
        weeklyProjections, // Use projections as is, don't recalculate discounted values
        inventoryData
      };

      logDebug('Final forecast data:', forecastData);

      // Use findOneAndUpdate with upsert for atomic operation
      const forecast = await InventoryForecast.findOneAndUpdate(
        {}, // empty filter to match any document
        { $set: forecastData },
        {
          new: true,
          upsert: true,
          runValidators: true
        }
      );

      return forecast;
    } catch (error) {
      retryCount++;
      logError(`Attempt ${retryCount} failed:`, error);
      
      if (retryCount === MAX_RETRIES) {
        logError('Error updating inventory forecast after max retries:', error);
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    }
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
  const forecast = await InventoryForecast.findOne().sort({ createdAt: -1 });
  if (!forecast) {
    throw new Error('No forecast found');
  }

  // Get age distribution using the new efficient method
  const ageDistribution = await getInventoryAgeDistribution();
  
  return {
    ...forecast.toObject(),
    inventoryData: ageDistribution
  };
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

/**
 * Calculate discounted value based on projected date
 */
function calculateDiscountedValue(retailValue, projectionDate) {
  const now = new Date();
  const daysInFuture = Math.floor((new Date(projectionDate) - now) / (1000 * 60 * 60 * 24));
  
  // Apply progressive discount based on time in future
  let discountFactor = 1.0;
  if (daysInFuture > 90) {
    discountFactor = 0.85; // 15% discount
  } else if (daysInFuture > 60) {
    discountFactor = 0.90; // 10% discount
  } else if (daysInFuture > 30) {
    discountFactor = 0.95; // 5% discount
  }
  
  return retailValue * discountFactor;
}

async function getInventoryAgeDistribution() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(now.getDate() - 60);
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(now.getDate() - 90);

  const ageDistribution = await Inventory.aggregate([
    {
      $match: {
        currentStock: { $gt: 0 }  // Only include items with stock
      }
    },
    {
      $facet: {
        '0-30': [
          { $match: { lastReceivedDate: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              retailValue: { $sum: { $multiply: ['$currentStock', '$retailPrice'] } },
              discountedValue: { 
                $sum: { 
                  $multiply: ['$currentStock', '$retailPrice', '$discountFactor', '$shrinkageFactor'] 
                } 
              }
            }
          }
        ],
        '31-60': [
          { 
            $match: { 
              lastReceivedDate: { 
                $lt: thirtyDaysAgo, 
                $gte: sixtyDaysAgo 
              } 
            } 
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              retailValue: { $sum: { $multiply: ['$currentStock', '$retailPrice'] } },
              discountedValue: { 
                $sum: { 
                  $multiply: ['$currentStock', '$retailPrice', '$discountFactor', '$shrinkageFactor'] 
                } 
              }
            }
          }
        ],
        '61-90': [
          { 
            $match: { 
              lastReceivedDate: { 
                $lt: sixtyDaysAgo, 
                $gte: ninetyDaysAgo 
              } 
            } 
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              retailValue: { $sum: { $multiply: ['$currentStock', '$retailPrice'] } },
              discountedValue: { 
                $sum: { 
                  $multiply: ['$currentStock', '$retailPrice', '$discountFactor', '$shrinkageFactor'] 
                } 
              }
            }
          }
        ],
        '90+': [
          { 
            $match: { 
              lastReceivedDate: { $lt: ninetyDaysAgo } 
            } 
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              retailValue: { $sum: { $multiply: ['$currentStock', '$retailPrice'] } },
              discountedValue: { 
                $sum: { 
                  $multiply: ['$currentStock', '$retailPrice', '$discountFactor', '$shrinkageFactor'] 
                } 
              }
            }
          }
        ],
        total: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              retailValue: { $sum: { $multiply: ['$currentStock', '$retailPrice'] } },
              discountedValue: { 
                $sum: { 
                  $multiply: ['$currentStock', '$retailPrice', '$discountFactor', '$shrinkageFactor'] 
                } 
              }
            }
          }
        ]
      }
    }
  ]);

  // Format the results
  const distribution = ageDistribution[0];
  const total = distribution.total[0] || { count: 0, retailValue: 0, discountedValue: 0 };

  // Convert to array format expected by frontend
  return ['0-30', '31-60', '61-90', '90+'].map(range => {
    const bucket = distribution[range][0] || { count: 0, retailValue: 0, discountedValue: 0 };
    return {
      range,
      count: bucket.count,
      retailValue: bucket.retailValue,
      discountedValue: bucket.discountedValue,
      percentage: total.count > 0 ? (bucket.count / total.count) * 100 : 0
    };
  });
} 