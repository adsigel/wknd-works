import ShopifyService from './shopifyService.js';
import Inventory from '../models/Inventory.js';
import mongoose from 'mongoose';

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
      console.log('Retrieved products:', JSON.stringify(products.slice(0, 2), null, 2));
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
        console.log(`\n📦 Processing product: ${product.title}`);
        
        if (!product.variants || product.variants.length === 0) {
          console.log(`  ⚠️ Skipping product ${product.title}: No variants found`);
          skippedProducts++;
          continue;
        }

        // Process each variant
        for (const variant of product.variants) {
          console.log(`\n  🏷️ Variant: ${variant.title}`);
          console.log(`    SKU: ${variant.sku || 'No SKU'}`);

          const inventoryLevel = inventoryLevels.find(
            level => level.inventory_item_id === variant.inventory_item_id
          );

          if (!inventoryLevel) {
            console.log(`    ⚠️ No inventory level found for variant`);
            continue;
          }

          const currentStock = inventoryLevel.available;
          console.log(`    📊 Current stock: ${currentStock}`);

          // Get retail price with validation
          let retailPrice = 0;
          if (variant.compare_at_price && parseFloat(variant.compare_at_price) > 0) {
            retailPrice = parseFloat(variant.compare_at_price);
            console.log(`    💰 Using compare_at_price as retail: $${retailPrice}`);
          } else if (variant.price && parseFloat(variant.price) > 0) {
            retailPrice = parseFloat(variant.price);
            console.log(`    💰 Using price as retail: $${retailPrice}`);
          } else {
            console.log(`    ⚠️ Warning: No valid price found for variant`);
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
            console.log(`    💲 Cost: $${costPrice}`);
          } catch (error) {
            console.log(`    ⚠️ Error fetching cost: ${error.message}`);
            // If we can't get the cost, estimate it as 50% of retail
            costPrice = retailPrice * 0.5;
            console.log(`    💲 Estimated cost (50% of retail): $${costPrice}`);
          }

          // Calculate values for this variant
          const variantRetailValue = currentStock * retailPrice;
          const variantCostValue = currentStock * costPrice;
          totalRetailValue += variantRetailValue;
          totalCostValue += variantCostValue;

          console.log(`    📈 Variant value calculation:`);
          console.log(`      - Stock: ${currentStock} units`);
          console.log(`      - Retail price: $${retailPrice}`);
          console.log(`      - Cost: $${costPrice}`);
          console.log(`      - Retail value: $${variantRetailValue.toFixed(2)}`);
          console.log(`      - Cost value: $${variantCostValue.toFixed(2)}`);

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
      console.log(`💰 Total retail value: $${totalRetailValue.toFixed(2)}`);
      console.log(`💲 Total cost value: $${totalCostValue.toFixed(2)}`);

      if (priceWarnings.length > 0) {
        console.log(`\n⚠️ Price Warnings:`);
        priceWarnings.forEach(warning => console.log(`  - ${warning}`));
      }

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
      // Check if we have a valid cached response and forceRefresh is not true
      if (!forceRefresh && this.cache.inventorySummary && this.cache.lastFetched) {
        const now = Date.now();
        const timeSinceLastFetch = now - this.cache.lastFetched;
        
        if (timeSinceLastFetch < this.cache.cacheDuration) {
          console.log('Returning cached inventory summary');
          return this.cache.inventorySummary;
        }
      }

      // Initialize Shopify service with credentials
      const shopName = process.env.SHOPIFY_SHOP_NAME;
      const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
      
      if (!shopName || !accessToken) {
        throw new Error('Shopify configuration missing. Please check SHOPIFY_SHOP_NAME and SHOPIFY_ACCESS_TOKEN environment variables.');
      }
      
      const shopifyService = new ShopifyService(shopName, accessToken);
      
      // Get settings for inventory discounts
      const Settings = mongoose.model('Settings');
      const settings = await Settings.findOne() || new Settings();
      const discountRanges = settings.inventorySettings?.discountRanges || {
        range1: { days: 30, discount: 0.15 },
        range2: { days: 60, discount: 0.25 },
        range3: { days: 90, discount: 0.40 }
      };
      
      console.log('Current discount ranges:', JSON.stringify(discountRanges, null, 2));
      
      // Get all products and inventory levels from Shopify
      const products = await shopifyService.getProducts();
      console.log(`Total products retrieved: ${products.length}`);
      
      // Log sample product data
      if (products.length > 0) {
        console.log('Sample product data:', JSON.stringify(products[0], null, 2));
      }

      let totalProducts = 0;
      let totalVariants = 0;
      let totalRetailValue = 0;
      let totalCostValue = 0;
      let totalDiscountedValue = 0;

      // Get current date for age calculations
      const currentDate = new Date();

      for (const product of products) {
        console.log(`\nProcessing product: ${product.title}`);
        
        if (product.status !== 'ACTIVE') {
          console.log(`Skipping inactive product (status: ${product.status})`);
          continue;
        }

        // Check if product has any variants with inventory
        const hasInventory = product.variants.some(variant => {
          const hasStock = variant.inventory_quantity > 0;
          console.log(`Variant ${variant.title} inventory: ${variant.inventory_quantity}`);
          return hasStock;
        });

        if (!hasInventory) {
          console.log('Skipping product with no inventory');
          continue;
        }

        totalProducts++;
        console.log('Product counted, total products:', totalProducts);

        for (const variant of product.variants) {
          if (variant.inventory_quantity <= 0) {
            console.log(`Skipping variant ${variant.title} with no inventory`);
            continue;
          }

          totalVariants++;
          console.log(`Processing variant ${variant.title}, total variants: ${totalVariants}`);

          // Get retail price
          let retailPrice = 0;
          if (variant.compare_at_price && parseFloat(variant.compare_at_price) > 0) {
            retailPrice = parseFloat(variant.compare_at_price);
            console.log(`Using compare_at_price as retail: $${retailPrice}`);
          } else if (variant.price && parseFloat(variant.price) > 0) {
            retailPrice = parseFloat(variant.price);
            console.log(`Using price as retail: $${retailPrice}`);
          }

          // Get cost (using 50% of retail for now)
          let costPrice = retailPrice * 0.5;
          console.log(`Using estimated cost (50% of retail): $${costPrice}`);

          const variantRetailValue = variant.inventory_quantity * retailPrice;
          const variantCostValue = variant.inventory_quantity * costPrice;

          // Calculate days in inventory based on created_at or updated_at
          const productDate = new Date(variant.updated_at || variant.created_at || product.created_at);
          const daysInInventory = Math.floor((currentDate - productDate) / (1000 * 60 * 60 * 24));

          // Find the applicable discount based on days in inventory
          let discount = 0;
          const ranges = Object.values(discountRanges).sort((a, b) => b.days - a.days);
          for (const range of ranges) {
            if (daysInInventory >= range.days) {
              discount = range.discount;
              break;
            }
          }

          const discountedPrice = retailPrice * (1 - discount);
          const variantDiscountedValue = variant.inventory_quantity * discountedPrice;

          totalRetailValue += variantRetailValue;
          totalCostValue += variantCostValue;
          totalDiscountedValue += variantDiscountedValue;

          console.log(`Variant calculation summary:
            - Inventory quantity: ${variant.inventory_quantity}
            - Retail price: $${retailPrice}
            - Cost price: $${costPrice}
            - Days in inventory: ${daysInInventory}
            - Applied discount: ${(discount * 100).toFixed(0)}%
            - Original value: $${variantRetailValue.toFixed(2)}
            - Discounted value: $${variantDiscountedValue.toFixed(2)}
            - Running totals:
              * Total retail value: $${totalRetailValue.toFixed(2)}
              * Total cost value: $${totalCostValue.toFixed(2)}
              * Total discounted value: $${totalDiscountedValue.toFixed(2)}`);
        }
      }

      console.log('\nFinal calculation summary:');
      console.log(`Total products: ${totalProducts}`);
      console.log(`Total variants: ${totalVariants}`);
      console.log(`Total retail value: $${totalRetailValue.toFixed(2)}`);
      console.log(`Total cost value: $${totalCostValue.toFixed(2)}`);
      console.log(`Total discounted value: $${totalDiscountedValue.toFixed(2)}`);

      const summary = {
        totalProducts,
        totalVariants,
        totalRetailValue,
        totalCostValue,
        totalDiscountedValue,
        grossMargin: ((totalRetailValue - totalCostValue) / totalRetailValue * 100).toFixed(1),
        adjustedGrossMargin: ((totalDiscountedValue - totalCostValue) / totalDiscountedValue * 100).toFixed(1)
      };

      console.log('Final summary object:', JSON.stringify(summary, null, 2));

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