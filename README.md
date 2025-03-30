# WKND Works Sales Dashboard

A modern sales dashboard application for tracking and visualizing daily sales data, with robust error handling and comprehensive logging.

## Features
- Daily sales tracking and visualization
- Monthly sales goals and projections
- Interactive charts and statistics
- Customizable chart settings
- Shopify integration for real-time sales data
- Comprehensive error handling and logging
- Request tracking and monitoring
- Rate limiting protection

## Project Structure
```
wknd-works/
├── client/           # Frontend React application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── features/    # Feature-specific components
│   │   ├── utils/       # Utility functions
│   │   └── __tests__/   # Frontend tests
│   └── public/
├── server/           # Backend Node.js/Express server
│   ├── src/
│   │   ├── config/      # Configuration files
│   │   ├── middleware/  # Express middleware
│   │   ├── models/      # Database models
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   ├── utils/       # Utility functions
│   │   └── __tests__/   # Backend tests
│   └── logs/           # Application logs
└── .env              # Environment variables
```

## Setup

### Prerequisites
- Node.js 18 or higher
- MongoDB 4.4 or higher
- Shopify Partner account (for API access)

### Local Development
1. Install dependencies:
```bash
npm install
```

2. Create environment files:

`.env` in project root:
```
MONGODB_URI=your_mongodb_connection_string
SHOPIFY_SHOP_NAME=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_access_token
NODE_ENV=development
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

3. Run the development servers:

```bash
# Start both client and server in development mode
npm run dev
```

## Error Handling
The application includes a comprehensive error handling system:

- Standardized error types for common scenarios
- Error categorization (validation, database, network, etc.)
- Request tracking with unique IDs
- Detailed error context preservation
- Global error handling middleware

## Logging System
Advanced logging capabilities include:

- Structured JSON logging
- Request ID tracking
- Daily rotating log files
- Separate error and combined logs
- Colorized console output in development
- Request timing and context preservation

### Log Files
- Error logs: `server/logs/error-YYYY-MM-DD.log`
- Combined logs: `server/logs/combined-YYYY-MM-DD.log`
- 14-day retention policy

## API Documentation

### Error Responses
All API errors follow this format:
```json
{
  "error": {
    "message": "Error description",
    "code": 400,
    "requestId": "unique-request-id"
  }
}
```

### Request Tracking
All requests include:
- `X-Request-ID` header in responses
- Request duration logging
- User agent and IP tracking
- Full request/response context in logs

## Development Guidelines

### Error Handling
```javascript
import { createValidationError } from '../utils/errorUtils';

// Example of proper error handling
try {
  // Your code
} catch (error) {
  throw createValidationError('Invalid input data');
}
```

### Logging
```javascript
import { logInfo, logError } from '../utils/loggingUtils';

// Example of proper logging
logInfo('Processing order', { orderId, amount });
```

## MongoDB Setup
1. Create a MongoDB Atlas account and cluster
2. In "Database Access":
   - Create a database user (e.g., `wknd_admin`)
   - Use a simple alphanumeric password (avoid special characters)
   - Grant `readWrite` permissions on the `wknd-dashboard` database

3. In "Network Access":
   - Add your local IP address for development
   - For Render deployment, whitelist these IP ranges:
     ```
     18.144.52.192/28
     3.101.52.192/28
     3.101.53.192/28
     3.101.54.192/28
     3.101.55.192/28
     3.101.56.192/28
     3.101.57.192/28
     3.101.58.192/28
     3.101.59.192/28
     3.101.60.192/28
     3.101.61.192/28
     3.101.62.192/28
     3.101.63.192/28
     216.24.60.0/24    # Additional Render outbound IP range
     ```

4. Get your connection string:
   - Click "Connect" on your cluster
   - Choose "Drivers"
   - Copy the connection string
   - Replace `<username>`, `<password>`, and add database name:
     ```
     mongodb+srv://your_username:your_password@your-cluster.mongodb.net/wknd-dashboard?retryWrites=true&w=majority
     ```

## Deployment
1. Create a new Web Service
2. Connect your repository
3. Set environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - Ensure the username, password, and database name are correct
4. Deploy the service

## Tech Stack
- Node.js/Express
- React
- MongoDB/Mongoose
- Chart.js
- Winston (logging)
- Jest (testing)
- ESLint/Prettier (code quality)

## Contributing
1. Follow the error handling guidelines
2. Include appropriate logging
3. Add tests for new features
4. Update documentation as needed

## License
[MIT License](LICENSE) 