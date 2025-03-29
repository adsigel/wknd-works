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
   * Sync inventory from Shopify and calculate values
   */
  async syncInventoryFromShopify() {
    try {
      console.log('Starting inventory sync from Shopify...');
      
      // Initialize Shopify service with credentials
      const shopName = process.env.SHOPIFY_SHOP_NAME;
      const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
      
      if (!shopName || !accessToken) {
        throw new Error('Shopify configuration missing. Please check SHOPIFY_SHOP_NAME and SHOPIFY_ACCESS_TOKEN environment variables.');
      }
      
      const shopifyService = new ShopifyService(shopName, accessToken);
      
      // Get all products and inventory levels from Shopify
      const products = await shopifyService.getProducts();
      console.log(`Total products retrieved: ${products.length}`);
      const locations = await shopifyService.client.get('/admin/api/2024-01/locations.json');
      const locationId = locations.data.locations[0].id;
      const inventoryLevels = await shopifyService.getInventoryLevels(locationId);

      console.log(`Found ${products.length} products and ${inventoryLevels.length} inventory levels`);

      let totalRetailValue = 0;
      let totalCostValue = 0;
      let processedVariants = 0;
      let skippedProducts = 0;
      let priceWarnings = [];

      // Process each product and its variants
      for (const product of products) {
        if (!product.variants || product.variants.length === 0) {
          skippedProducts++;
          continue;
        }

        // Process each variant
        for (const variant of product.variants) {
          const inventoryLevel = inventoryLevels.find(
            level => level.inventory_item_id === variant.inventory_item_id
          );

          if (!inventoryLevel) {
            continue;
          }

          const currentStock = inventoryLevel.available;

          // Get retail price with validation
          let retailPrice = 0;
          if (variant.compare_at_price && parseFloat(variant.compare_at_price) > 0) {
            retailPrice = parseFloat(variant.compare_at_price);
          } else if (variant.price && parseFloat(variant.price) > 0) {
            retailPrice = parseFloat(variant.price);
          } else {
            priceWarnings.push(`${product.title} - ${variant.title}: No valid price`);
            continue;
          }

          // Get cost from inventory item
          let costPrice = 0;
          try {
            const inventoryItemResponse = await shopifyService.client.get(
              `/admin/api/2024-01/inventory_items/${variant.inventory_item_id}.json`
            );
            costPrice = parseFloat(inventoryItemResponse.data.inventory_item.cost || 0);
          } catch (error) {
            // If we can't get the cost, estimate it as 50% of retail
            costPrice = retailPrice * 0.5;
          }

          // Calculate values for this variant
          const variantRetailValue = currentStock * retailPrice;
          const variantCostValue = currentStock * costPrice;
          totalRetailValue += variantRetailValue;
          totalCostValue += variantCostValue;

          // Update or create inventory record
          await Inventory.findOneAndUpdate(
            { 
              shopifyProductId: product.id,
              'variant.id': variant.id 
            },
            {
              $set: {
                productId: variant.sku || variant.id.toString(),
                name: `${product.title} - ${variant.title}`,
                category: this._extractCategory(product),
                currentStock: currentStock,
                retailPrice: retailPrice,
                costPrice: costPrice,
                variant: {
                  id: variant.id,
                  title: variant.title,
                  sku: variant.sku
                },
                lastUpdated: new Date()
              },
              $setOnInsert: {
                discountFactor: 1.0,
                shrinkageFactor: 0.98
              }
            },
            { upsert: true, new: true }
          );

          processedVariants++;
        }
      }

      console.log(`\n=== Sync Summary ===`);
      console.log(`✅ Processed ${processedVariants} variants`);
      console.log(`⚠️ Skipped ${skippedProducts} products`);
      console.log(`💰 Total retail value: ${formatCurrency(totalRetailValue)}`);
      console.log(`💲 Total cost value: ${formatCurrency(totalCostValue)}`);

      // Calculate category breakdown using our model
      const totalValue = await Inventory.getTotalInventoryValue();

      return {
        success: true,
        timestamp: new Date(),
        summary: {
          totalProducts: products.length,
          processedVariants,
          skippedProducts,
          totalRetailValue,
          totalCostValue,
          potentialProfit: totalRetailValue - totalCostValue,
          categoryBreakdown: totalValue.byCategory
        },
        details: {
          rawTotalValue: totalValue,
          priceWarnings
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
      const tags = product.tags.split(',').map(tag => tag.trim());
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
          
          // Calculate values
          const retailPrice = parseFloat(variant.compare_at_price || variant.price);
          const costPrice = retailPrice * 0.5; // Assuming 50% margin for now
          
          const quantity = variant.inventory_quantity;
          const variantRetailValue = quantity * retailPrice;
          const variantCostValue = quantity * costPrice;
          
          // Apply any discounts based on age
          const productDate = new Date(variant.updated_at || variant.created_at);
          const daysInInventory = Math.floor((new Date() - productDate) / (1000 * 60 * 60 * 24));
          
          let discount = 0;
          if (daysInInventory >= 90) discount = 0.4;
          else if (daysInInventory >= 60) discount = 0.25;
          else if (daysInInventory >= 30) discount = 0.15;
          
          const discountedValue = variantRetailValue * (1 - discount);
          
          totalRetailValue += variantRetailValue;
          totalCostValue += variantCostValue;
          totalDiscountedValue += discountedValue;
        }
      }

      const summary = {
        totalProducts,
        totalVariants,
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
}

export { InventoryValueService }; 