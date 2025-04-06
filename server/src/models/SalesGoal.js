import mongoose from 'mongoose';

const salesGoalSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  goal: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

// Create a compound index on date to ensure unique goals per month
salesGoalSchema.index({ date: 1 }, { unique: true });

const SalesGoal = mongoose.model('SalesGoal', salesGoalSchema);

export default SalesGoal; 