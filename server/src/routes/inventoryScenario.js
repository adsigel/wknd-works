import express from 'express';
import InventoryScenario from '../models/InventoryScenarios.js';

const router = express.Router();

// Get all scenarios
router.get('/', async (req, res) => {
  try {
    const scenarios = await InventoryScenario.find();
    res.json(scenarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a scenario by type
router.put('/:scenarioType', async (req, res) => {
  const { scenarioType } = req.params;
  const { haircutType, haircutValue, grossMargin, ignored, grossMarginForMinSpend } = req.body;

  try {
    const scenario = await InventoryScenario.findOneAndUpdate(
      { scenarioType },
      { haircutType, haircutValue, grossMargin, ignored, grossMarginForMinSpend },
      { new: true, runValidators: true }
    );
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    res.json(scenario);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create a new scenario
router.post('/', async (req, res) => {
  try {
    const scenario = new InventoryScenario(req.body);
    await scenario.save();
    res.status(201).json(scenario);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;