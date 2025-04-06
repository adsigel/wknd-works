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
  },
  chartSettings: {
    type: Object,
    default: {
      'Daily Sales': {
        backgroundColor: 'rgba(44, 61, 47, 0.6)',
        borderColor: 'rgba(44, 61, 47, 1)',
        borderWidth: 1
      },
      'Projected Sales': {
        backgroundColor: 'rgba(210, 129, 95, 0.2)',
        borderColor: 'rgba(210, 129, 95, 1)',
        borderWidth: 2
      },
      'Sales Goal': {
        backgroundColor: 'rgba(143, 171, 158, 0.2)',
        borderColor: 'rgba(143, 171, 158, 1)',
        borderWidth: 3
      }
    }
  },
  projectionSettings: {
    type: Object,
    default: {
      'Monday': 10,
      'Tuesday': 20,
      'Wednesday': 10,
      'Thursday': 20,
      'Friday': 10,
      'Saturday': 5,
      'Sunday': 25
    }
  }
}, {
  timestamps: true
});

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings; 