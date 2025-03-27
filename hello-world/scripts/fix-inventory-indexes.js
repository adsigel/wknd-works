import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Inventory from '../backend/models/Inventory.js';

dotenv.config();

async function fixIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('Dropping all indexes...');
    await Inventory.collection.dropIndexes();
    
    console.log('Creating new indexes...');
    // This will trigger the creation of all indexes defined in the schema
    await Inventory.init();
    
    console.log('Indexes updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing indexes:', error);
    process.exit(1);
  }
}

fixIndexes(); 