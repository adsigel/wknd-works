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
 * @param {Object} discountSettings - The discount settings to use
 * @param {Object} salesDistribution - The sales distribution to use
 * @param {number} minimumWeeksBuffer - The minimum weeks buffer for threshold calculation
 * @returns {Array<Object>} Array of weekly projections
 */
async function generateWeeklyProjections(
  startDate,
  forecastPeriodWeeks,
  weeklySales,
  aggregateValues,
  discountSettings,
  salesDistribution,
  minimumWeeksBuffer
) {
  const projections = [];

  // Get inventory items and their ages
  const inventoryItems = await Inventory.find({ currentStock: { $gt: 0 } });
  
  // Initialize inventory buckets
  let inventoryBuckets = {
    '0-30': [],
    '31-60': [],
    '61-90': [],
    '90+': []
  };

  // Distribute initial inventory into buckets
  inventoryItems.forEach(item => {
    const age = Math.floor((new Date() - new Date(item.lastReceivedDate)) / (1000 * 60 * 60 * 24));
    const bucket = age <= 30 ? '0-30' : 
                  age <= 60 ? '31-60' : 
                  age <= 90 ? '61-90' : 
                  '90+';
    inventoryBuckets[bucket].push({
      ...item.toObject(),
      age,
      retailValue: item.currentStock * item.retailPrice,
      costValue: item.currentStock * item.costPrice
    });
  });

  for (let i = 0; i < forecastPeriodWeeks; i++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (i * 7));
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Calculate weekly sales amount
    const weeklySalesAmount = weeklySales[i] || 0;

    // First apply sales reductions to current buckets
    let remainingSales = weeklySalesAmount;
    const targetSalesByBucket = {};

    // Calculate initial target sales for each bucket
    Object.keys(inventoryBuckets).forEach(bucket => {
      targetSalesByBucket[bucket] = remainingSales * (salesDistribution[bucket] / 100);
    });

    // Calculate total retail value in each bucket
    const bucketTotals = {};
    let totalRetailValue = 0;
    Object.entries(inventoryBuckets).forEach(([bucket, items]) => {
      bucketTotals[bucket] = items.reduce((sum, item) => sum + (item.retailValue || 0), 0);
      totalRetailValue += bucketTotals[bucket];
    });

    // Adjust sales targets based on available value
    Object.entries(inventoryBuckets).forEach(([bucket, items]) => {
      if (!bucketTotals[bucket] || bucketTotals[bucket] === 0) {
        targetSalesByBucket[bucket] = 0;
        return;
      }
      
      if (targetSalesByBucket[bucket] > bucketTotals[bucket]) {
        const excess = targetSalesByBucket[bucket] - bucketTotals[bucket];
        targetSalesByBucket[bucket] = bucketTotals[bucket];
        
        // Redistribute excess proportionally to other buckets
        const otherBuckets = Object.entries(inventoryBuckets)
          .filter(([b]) => b !== bucket && bucketTotals[b] > targetSalesByBucket[b]);
        
        const remainingCapacity = otherBuckets
          .reduce((sum, [b]) => sum + (bucketTotals[b] - targetSalesByBucket[b]), 0);
        
        if (remainingCapacity > 0) {
          otherBuckets.forEach(([b]) => {
            const share = (bucketTotals[b] - targetSalesByBucket[b]) / remainingCapacity;
            targetSalesByBucket[b] += excess * share;
          });
        }
      }
    });

    // Apply sales reductions
    Object.entries(inventoryBuckets).forEach(([bucket, items]) => {
      if (items.length === 0 || !bucketTotals[bucket] || bucketTotals[bucket] === 0) {
        return;
      }
      
      const reductionFactor = Math.max(0, 1 - (targetSalesByBucket[bucket] / bucketTotals[bucket]));
      items.forEach(item => {
        item.retailValue = (item.retailValue || 0) * reductionFactor;
        item.costValue = (item.costValue || 0) * reductionFactor;
      });
    });

    // Now age items and calculate new discounted values
    const agedItems = Object.values(inventoryBuckets).flat().map(item => {
      const newAge = item.age + 7;
      const retailValue = item.retailValue || 0;
      return {
        ...item,
        age: newAge,
        retailValue,
        costValue: item.costValue || 0,
        discountedValue: calculateDiscountedValue(retailValue, newAge, discountSettings)
      };
    });

    // Group aged items into new buckets
    const tempBuckets = {
      '0-30': [],
      '31-60': [],
      '61-90': [],
      '90+': []
    };

    agedItems.forEach(item => {
      const bucket = item.age <= 30 ? '0-30' : 
                    item.age <= 60 ? '31-60' : 
                    item.age <= 90 ? '61-90' : 
                    '90+';
      tempBuckets[bucket].push(item);
    });

    // Calculate final values for the week with safeguards against NaN
    const endingRetailValue = Object.values(tempBuckets).flat()
      .reduce((sum, item) => sum + (item.retailValue || 0), 0);
    const endingDiscountedValue = Object.values(tempBuckets).flat()
      .reduce((sum, item) => sum + (item.discountedValue || 0), 0);
    const endingCost = Object.values(tempBuckets).flat()
      .reduce((sum, item) => sum + (item.costValue || 0), 0);

    // Update inventory buckets for next week
    inventoryBuckets = tempBuckets;

    // Check if inventory is below threshold
    const minimumBuffer = weeklySalesAmount * minimumWeeksBuffer;
    const isBelowThreshold = endingDiscountedValue < minimumBuffer;

    projections.push({
      weekStart,
      weekEnd,
      projectedSales: weeklySalesAmount,
      endingRetailValue,
      endingDiscountedValue,
      endingCost,
      isBelowThreshold,
      minimumBuffer
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

      // Get current forecast to use its discount settings
      const currentForecast = await InventoryForecast.findOne();

      // Calculate aggregate values
      const aggregateValues = {
        totalInventoryCost: validInventoryItems.reduce((sum, item) => sum + (item.currentStock * item.costPrice), 0),
        totalRetailValue: validInventoryItems.reduce((sum, item) => sum + (item.currentStock * item.retailPrice), 0),
        totalDiscountedValue: validInventoryItems.reduce((sum, item) => {
          const retailValue = item.currentStock * item.retailPrice;
          const ageInDays = Math.floor((new Date() - new Date(item.lastReceivedDate)) / (1000 * 60 * 60 * 24));
          return sum + calculateDiscountedValue(retailValue, ageInDays, currentForecast?.configuration?.discountSettings || {
            '0-30': 0,
            '31-60': 5,
            '61-90': 10,
            '90+': 15
          });
        }, 0)
      };

      logDebug('Aggregate values:', aggregateValues);

      // Get weekly sales goals and round to 2 decimal places
      const weeklySales = (await getWeeklySalesGoals(startDate, forecastPeriodWeeks))
        .map(amount => Math.round(amount * 100) / 100);

      logDebug('Weekly sales goals:', weeklySales);

      // Generate projections
      const weeklyProjections = await generateWeeklyProjections(
        startDate,
        forecastPeriodWeeks,
        weeklySales,
        aggregateValues,
        currentForecast?.configuration?.discountSettings || {
          '0-30': 0,
          '31-60': 5,
          '61-90': 10,
          '90+': 15
        },
        currentForecast?.configuration?.salesDistribution || {
          '0-30': 25,
          '31-60': 25,
          '61-90': 25,
          '90+': 25
        },
        currentForecast?.configuration?.minimumWeeksBuffer || 6
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
          minimumWeeksBuffer: currentForecast?.configuration?.minimumWeeksBuffer || 6,
          leadTimeWeeks: 2,
          discountSettings: currentForecast?.configuration?.discountSettings || {
            '0-30': 0,
            '31-60': 5,
            '61-90': 10,
            '90+': 15
          },
          salesDistribution: currentForecast?.configuration?.salesDistribution || {
            '0-30': 25,
            '31-60': 25,
            '61-90': 25,
            '90+': 25
          }
        },
        weeklyProjections,
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
 * Calculate discounted value based on age
 * @param {number} retailValue - The retail value to discount
 * @param {number} ageInDays - The age of the item in days
 * @param {Object} discountSettings - The discount settings to use
 * @returns {number} - The discounted value
 */
function calculateDiscountedValue(retailValue, ageInDays, discountSettings) {
  // Use provided discount settings or defaults
  const settings = discountSettings || {
    '0-30': 0,
    '31-60': 5,
    '61-90': 10,
    '90+': 15
  };
  
  // Find the maximum discount percentage that applies to this age or any younger age
  let discountPercent = settings['0-30'];
  
  if (ageInDays >= 30) {
    discountPercent = Math.max(discountPercent, settings['31-60']);
  }
  if (ageInDays >= 60) {
    discountPercent = Math.max(discountPercent, settings['61-90']);
  }
  if (ageInDays >= 90) {
    discountPercent = Math.max(discountPercent, settings['90+']);
  }
  
  return retailValue * (1 - discountPercent / 100);
}

async function getInventoryAgeDistribution() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(now.getDate() - 60);
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(now.getDate() - 90);

  // Get current forecast to use its discount settings
  const currentForecast = await InventoryForecast.findOne();
  const discountSettings = currentForecast?.configuration?.discountSettings || {
    '0-30': 0,
    '31-60': 5,
    '61-90': 10,
    '90+': 15
  };

  // Get all inventory items with stock
  const inventoryItems = await Inventory.find({ currentStock: { $gt: 0 } });

  // Group items by age bucket and calculate values
  const buckets = {
    '0-30': [],
    '31-60': [],
    '61-90': [],
    '90+': []
  };

  // Distribute items into buckets
  inventoryItems.forEach(item => {
    const age = Math.floor((now - new Date(item.lastReceivedDate)) / (1000 * 60 * 60 * 24));
    const bucket = age <= 30 ? '0-30' : 
                  age <= 60 ? '31-60' : 
                  age <= 90 ? '61-90' : 
                  '90+';
    buckets[bucket].push({
      ...item.toObject(),
      age,
      retailValue: item.currentStock * item.retailPrice
    });
  });

  // Calculate totals for each bucket
  const distribution = Object.entries(buckets).map(([range, items]) => {
    const retailValue = items.reduce((sum, item) => sum + item.retailValue, 0);
    const discountedValue = items.reduce((sum, item) => {
      return sum + calculateDiscountedValue(item.retailValue, item.age, discountSettings);
    }, 0);

    return {
      range,
      count: items.length,
      retailValue,
      discountedValue
    };
  });

  // Calculate total count for percentages
  const totalCount = distribution.reduce((sum, bucket) => sum + bucket.count, 0);

  // Add percentages to each bucket
  return distribution.map(bucket => ({
    ...bucket,
    percentage: totalCount > 0 ? (bucket.count / totalCount) * 100 : 0
  }));
} 