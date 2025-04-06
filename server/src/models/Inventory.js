import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    index: true
  },
  shopifyProductId: {
    type: String,
    required: true
  },
  variant: {
    id: {
      type: String,
      required: true
    },
    title: String,
    sku: String
  },
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  currentStock: {
    type: Number,
    required: true,
    min: 0
  },
  retailPrice: {
    type: Number,
    required: true,
    min: 0
  },
  costPrice: {
    type: Number,
    required: true,
    min: 0
  },
  // Factors for value calculation
  discountFactor: {
    type: Number,
    required: true,
    default: 1.0, // 1.0 = no discount, 0.8 = 20% discount
    min: 0,
    max: 1
  },
  shrinkageFactor: {
    type: Number,
    required: true,
    default: 0.98, // 0.98 = 2% loss rate
    min: 0,
    max: 1
  },
  reorderPoint: {
    type: Number,
    min: 0,
    default: 0
  },
  optimalStock: {
    type: Number,
    min: 0,
    default: 0
  },
  lastUpdated: {
    type: Date,
    required: true,
    default: Date.now
  },
  lastReceivedDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  historicalMovement: [{
    date: Date,
    quantity: Number,
    type: {
      type: String,
      enum: ['sale', 'restock', 'adjustment', 'shrinkage']
    },
    price: Number // Price at time of movement
  }],
  seasonalityFactors: {
    type: Map,
    of: Number,
    default: new Map()
  },
  averageDailySales: {
    type: Number,
    default: 0
  },
  lastRecommendationDate: Date,
  recommendedPurchaseQuantity: Number
});

// Add compound index for product and variant
inventorySchema.index({ shopifyProductId: 1, 'variant.id': 1 }, { unique: true });

// Add indexes for common queries
inventorySchema.index({ category: 1 });
inventorySchema.index({ lastUpdated: 1 });
inventorySchema.index({ lastReceivedDate: 1 }); // Add index for lastReceivedDate

// Virtual for days of inventory remaining
inventorySchema.virtual('daysOfInventoryRemaining').get(function() {
  return this.averageDailySales > 0 ? Math.floor(this.currentStock / this.averageDailySales) : null;
});

// Virtual for current retail value
inventorySchema.virtual('currentRetailValue').get(function() {
  return this.currentStock * this.retailPrice * this.discountFactor * this.shrinkageFactor;
});

// Virtual for current cost value
inventorySchema.virtual('currentCostValue').get(function() {
  return this.currentStock * this.costPrice * this.shrinkageFactor;
});

// Virtual for potential profit
inventorySchema.virtual('potentialProfit').get(function() {
  return this.currentRetailValue - this.currentCostValue;
});

// Method to calculate if reorder is needed
inventorySchema.methods.needsReorder = function() {
  return this.currentStock <= this.reorderPoint;
};

// Method to update average daily sales
inventorySchema.methods.updateAverageDailySales = function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const relevantMovements = this.historicalMovement
    .filter(movement => 
      movement.type === 'sale' && 
      movement.date >= cutoffDate
    );

  if (relevantMovements.length > 0) {
    const totalSales = relevantMovements.reduce((sum, movement) => sum + Math.abs(movement.quantity), 0);
    this.averageDailySales = totalSales / days;
  }
};

// Static method to get total inventory value
inventorySchema.statics.getTotalInventoryValue = async function() {
  const inventories = await this.find();
  return {
    totalRetailValue: inventories.reduce((sum, inv) => sum + inv.currentRetailValue, 0),
    totalCostValue: inventories.reduce((sum, inv) => sum + inv.currentCostValue, 0),
    totalPotentialProfit: inventories.reduce((sum, inv) => sum + inv.potentialProfit, 0),
    byCategory: await this.aggregate([
      {
        $group: {
          _id: '$category',
          retailValue: { 
            $sum: { 
              $multiply: [
                '$currentStock', 
                '$retailPrice',
                '$discountFactor',
                '$shrinkageFactor'
              ] 
            }
          },
          costValue: {
            $sum: {
              $multiply: [
                '$currentStock',
                '$costPrice',
                '$shrinkageFactor'
              ]
            }
          },
          itemCount: { $sum: 1 },
          totalUnits: { $sum: '$currentStock' }
        }
      }
    ])
  };
};

const Inventory = mongoose.model('Inventory', inventorySchema);

export default Inventory; 