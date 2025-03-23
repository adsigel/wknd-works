# WKND Works Sales Dashboard

A sales dashboard application for tracking and visualizing daily sales data.

## Features
- Daily sales tracking
- Monthly sales goals
- Sales projections based on daily patterns
- Visual charts and statistics
- Customizable chart settings

## Setup

### Local Development
1. Install dependencies:
```bash
cd hello-world && npm install
cd ../react-dashboard && npm install
```

2. Create `.env` files:

In `hello-world/.env`:
```
MONGODB_URI=your_mongodb_connection_string
```

3. Run the development servers:

Backend:
```bash
cd hello-world && npm run dev
```

Frontend:
```bash
cd react-dashboard && npm start
```

### MongoDB Atlas Setup
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

### Render Deployment
1. Create a new Web Service
2. Connect your repository
3. Set environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - Ensure the username, password, and database name are correct
4. Deploy the service

## Project Structure
- `hello-world/`: Backend server (Node.js/Express)
- `react-dashboard/`: Frontend application (React)

## Troubleshooting
- **MongoDB Connection Issues**:
  - Verify all Render IP ranges are whitelisted
  - Check username matches exactly (including underscores)
  - Use simple alphanumeric passwords
  - Ensure database name is included in URI
  - Verify connection string format

## Tech Stack
- Node.js
- Express
- MongoDB/Mongoose
- React
- Chart.js

## License
[MIT License](LICENSE) 