import mongoose from 'mongoose';
import InventoryForecast from '../models/InventoryForecast.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

async function setIgnoreInventoryOlderThanDays() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await InventoryForecast.updateMany(
      { 'configuration.ignoreInventoryOlderThanDays': { $exists: false } },
      { $set: { 'configuration.ignoreInventoryOlderThanDays': 180 } }
    );
    console.log(`Updated ${result.modifiedCount} document(s).`);
  } catch (error) {
    console.error('Error updating documents:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

setIgnoreInventoryOlderThanDays(); 