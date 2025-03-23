import mongoose from 'mongoose';

const salesGoalSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true
  },
  goal: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

const SalesGoal = mongoose.model('SalesGoal', salesGoalSchema);

export default SalesGoal; 