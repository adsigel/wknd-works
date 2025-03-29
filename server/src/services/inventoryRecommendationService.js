import Inventory from '../models/Inventory.js';
import shopifyService from './shopifyService.js';

class InventoryRecommendationService {
  constructor() {
    this.SAFETY_STOCK_FACTOR = 1.2; // 20% buffer
    this.LEAD_TIME_DAYS = 14; // Default lead time for reordering
  }

  /**
   * Calculate recommended purchase quantity based on:
   * - Sales goals
   * - Current inventory
   * - Historical sales rate
   * - Seasonality
   * - Lead time
   */
  async calculateRecommendedPurchase(productId, salesGoal, monthsToConsider = 3) {
    try {
      const inventory = await Inventory.findOne({ productId });
      if (!inventory) {
        throw new Error('Product not found in inventory');
      }

      // Update average daily sales rate
      await inventory.updateAverageDailySales(30); // Consider last 30 days

      // Get seasonality factor for upcoming months
      const upcomingSeasonality = this._calculateUpcomingSeasonality(inventory, monthsToConsider);
      
      // Calculate projected daily sales rate based on sales goal and seasonality
      const projectedDailySales = (salesGoal / 30) * upcomingSeasonality;
      
      // Calculate total needed inventory for coverage period
      const coveragePeriodDays = 30 * monthsToConsider;
      const totalNeededInventory = Math.ceil(
        projectedDailySales * coveragePeriodDays * this.SAFETY_STOCK_FACTOR
      );

      // Calculate recommended purchase quantity
      const recommendedQuantity = Math.max(
        0,
        totalNeededInventory - inventory.currentStock
      );

      // Update inventory with recommendation
      inventory.recommendedPurchaseQuantity = recommendedQuantity;
      inventory.lastRecommendationDate = new Date();
      await inventory.save();

      return {
        productId,
        currentStock: inventory.currentStock,
        recommendedQuantity,
        projectedDailySales,
        daysOfInventoryRemaining: inventory.daysOfInventoryRemaining,
        seasonalityFactor: upcomingSeasonality,
        calculationDate: new Date()
      };
    } catch (error) {
      console.error('Error calculating purchase recommendation:', error);
      throw error;
    }
  }

  /**
   * Calculate the average seasonality factor for upcoming months
   */
  _calculateUpcomingSeasonality(inventory, monthsToConsider) {
    const upcomingMonths = [];
    const currentDate = new Date();
    
    for (let i = 0; i < monthsToConsider; i++) {
      const month = (currentDate.getMonth() + i) % 12 + 1;
      upcomingMonths.push(month);
    }

    const seasonalityFactors = upcomingMonths.map(month => 
      inventory.seasonalityFactors.get(month.toString()) || 1
    );

    return seasonalityFactors.reduce((sum, factor) => sum + factor, 0) / seasonalityFactors.length;
  }

  /**
   * Sync inventory data with Shopify
   */
  async syncWithShopify(locationId) {
    try {
      // Get current inventory levels from Shopify
      const [products, inventoryLevels] = await Promise.all([
        shopifyService.getProducts(),
        shopifyService.getInventoryLevels(locationId)
      ]);

      // Update local inventory records
      for (const product of products) {
        const inventoryLevel = inventoryLevels.find(
          level => level.inventory_item_id === product.variant.inventory_item_id
        );

        if (inventoryLevel) {
          await Inventory.findOneAndUpdate(
            { shopifyProductId: product.id },
            {
              $set: {
                name: product.title,
                currentStock: inventoryLevel.available,
                lastUpdated: new Date()
              }
            },
            { upsert: true }
          );
        }
      }

      return {
        success: true,
        message: `Synced ${products.length} products`,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error syncing with Shopify:', error);
      throw error;
    }
  }

  /**
   * Update seasonality factors based on historical data
   */
  async updateSeasonalityFactors(productId, monthsOfHistory = 12) {
    try {
      const inventory = await Inventory.findOne({ productId });
      if (!inventory) {
        throw new Error('Product not found in inventory');
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsOfHistory);

      // Get historical orders
      const orders = await shopifyService.getOrdersWithinDateRange(startDate, endDate);
      
      // Calculate monthly sales volumes
      const monthlySales = new Map();
      orders.forEach(order => {
        const month = new Date(order.created_at).getMonth() + 1;
        order.line_items.forEach(item => {
          if (item.product_id === inventory.shopifyProductId) {
            monthlySales.set(
              month,
              (monthlySales.get(month) || 0) + item.quantity
            );
          }
        });
      });

      // Calculate average monthly sales
      const totalSales = Array.from(monthlySales.values()).reduce((sum, sales) => sum + sales, 0);
      const avgMonthlySales = totalSales / monthsOfHistory;

      // Update seasonality factors
      monthlySales.forEach((sales, month) => {
        const seasonalityFactor = sales / avgMonthlySales;
        inventory.seasonalityFactors.set(month.toString(), seasonalityFactor);
      });

      await inventory.save();

      return {
        productId,
        seasonalityFactors: Object.fromEntries(inventory.seasonalityFactors),
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Error updating seasonality factors:', error);
      throw error;
    }
  }
}

export default new InventoryRecommendationService(); 