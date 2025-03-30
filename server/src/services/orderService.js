import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import { 
  createLocalDate, 
  formatDate, 
  getFirstDayOfMonth, 
  getLastDayOfMonth,
  getAllDatesInMonth 
} from '../utils/dateUtils.js';
import { 
  AppError, 
  createErrorResponse,
  createValidationError,
  createNotFoundError 
} from '../utils/errorUtils.js';
import { 
  validateMonth, 
  validateYear,
  validateDateString 
} from '../utils/validationUtils.js';
import { 
  logError, 
  logInfo, 
  logDebug 
} from '../utils/loggingUtils.js';
import { formatCurrency } from '../utils/formatters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceDir = path.dirname(path.dirname(path.dirname(__dirname)));

// Load environment variables
const envPath = path.join(workspaceDir, '.env');
logInfo('Loading environment variables from: ' + envPath);
dotenv.config({ path: envPath });

const shopName = process.env.SHOPIFY_SHOP_NAME;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

// Debug logging for environment variables
logDebug('Environment variables loaded:', {
  shopName: process.env.SHOPIFY_SHOP_NAME ? 'Present' : 'Missing',
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN ? 'Present' : 'Missing',
  envPath: envPath
});

// Add this function after the imports but before calculateCumulativeSales
async function testShopifyConnection() {
  try {
    logInfo('Testing Shopify connection');
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
      `https://${shopName}/admin/api/${LATEST_API_VERSION}/graphql.json`,
      { query: testQuery },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        }
      }
    );

    logInfo('Connection test successful');
    return true;
  } catch (error) {
    logError('Shopify connection error', error);
    throw new AppError('Failed to connect to Shopify API', 500);
  }
}

export async function calculateCumulativeSales(month, year) {
  // Validate inputs
  const validatedMonth = validateMonth(month);
  const validatedYear = validateYear(year);
  
  logInfo(`Calculating cumulative sales for ${validatedMonth}/${validatedYear}`);
  
  // Get date range
  const startDate = getFirstDayOfMonth(validatedYear, validatedMonth);
  const endDate = getLastDayOfMonth(validatedYear, validatedMonth);
  
  // Generate all dates for the month
  const allDates = getAllDatesInMonth(validatedYear, validatedMonth);
  
  // Initialize arrays for daily sales and amounts
  const dailySales = new Array(allDates.length).fill(0);
  const dailyAmounts = new Array(allDates.length).fill(0);
  
  // Check if Shopify credentials are available
  if (!shopName || !accessToken) {
    console.log('❌ Shopify credentials not found, using sample data');
    return generateSampleData(month, year);
  }

  try {
    // Test Shopify connection before proceeding
    await testShopifyConnection();

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
          throw new AppError('GraphQL query failed: ' + JSON.stringify(response.data.errors), 500);
        }

        const orders = response.data.data.orders.edges;
        const pageInfo = response.data.data.orders.pageInfo;

        console.log(`Processing ${orders.length} orders`);

        // Process orders
        for (const order of orders) {
          try {
            const orderDate = createLocalDate(order.node.createdAt.split('T')[0]);
            const dateIndex = allDates.indexOf(formatDate(orderDate));
            
            if (dateIndex !== -1) {
              let amount;
              if (order.node.currentTotalPriceSet?.shopMoney?.amount) {
                amount = parseFloat(order.node.currentTotalPriceSet.shopMoney.amount);
              } else {
                const subtotal = parseFloat(order.node.subtotalPriceSet?.shopMoney?.amount || 0);
                const discounts = parseFloat(order.node.totalDiscountsSet?.shopMoney?.amount || 0);
                amount = subtotal - discounts;
              }
              
              dailySales[dateIndex]++;
              dailyAmounts[dateIndex] += amount;
              logDebug(`Processed order ${order.node.id} for ${formatDate(orderDate)}: $${amount}`);
            }
          } catch (orderError) {
            logError(`Error processing order ${order.node.id}`, orderError);
            // Continue processing other orders
          }
        }

        hasNextPage = pageInfo.hasNextPage;
        cursor = pageInfo.endCursor;
      } catch (error) {
        logError('Error fetching orders from Shopify API', error);
        throw new AppError('Failed to fetch orders from Shopify API', 500);
      }
    }

    // Calculate cumulative totals
    const cumulativeSales = dailySales.reduce((sum, val) => sum + val, 0);
    const cumulativeAmount = dailyAmounts.reduce((sum, val) => sum + val, 0);

    logInfo(`Total sales for ${validatedMonth}/${validatedYear}: ${cumulativeSales} orders, ${formatCurrency(cumulativeAmount)}`);

    return {
      dailySales,
      dailyAmounts,
      cumulativeSales,
      cumulativeAmount,
      dates: allDates
    };
  } catch (error) {
    logError(`Error calculating cumulative sales: ${error.message}`, error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to calculate cumulative sales', 500);
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
    cumulativeSales: dailySales.reduce((a, b) => a + b, 0),
    cumulativeAmount: cumulativeTotal
  };
} 