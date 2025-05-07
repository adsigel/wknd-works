import express from 'express';
import InventoryScenario from '../models/InventoryScenario.js';
import Inventory from '../models/Inventory.js';
import SalesGoal from '../models/SalesGoal.js';
import Settings from '../models/Settings.js';

const router = express.Router();

function applyHaircut(totalCost, haircutType, haircutValue) {
  if (haircutType === 'percent') {
    return totalCost * (1 - haircutValue);
  } else if (haircutType === 'dollar') {
    return Math.max(0, totalCost - haircutValue);
  }
  return totalCost;
}

function calculateRevenuePotential(adjustedInventoryValue, grossMargin) {
  // grossMargin is (revenue - cost) / revenue, so revenue = cost / (1 - grossMargin)
  return adjustedInventoryValue / (1 - grossMargin);
}

router.get('/', async (req, res) => {
  try {
    // 1. Get all scenarios
    const scenarios = await InventoryScenario.find();

    // 2. Get the noCostInventoryHandling setting
    const settings = await Settings.findOne();
    const noCostInventoryHandling = settings?.noCostInventoryHandling || 'exclude';

    // 3. Get inventory items
    let inventoryItems = await Inventory.find();

    // 4. Filter or transform inventory items based on the setting
    if (noCostInventoryHandling === 'exclude') {
      inventoryItems = inventoryItems.filter(
        item => item.costSource === 'shopify' && item.shopifyCost && item.shopifyCost > 0
      );
    } else if (noCostInventoryHandling === 'assumeMargin') {
      // For items with no cost, dynamically calculate cost as 50% of retail
      inventoryItems = inventoryItems.map(item => {
        if (
          (!item.shopifyCost || item.shopifyCost === 0) &&
          (!item.costPrice || item.costPrice === 0)
        ) {
          return {
            ...item.toObject(),
            costPrice: item.retailPrice * 0.5,
            costSource: 'assumed'
          };
        }
        return item.toObject();
      });
    } else {
      // Default: convert to plain objects for consistency
      inventoryItems = inventoryItems.map(item => item.toObject());
    }

    // 5. Get total inventory cost value (sum of costPrice * currentStock for all items)
    const totalInventoryCost = inventoryItems.reduce(
      (sum, item) => sum + (item.costPrice * item.currentStock),
      0
    );

    // 6. Get next 12 weeks' sales goals
    const now = new Date();
    const salesGoals = await SalesGoal.find({
      date: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) }
    }).sort({ date: 1 }).limit(3);

    // Distribute monthly goals into weeks (approximate: 4 weeks per month)
    let weeklyGoals = [];
    salesGoals.forEach(goal => {
      for (let i = 0; i < 4; i++) {
        weeklyGoals.push(goal.goal / 4);
      }
    });
    // Only take the next 12 weeks
    weeklyGoals = weeklyGoals.slice(0, 12);
    const total12WeekSalesGoal = weeklyGoals.reduce((sum, w) => sum + w, 0);
    const avgWeeklySalesGoal = weeklyGoals.length > 0 ? total12WeekSalesGoal / weeklyGoals.length : 0;

    // 7. Calculate for each scenario
    const results = scenarios.map(scenario => {
      const adjustedInventoryValue = applyHaircut(
        totalInventoryCost,
        scenario.haircutType,
        scenario.haircutValue
      );
      const revenuePotential = calculateRevenuePotential(
        adjustedInventoryValue,
        scenario.grossMargin
      );
      const runwayWeeks = avgWeeklySalesGoal > 0 ? revenuePotential / avgWeeklySalesGoal : 0;
      const reorderNeeded = revenuePotential < total12WeekSalesGoal;
      const marginForMinSpend = scenario.grossMarginForMinSpend ?? scenario.grossMargin;
      const minimumSpend = reorderNeeded
        ? (total12WeekSalesGoal - revenuePotential) * (1 - marginForMinSpend)
        : 0;

      return {
        scenarioType: scenario.scenarioType,
        adjustedInventoryValue,
        revenuePotential,
        runwayWeeks,
        total12WeekSalesGoal,
        reorderNeeded,
        minimumSpend,
        grossMargin: scenario.grossMargin,
        haircutType: scenario.haircutType,
        haircutValue: scenario.haircutValue,
        ignored: scenario.ignored,
        updatedAt: scenario.updatedAt,
      };
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router; 