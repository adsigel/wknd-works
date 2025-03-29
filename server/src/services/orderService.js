import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceDir = path.dirname(path.dirname(path.dirname(__dirname)));

// Load environment variables
const envPath = path.join(workspaceDir, '.env');
console.log('\n========== LOADING ENVIRONMENT VARIABLES ==========');
console.log('Looking for .env file at:', envPath);
dotenv.config({ path: envPath });

const shopName = process.env.SHOPIFY_SHOP_NAME;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

// Debug logging for environment variables
console.log('Environment variables loaded:', {
  shopName: process.env.SHOPIFY_SHOP_NAME ? 'Present' : 'Missing',
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN ? 'Present' : 'Missing',
  envPath: envPath
});

// Add this function after the imports but before calculateCumulativeSales
async function testShopifyConnection() {
  try {
    console.log('\n========== TESTING SHOPIFY CONNECTION ==========');
    // Simple query to test connection
    const testQuery = `{
      shop {
        name
        primaryDomain {
          url
        }
      }
    }`;

    const response = await axios.post(
      `https://${shopName}/admin/api/2024-01/graphql.json`,
      { query: testQuery },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        }
      }
    );

    console.log('Connection test successful:', JSON.stringify(response.data, null, 2));
    console.log('============================================\n');
    return true;
  } catch (error) {
    console.error('\n========== SHOPIFY CONNECTION ERROR ==========');
    console.error('Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
    if (error.response?.data) {
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('============================================\n');
    return false;
  }
}

export async function calculateCumulativeSales(month, year) {
  try {
    // Debug logging for environment variables - made more prominent
    console.log('\n========== SHOPIFY CREDENTIALS CHECK ==========');
    console.log('ENV File Path:', envPath);
    console.log('Shop Name:', shopName || 'MISSING');
    console.log('Access Token:', accessToken ? 'Present (Hidden)' : 'MISSING');
    console.log('============================================\n');

    // Check if Shopify credentials are available
    if (!shopName || !accessToken) {
      console.log('❌ Shopify credentials not found, using sample data');
      return generateSampleData(month, year);
    }

    // Test Shopify connection before proceeding
    const isConnected = await testShopifyConnection();
    if (!isConnected) {
      console.log('❌ Shopify connection test failed, using sample data');
      return generateSampleData(month, year);
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of the month
    
    console.log('Calculating sales for period:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    // Initialize arrays for the entire month
    const daysInMonth = endDate.getDate();
    const dates = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month - 1, i + 1);
      // Format date as YYYY-MM-DD without timezone conversion
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    });
    const dailySales = new Array(daysInMonth).fill(0);
    const dailyAmounts = new Array(daysInMonth).fill(0);

    // Updated GraphQL query for 2024-01 API version
    const query = `{
      orders(
        first: 250,
        query: "created_at:>='${startDate.toISOString()}' AND created_at:<='${endDate.toISOString()}' AND financial_status:paid"
      ) {
        edges {
          node {
            id
            createdAt
            currentTotalPriceSet {
              shopMoney {
                amount
              }
            }
            subtotalPriceSet {
              shopMoney {
                amount
              }
            }
            totalDiscountsSet {
              shopMoney {
                amount
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }`;

    let hasNextPage = true;
    let cursor = null;

    while (hasNextPage) {
      try {
        console.log('\n========== MAKING SHOPIFY API REQUEST ==========');
        console.log('Request URL:', `https://${shopName}/admin/api/2024-01/graphql.json`);
        
        const response = await axios.post(
          `https://${shopName}/admin/api/2024-01/graphql.json`,
          {
            query: cursor ? query.replace('first: 250', `first: 250, after: "${cursor}"`) : query
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': accessToken
            }
          }
        );

        if (response.data.errors) {
          console.error('GraphQL errors:', response.data.errors);
          throw new Error('GraphQL query failed: ' + JSON.stringify(response.data.errors));
        }

        const orders = response.data.data.orders.edges;
        const pageInfo = response.data.data.orders.pageInfo;

        console.log(`Processing ${orders.length} orders`);

        // Process orders
        orders.forEach(({ node }) => {
          // Create a local date from the ISO string
          const orderDate = new Date(node.createdAt);
          // Get the day of the month (1-based) and convert to array index (0-based)
          const dayIndex = orderDate.getDate() - 1;
          
          let amount;
          if (node.currentTotalPriceSet?.shopMoney?.amount) {
            amount = parseFloat(node.currentTotalPriceSet.shopMoney.amount);
          } else {
            const subtotal = parseFloat(node.subtotalPriceSet?.shopMoney?.amount || 0);
            const discounts = parseFloat(node.totalDiscountsSet?.shopMoney?.amount || 0);
            amount = subtotal - discounts;
          }
          
          // Log each order's date calculation
          console.log('Processing order:', {
            createdAt: node.createdAt,
            localDate: orderDate.toLocaleString(),
            dayIndex,
            amount
          });
          
          dailySales[dayIndex]++;
          dailyAmounts[dayIndex] += amount;
        });

        hasNextPage = pageInfo.hasNextPage;
        cursor = pageInfo.endCursor;
      } catch (error) {
        console.error('\n========== SHOPIFY API ERROR ==========');
        console.error('Error details:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
        });
        if (error.response?.data) {
          console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
        }
        console.error('========================================\n');
        throw error;
      }
    }

    // Calculate cumulative totals
    let cumulativeTotal = 0;
    const cumulativeAmounts = dailyAmounts.map(amount => {
      cumulativeTotal += amount;
      return parseFloat(cumulativeTotal.toFixed(2)); // Fix to 2 decimal places
    });

    // Calculate total sales and amounts
    const totalSales = dailySales.reduce((sum, count) => sum + count, 0);
    const totalAmount = parseFloat(dailyAmounts.reduce((sum, amount) => sum + amount, 0).toFixed(2));

    console.log('\n========== FINAL SALES DATA ==========');
    console.log('Daily Sales:', dailySales);
    console.log('Daily Amounts:', dailyAmounts.map(amount => parseFloat(amount.toFixed(2))));
    console.log('Cumulative Amounts:', cumulativeAmounts);
    console.log('Total Sales:', totalSales);
    console.log('Total Amount:', totalAmount);
    console.log('======================================\n');

    return {
      dates,
      dailySales,
      dailyAmounts: dailyAmounts.map(amount => parseFloat(amount.toFixed(2))),
      cumulativeAmounts
    };
  } catch (error) {
    console.error('Error calculating cumulative sales:', error);
    console.log('Falling back to sample data');
    return generateSampleData(month, year);
  }
}

function generateSampleData(month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, i) => 
    new Date(year, month - 1, i + 1).toISOString().split('T')[0]
  );
  
  // Generate realistic-looking sample data
  const dailySales = Array.from({ length: daysInMonth }, () => 
    Math.floor(Math.random() * 10) + 1
  );
  
  const dailyAmounts = dailySales.map(sales => 
    sales * (Math.random() * 100 + 50)
  );
  
  let cumulativeTotal = 0;
  const cumulativeAmounts = dailyAmounts.map(amount => {
    cumulativeTotal += amount;
    return cumulativeTotal;
  });
  
  return {
    dates,
    dailySales,
    dailyAmounts,
    cumulativeAmounts
  };
} 