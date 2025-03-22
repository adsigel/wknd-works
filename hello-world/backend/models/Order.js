import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  }
});

const Order = mongoose.model('Order', orderSchema);

export default Order; 