import mongoose from 'mongoose';

const inventoryScenarioSchema = new mongoose.Schema({
  scenarioType: {
    type: String,
    enum: ['conservative', 'base', 'optimistic'],
    required: true,
    unique: true // Only one of each type
  },
  haircutType: {
    type: String,
    enum: ['percent', 'dollar'],
    required: true,
  },
  haircutValue: {
    type: Number, // percent as decimal (e.g., 0.2 for 20%) or dollar amount
    required: true,
    min: 0,
  },
  grossMargin: {
    type: Number, // as decimal (e.g., 0.6 for 60%)
    required: true,
    min: 0,
    max: 1,
  },
  ignored: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true, // adds createdAt and updatedAt
});

const InventoryScenario = mongoose.model('InventoryScenario', inventoryScenarioSchema);

export default InventoryScenario;