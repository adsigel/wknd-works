import ShopifyService from './shopifyService.js';
import Inventory from '../models/Inventory.js';
import mongoose from 'mongoose';
import { 
  logError, 
  logInfo, 
  logDebug 
} from '../utils/loggingUtils.js';
import { formatCurrency, formatPercentage } from '../utils/formatters.js';

class InventoryValueService {
  constructor() {
    this.DEFAULT_CATEGORY = 'Uncategorized';
    this.cache = {
      inventorySummary: null,
      lastFetched: null,
      cacheDuration: 5 * 60 * 1000 // 5 minutes in milliseconds
    };
  }

  /**
   * Get cost data for a variant from Shopify with rate limiting
   */
  async _getVariantCost(shopifyService, variant) {
    try {
      // Debug log the variant data
      console.log('Fetching cost for variant:', {
        variantId: variant.id,
        inventoryItemId: variant.inventory_item_id,
        sku: variant.sku
      });

      // First try to get cost from inventory item
      const inventoryItemResponse = await shopifyService.client.get(
        `/admin/api/2024-01/inventory_items/${variant.inventory_item_id}.json`
      );
      const inventoryItem = inventoryItemResponse.data.inventory_item;
      
      if (inventoryItem.cost) {
        console.log('Found cost in inventory item:', inventoryItem.cost);
        return parseFloat(inventoryItem.cost);
      }

      // If no cost in inventory item, try inventory item costs
      const costsResponse = await shopifyService.client.get(
        `/admin/api/2024-01/inventory_items/${variant.inventory_item_id}/costs.json`
      );
      
      const costs = costsResponse.data.costs;
      if (costs && costs.length > 0) {
        const latestCost = costs.reduce((latest, current) => {
          return new Date(current.created_at) > new Date(latest.created_at) ? current : latest;
        });
        console.log('Found cost in costs array:', latestCost.cost);
        return parseFloat(latestCost.cost);
      }

      console.log('No cost found for variant');
      return null;
    } catch (error) {
      // Handle rate limiting
      if (error.response && error.response.status === 429) {
        console.log('Rate limited, waiting 1 second before retry');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this._getVariantCost(shopifyService, variant);
      }
      
      // Log other errors but don't retry
      console.warn(`Failed to fetch cost for variant ${variant.id}: ${error.message}`);
      if (error.response) {
        console.warn('Error response:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      return null;
    }
  }

  /**
   * Calculate values for a variant
   */
  async _calculateVariantValues(variant, product) {
    let retailPrice = 0;
    if (variant.compare_at_price && parseFloat(variant.compare_at_price) > 0) {
      retailPrice = parseFloat(variant.compare_at_price);
    } else if (variant.price && parseFloat(variant.price) > 0) {
      retailPrice = parseFloat(variant.price);
    } else {
      return null;
    }

    // Use 50% margin assumption for cost calculation
    const costPrice = retailPrice * 0.5;
    
    const currentStock = variant.inventory_quantity;
    const variantRetailValue = currentStock * retailPrice;
    const variantCostValue = currentStock * costPrice;

    // Calculate discount based on age using created_at for inventory age
    const productDate = new Date(variant.created_at);
    const daysInInventory = Math.floor((new Date() - productDate) / (1000 * 60 * 60 * 24));
    
    let discount = 0;
    if (daysInInventory >= 90) discount = 0.4;
    else if (daysInInventory >= 60) discount = 0.25;
    else if (daysInInventory >= 30) discount = 0.15;
    
    const discountedValue = variantRetailValue * (1 - discount);

    return {
      retailPrice,
      costPrice,
      currentStock,
      retailValue: variantRetailValue,
      costValue: variantCostValue,
      discountedValue,
      discount,
      daysInInventory
    };
  }

  /**
   * Create inventory item for database
   */
  _createInventoryItem(product, variant, values) {
    return {
      productId: variant.sku || `${product.title}-${variant.title}`,
      shopifyProductId: product.id,
      variant: {
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        created_at: variant.created_at // Store creation date for age tracking
      },
      name: `${product.title} - ${variant.title}`,
      category: this._extractCategory(product),
      currentStock: values.currentStock,
      retailPrice: values.retailPrice,
      costPrice: values.costPrice,
      discountFactor: 1 - values.discount,
      shrinkageFactor: 0.98,
      daysInInventory: values.daysInInventory, // Store days in inventory
      lastUpdated: new Date()
    };
  }

  /**
   * Sync inventory from Shopify and calculate values
   */
  async syncInventoryFromShopify() {
    try {
      const debug = {
        steps: [],
        sampleData: {},
        warnings: []
      };
      
      debug.steps.push('Starting inventory sync from Shopify...');
      
      // Initialize Shopify service with credentials
      const shopName = process.env.SHOPIFY_SHOP_NAME;
      const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
      
      if (!shopName || !accessToken) {
        throw new Error('Shopify configuration missing. Please check SHOPIFY_SHOP_NAME and SHOPIFY_ACCESS_TOKEN environment variables.');
      }
      
      const shopifyService = new ShopifyService(shopName, accessToken);
      
      // Get all products from Shopify with timeout
      const productsPromise = shopifyService.getProducts();
      const products = await Promise.race([
        productsPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Products fetch timeout')), 30000)
        )
      ]);
      
      debug.steps.push(`Total products retrieved: ${products.length}`);

      let totalRetailValue = 0;
      let totalCostValue = 0;
      let totalDiscountedValue = 0;
      let processedVariants = 0;
      let skippedProducts = 0;
      let skippedVariants = 0;
      let priceWarnings = [];
      let inventoryItems = [];

      // Process each product
      let processedProducts = 0;
      for (const product of products) {
        processedProducts++;
        if (processedProducts % 10 === 0) {
          debug.steps.push(`Processed ${processedProducts} of ${products.length} products`);
        }

        // Skip inactive products
        if (product.status !== 'ACTIVE') {
          skippedProducts++;
          continue;
        }

        // Handle products without variants
        if (!product.variants || product.variants.length === 0) {
          const variant = {
            id: product.id,
            title: product.title,
            price: product.price,
            compare_at_price: product.compare_at_price,
            sku: product.sku,
            inventory_quantity: product.inventory_quantity || 0,
            created_at: product.created_at,
            updated_at: product.updated_at
          };
          product.variants = [variant];
        }

        // Process each variant
        for (const variant of product.variants) {
          // Skip variants with no inventory
          if (variant.inventory_quantity <= 0) {
            skippedVariants++;
            continue;
          }

          const values = await this._calculateVariantValues(variant, product);
          if (!values) {
            priceWarnings.push(`${product.title} - ${variant.title}: No valid price`);
            continue;
          }

          totalRetailValue += values.retailValue;
          totalCostValue += values.costValue;
          totalDiscountedValue += values.discountedValue;

          const dbInventoryItem = this._createInventoryItem(product, variant, values);
          inventoryItems.push(dbInventoryItem);
          processedVariants++;
        }
      }

      // Save all inventory items to database
      if (inventoryItems.length > 0) {
        await Inventory.deleteMany({});
        await Inventory.insertMany(inventoryItems);
        debug.steps.push(`Saved ${inventoryItems.length} inventory items to database`);
      }

      const potentialProfit = totalRetailValue - totalCostValue;
      const categoryBreakdown = this._calculateCategoryBreakdown(inventoryItems);

      return {
        success: true,
        timestamp: new Date(),
        summary: {
          totalProducts: products.length,
          processedVariants,
          skippedProducts,
          skippedVariants,
          totalRetailValue,
          totalCostValue,
          totalDiscountedValue,
          potentialProfit,
          categoryBreakdown
        },
        details: {
          rawTotalValue: {
            totalRetailValue,
            totalCostValue,
            totalDiscountedValue,
            totalPotentialProfit: potentialProfit,
            byCategory: categoryBreakdown
          },
          priceWarnings,
          debug: {
            steps: debug.steps,
            sampleData: debug.sampleData,
            warnings: debug.warnings
          }
        }
      };
    } catch (error) {
      console.error('Error syncing inventory:', error);
      throw error;
    }
  }

  /**
   * Update adjustment factors for a product or category
   */
  async updateAdjustmentFactors(options) {
    const {
      productId,
      category,
      discountFactor,
      shrinkageFactor
    } = options;

    const update = {};
    if (discountFactor !== undefined) update.discountFactor = discountFactor;
    if (shrinkageFactor !== undefined) update.shrinkageFactor = shrinkageFactor;

    let query = {};
    if (productId) {
      query.productId = productId;
    } else if (category) {
      query.category = category;
    } else {
      throw new Error('Either productId or category must be specified');
    }

    const result = await Inventory.updateMany(query, { $set: update });
    
    // Recalculate total value
    const totalValue = await Inventory.getTotalInventoryValue();

    return {
      success: true,
      updatedCount: result.modifiedCount,
      newTotalValue: totalValue
    };
  }

  /**
   * Extract category from product tags or type
   */
  _extractCategory(product) {
    // Use product type if available
    if (product.product_type) {
      return product.product_type;
    }

    // Look for category in tags
    if (product.tags) {
      // Handle both string and array formats
      const tags = Array.isArray(product.tags) 
        ? product.tags 
        : product.tags.split(',').map(tag => tag.trim());
      
      const categoryTag = tags.find(tag => tag.toLowerCase().startsWith('category:'));
      if (categoryTag) {
        return categoryTag.split(':')[1].trim();
      }
    }

    return this.DEFAULT_CATEGORY;
  }

  async getInventorySummary(forceRefresh = false) {
    try {
      // Check cache first
      if (!forceRefresh && this.cache.inventorySummary && this.cache.lastFetched) {
        const now = Date.now();
        const timeSinceLastFetch = now - this.cache.lastFetched;
        
        if (timeSinceLastFetch < this.cache.cacheDuration) {
          console.log('Returning cached inventory summary');
          return this.cache.inventorySummary;
        }
      }

      // Initialize Shopify service
      const shopName = process.env.SHOPIFY_SHOP_NAME;
      const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
      
      if (!shopName || !accessToken) {
        throw new Error('Shopify configuration missing');
      }
      
      const shopifyService = new ShopifyService(shopName, accessToken);
      
      // Get all products with their inventory
      const products = await shopifyService.getProducts();
      console.log(`Retrieved ${products.length} products from Shopify`);

      let totalProducts = 0;
      let totalVariants = 0;
      let totalRetailValue = 0;
      let totalCostValue = 0;
      let totalDiscountedValue = 0;
      let variantsWithActualCost = 0;

      // Process each product
      for (const product of products) {
        if (product.status !== 'ACTIVE') continue;
        
        // Check if product has variants with inventory
        const hasInventory = product.variants.some(variant => variant.inventory_quantity > 0);
        if (!hasInventory) continue;
        
        totalProducts++;
        
        for (const variant of product.variants) {
          if (variant.inventory_quantity <= 0) continue;
          
          totalVariants++;
          
          const values = await this._calculateVariantValues(variant, product);
          if (!values) continue;
          
          if (values.hasActualCost) {
            variantsWithActualCost++;
          }
          
          totalRetailValue += values.retailValue;
          totalCostValue += values.costValue;
          totalDiscountedValue += values.discountedValue;
        }
      }

      const summary = {
        totalProducts,
        totalVariants,
        variantsWithActualCost,
        totalRetailValue,
        totalCostValue,
        totalDiscountedValue,
        grossMargin: formatPercentage((totalRetailValue - totalCostValue) / totalRetailValue * 100),
        adjustedGrossMargin: formatPercentage((totalDiscountedValue - totalCostValue) / totalDiscountedValue * 100),
        itemizedValues: {
          totalRetailValue,
          totalCostValue,
          totalDiscountedValue
        }
      };

      console.log('Calculated inventory summary:', JSON.stringify(summary, null, 2));

      // Cache the results
      this.cache.inventorySummary = summary;
      this.cache.lastFetched = Date.now();

      return summary;
    } catch (error) {
      console.error('Error getting inventory summary:', error);
      throw error;
    }
  }

  /**
   * Calculate category breakdown from inventory items
   * @param {Array} inventoryItems - Array of inventory items
   * @returns {Object} Category breakdown with totals
   */
  _calculateCategoryBreakdown(inventoryItems) {
    const breakdown = {};
    
    for (const item of inventoryItems) {
      const category = item.category || this.DEFAULT_CATEGORY;
      
      if (!breakdown[category]) {
        breakdown[category] = {
          retailValue: 0,
          costValue: 0,
          itemCount: 0
        };
      }
      
      breakdown[category].retailValue += item.currentStock * item.retailPrice;
      breakdown[category].costValue += item.currentStock * item.cost;
      breakdown[category].itemCount += 1;
    }
    
    return breakdown;
  }
}

export { InventoryValueService }; 