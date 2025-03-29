import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';
import salesRoutes from './routes/sales.js';
import settingsRoutes from './routes/settings.js';
import inventoryRoutes from './routes/inventory.js';
import mongoose from 'mongoose';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceDir = path.dirname(path.dirname(__dirname));

// Load environment variables
dotenv.config({ path: path.join(workspaceDir, '.env') });

const app = express();
const port = process.env.PORT || 5001;

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(limiter);

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/sales', salesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/inventory', inventoryRoutes);

// Serve static files from React build directory
const clientBuildPath = path.join(workspaceDir, 'client', 'build');
console.log('Serving static files from:', clientBuildPath);
app.use(express.static(clientBuildPath));

// Handle client-side routing
app.get('*', (req, res) => {
  // Don't redirect API routes
  if (!req.url.startsWith('/api')) {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully');
    console.log('MongoDB URI:', process.env.MONGODB_URI);
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// Add mongoose connection event handlers
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});

// Start server
async function startServer() {
  try {
    await connectDatabase();
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 