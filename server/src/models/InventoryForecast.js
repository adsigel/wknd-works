import mongoose from 'mongoose';

const inventoryForecastSchema = new mongoose.Schema({
  // Current state
  currentState: {
    totalInventoryCost: {
      type: Number,
      required: true,
      min: 0
    },
    totalRetailValue: {
      type: Number,
      required: true,
      min: 0
    },
    totalDiscountedValue: {
      type: Number,
      required: true,
      min: 0
    },
    lastUpdated: {
      type: Date,
      required: true
    }
  },
  
  // Configuration
  configuration: {
    forecastPeriodWeeks: {
      type: Number,
      required: true,
      default: 12,
      min: 1
    },
    minimumWeeksBuffer: {
      type: Number,
      required: true,
      default: 6,
      min: 1
    },
    leadTimeWeeks: {
      type: Number,
      required: true,
      default: 2,
      min: 1
    }
  },
  
  // Forecast data
  weeklyProjections: [{
    weekStart: {
      type: Date,
      required: true
    },
    projectedSales: {
      type: Number,
      required: true,
      min: 0
    },
    endingRetailValue: {
      type: Number,
      required: true,
      min: 0
    },
    endingDiscountedValue: {
      type: Number,
      required: true,
      min: 0
    },
    isBelowThreshold: {
      type: Boolean,
      required: true,
      default: false
    }
  }],
  
  // Inventory age data
  inventoryData: [{
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    quantity: {
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
    lastReceivedDate: {
      type: Date,
      required: true
    },
    age: {
      type: Number,
      required: true,
      min: 0
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient querying
inventoryForecastSchema.index({ 'weeklyProjections.weekStart': 1 });
inventoryForecastSchema.index({ 'currentState.lastUpdated': 1 });
inventoryForecastSchema.index({ 'inventoryData.lastReceivedDate': 1 });

// Virtual for getting the latest projection
inventoryForecastSchema.virtual('latestProjection').get(function() {
  if (!this.weeklyProjections || this.weeklyProjections.length === 0) {
    return null;
  }
  return this.weeklyProjections[this.weeklyProjections.length - 1];
});

// Method to check if inventory needs refresh
inventoryForecastSchema.methods.needsRefresh = function() {
  const ONE_HOUR = 60 * 60 * 1000;
  return Date.now() - this.currentState.lastUpdated.getTime() > ONE_HOUR;
};

// Method to calculate discounted value based on age
inventoryForecastSchema.methods.calculateDiscountedValue = function(value, ageInDays) {
  if (ageInDays <= 30) return value;
  if (ageInDays <= 60) return value * 0.85; // 15% discount
  if (ageInDays <= 90) return value * 0.75; // 25% discount
  return value * 0.60; // 40% discount
};

const InventoryForecast = mongoose.model('InventoryForecast', inventoryForecastSchema);

export default InventoryForecast; 