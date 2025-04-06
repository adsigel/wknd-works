import express from 'express';
import Settings from '../models/Settings.js';

const router = express.Router();

// GET settings
router.get('/', async (req, res) => {
  try {
    const settings = await Settings.findOne() || new Settings();
    console.log('GET /api/settings - Current settings:', JSON.stringify(settings, null, 2));
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST settings
router.post('/', async (req, res) => {
  try {
    console.log('POST /api/settings - Received body:', JSON.stringify(req.body, null, 2));
    
    let settings = await Settings.findOne();
    if (!settings) {
      console.log('No existing settings found, creating new settings document');
      settings = new Settings();
    }
    
    // Update settings
    if (req.body.chartSettings) {
      settings.chartSettings = req.body.chartSettings;
      console.log('Updated chart settings:', JSON.stringify(settings.chartSettings, null, 2));
    }
    if (req.body.projectionSettings) {
      settings.projectionSettings = req.body.projectionSettings;
      console.log('Updated projection settings:', JSON.stringify(settings.projectionSettings, null, 2));
    }
    if (req.body.chartType) settings.chartType = req.body.chartType;
    if (req.body.showProjections !== undefined) settings.showProjections = req.body.showProjections;
    if (req.body.darkMode !== undefined) settings.darkMode = req.body.darkMode;
    if (req.body.currency) settings.currency = req.body.currency;
    if (req.body.timezone) settings.timezone = req.body.timezone;
    if (req.body.refreshInterval) settings.refreshInterval = req.body.refreshInterval;

    console.log('Saving updated settings:', JSON.stringify(settings, null, 2));
    await settings.save();
    console.log('Settings saved successfully');
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 