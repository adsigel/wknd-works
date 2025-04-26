import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://wknd_admin:wkndadmin123@wknd-works.xg6ps.mongodb.net/?retryWrites=true&w=majority&appName=wknd-works';

async function testConnection() {
  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('Connection string:', MONGODB_URI);
    
    // Set up mongoose debug mode to see more detailed connection info
    mongoose.set('debug', true);
    
    // Log mongoose version
    console.log('Mongoose version:', mongoose.version);
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000
    });
    
    console.log('Successfully connected to MongoDB!');
    
    // Connect to the wknd-dashboard database
    const db = mongoose.connection.useDb('wknd-dashboard');
    
    // Check settings collection
    console.log('\nExamining settings collection:');
    const settings = await db.collection('settings').findOne();
    console.log('Current settings:', JSON.stringify(settings, null, 2));
    
    // Check if there are any age bucket related settings
    if (settings && settings.chartSettings) {
      console.log('\nChart settings:', JSON.stringify(settings.chartSettings, null, 2));
    }
    
    if (settings && settings.projectionSettings) {
      console.log('\nProjection settings:', JSON.stringify(settings.projectionSettings, null, 2));
    }
    
  } catch (error) {
    console.error('Connection failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      reason: error.reason,
      stack: error.stack
    });
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testConnection(); 