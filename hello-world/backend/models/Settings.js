import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  chartSettings: {
    'Daily Sales': {
      backgroundColor: String,
      borderColor: String,
      borderWidth: Number
    },
    'Projected Sales': {
      backgroundColor: String,
      borderColor: String,
      borderWidth: Number
    },
    'Sales Goal': {
      backgroundColor: String,
      borderColor: String,
      borderWidth: Number
    }
  },
  projectionSettings: {
    Monday: Number,
    Tuesday: Number,
    Wednesday: Number,
    Thursday: Number,
    Friday: Number,
    Saturday: Number,
    Sunday: Number
  }
}, { timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings; 