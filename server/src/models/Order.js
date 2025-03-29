import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  created_at: {
    type: Date,
    required: true
  },
  total_price: {
    type: Number,
    required: true
  },
  customer: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'completed'
  },
  items: [{
    product_id: String,
    quantity: Number,
    price: Number
  }]
}, {
  timestamps: true
});

const Order = mongoose.model('Order', orderSchema);

export default Order; 