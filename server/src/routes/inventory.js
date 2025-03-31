import express from 'express';
import ShopifyService from '../services/shopifyService.js';
import { InventoryValueService } from '../services/inventoryValueService.js';
import Inventory from '../models/Inventory.js';
import { logError } from '../utils/loggingUtils.js';

const router = express.Router();

console.log('Inventory routes initialized');

// Debug middleware for this router
router.use((req, res, next) => {
  console.log(`[Inventory Route] ${req.method} ${req.path}`);
  next();
});

// Validate Shopify API access
router.get('/validate-shopify', async (req, res) => {
  console.log('Handling validate-shopify request');
  try {
    const shopName = process.env.SHOPIFY_SHOP_NAME;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    
    if (!shopName || !accessToken) {
      throw new Error('Shopify configuration missing');
    }
    
    const shopifyService = new ShopifyService(shopName, accessToken);
    const validationResult = await shopifyService.validateAccess();
    res.json(validationResult);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Sync inventory with Shopify
router.post('/sync', async (req, res) => {
  try {
    const shopifyService = new ShopifyService(
      process.env.SHOPIFY_SHOP_NAME,
      process.env.SHOPIFY_ACCESS_TOKEN
    );

    // Validate Shopify access first
    const accessCheck = await shopifyService.validateAccess();
    if (!accessCheck.hasAllRequiredScopes) {
      return res.status(400).json({
        error: 'Missing required Shopify API scopes',
        details: accessCheck.message
      });
    }

    // Perform the sync
    const summary = await shopifyService.syncInventory();
    
    res.json({
      message: 'Inventory sync completed successfully',
      summary
    });
  } catch (error) {
    logError('Error syncing inventory with Shopify:', error);
    res.status(500).json({
      error: 'Failed to sync inventory',
      details: error.message
    });
  }
});

// Get total inventory value
router.get('/value', async (req, res) => {
  try {
    const totalValue = await Inventory.getTotalInventoryValue();
    res.json({
      success: true,
      data: totalValue,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update adjustment factors
router.post('/adjust', async (req, res) => {
  try {
    const { productId, category, discountFactor, shrinkageFactor } = req.body;
    
    if (!productId && !category) {
      return res.status(400).json({
        success: false,
        error: 'Either productId or category must be specified'
      });
    }

    const inventoryValueService = new InventoryValueService();
    const result = await inventoryValueService.updateAdjustmentFactors({
      productId,
      category,
      discountFactor,
      shrinkageFactor
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get inventory summary
router.get('/summary', async (req, res) => {
  try {
    const forceRefresh = req.query.forceRefresh === 'true';
    console.log('Getting inventory summary with forceRefresh:', forceRefresh);
    const inventoryValueService = new InventoryValueService();
    const summary = await inventoryValueService.getInventorySummary(forceRefresh);
    console.log('Inventory summary result:', summary);
    res.json(summary);
  } catch (error) {
    console.error('Error getting inventory summary:', error);
    res.status(500).json({ error: 'Failed to get inventory summary' });
  }
});

export default router; 