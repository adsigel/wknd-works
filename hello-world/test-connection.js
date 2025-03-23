import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables from .env file if it exists
dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb+srv://wknd_admin:your_password@wknd-works.xg6ps.mongodb.net/wknd-dashboard?retryWrites=true&w=majority";

console.log('Testing connection with URI:', uri.replace(/:([^@]+)@/, ':****@'));

async function testConnection() {
  console.log('Creating MongoDB client...');
  const client = new MongoClient(uri, {
    serverApi: {
      version: '1',
      strict: true,
      deprecationErrors: true,
    },
    tls: true,
    tlsInsecure: false,
    directConnection: false
  });
  
  try {
    console.log('Attempting to connect...');
    await client.connect();
    console.log('Connected successfully to MongoDB!');
    
    console.log('Testing database access...');
    const db = client.db('wknd-dashboard');
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    await client.close();
    console.log('Connection closed successfully');
  } catch (err) {
    console.error('Connection failed:', {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: err.stack
    });
  }
}

testConnection(); 