# Sales Dashboard

A real-time sales tracking dashboard for Shopify stores.

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd hello-world
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your actual values

5. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd react-dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your actual values

5. Start the development server:
   ```bash
   npm start
   ```

## Environment Variables

### Backend (.env)
- `PORT`: The port the server runs on (default: 5001)
- `FRONTEND_URL`: The URL of your frontend application
- Add any other required environment variables

### Frontend (.env)
- `REACT_APP_API_URL`: The URL of your backend API
- Add any other required environment variables

## Security Notes

- Never commit `.env` files to version control
- Keep your environment variables secure
- Use different environment variables for development and production 