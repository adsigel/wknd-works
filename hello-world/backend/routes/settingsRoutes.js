import express from 'express';
import Settings from '../models/Settings.js';

const router = express.Router();

// GET settings
router.get('/', async (req, res) => {
  try {
    const settings = await Settings.findOne() || new Settings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST settings
router.post('/', async (req, res) => {
  try {
    const settings = await Settings.findOne() || new Settings();
    
    // Log the incoming settings
    console.log('Received settings update:', JSON.stringify(req.body, null, 2));
    
    // Update settings
    if (req.body.inventorySettings) {
      settings.inventorySettings = req.body.inventorySettings;
      console.log('Updated inventory settings:', JSON.stringify(settings.inventorySettings, null, 2));
    }
    if (req.body.chartSettings) settings.chartSettings = req.body.chartSettings;
    if (req.body.projectionSettings) settings.projectionSettings = req.body.projectionSettings;
    if (req.body.chartType) settings.chartType = req.body.chartType;
    if (req.body.showProjections !== undefined) settings.showProjections = req.body.showProjections;
    if (req.body.darkMode !== undefined) settings.darkMode = req.body.darkMode;
    if (req.body.currency) settings.currency = req.body.currency;
    if (req.body.timezone) settings.timezone = req.body.timezone;
    if (req.body.refreshInterval) settings.refreshInterval = req.body.refreshInterval;

    await settings.save();
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 