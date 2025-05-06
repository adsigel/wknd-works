import express from 'express';
import InventoryScenario from '../models/InventoryScenario.js';
import Inventory from '../models/Inventory.js';
import SalesGoal from '../models/SalesGoal.js';

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

    // 2. Get total inventory cost value (sum of costPrice * currentStock for all items)
    const inventoryItems = await Inventory.find();
    const totalInventoryCost = inventoryItems.reduce(
      (sum, item) => sum + (item.costPrice * item.currentStock),
      0
    );

    // 3. Get next 12 weeks' sales goals
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

    // 4. Calculate for each scenario
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