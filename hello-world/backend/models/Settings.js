import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  chartType: {
    type: String,
    enum: ['bar', 'line'],
    default: 'bar'
  },
  showProjections: {
    type: Boolean,
    default: true
  },
  darkMode: {
    type: Boolean,
    default: false
  },
  currency: {
    type: String,
    default: 'USD'
  },
  timezone: {
    type: String,
    default: 'America/Los_Angeles'
  },
  refreshInterval: {
    type: Number,
    default: 5 // minutes
  }
}, {
  timestamps: true
});

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings; 