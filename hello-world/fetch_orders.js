import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

function getMonthRange(year, month) {
    const firstDay = new Date(Date.UTC(year, month - 1, 1)); // First day of month in UTC
    const lastDay = new Date(Date.UTC(year, month, 0, 23, 59, 59)); // Last day of month in UTC
    return { firstDay, lastDay };
}

// Function to fetch orders for a specific month
async function fetchOrders(year, month) {
    // Check credentials before making API call
    const SHOPIFY_SHOP_NAME = process.env.SHOPIFY_SHOP_NAME;
    const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!SHOPIFY_SHOP_NAME || !SHOPIFY_ACCESS_TOKEN) {
        throw new Error('Missing required environment variables: SHOPIFY_SHOP_NAME and SHOPIFY_ACCESS_TOKEN');
    }

    const { firstDay, lastDay } = getMonthRange(year, month);
    let allOrders = [];
    let hasNextPage = true;
    let pageInfo = null;

    try {
        console.log('Fetching orders with parameters:', {
            shop: SHOPIFY_SHOP_NAME,
            firstDay: firstDay.toISOString(),
            lastDay: lastDay.toISOString(),
            accessToken: SHOPIFY_ACCESS_TOKEN ? 'Set' : 'Not set'
        });

        while (hasNextPage) {
            // Ensure shop name doesn't include the full URL if it was provided
            const cleanShopName = SHOPIFY_SHOP_NAME.replace(/\.myshopify\.com$/, '');
            const url = `https://${cleanShopName}.myshopify.com/admin/api/2024-01/orders.json`;
            console.log('Making request to:', url);
            
            const response = await axios.get(
                url,
                {
                    headers: {
                        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                    },
                    params: {
                        processed_at_min: firstDay.toISOString(),
                        processed_at_max: lastDay.toISOString(),
                        status: "any",
                        limit: 250,
                        ...(pageInfo && { page_info: pageInfo }),
                    },
                }
            );

            const orders = response.data.orders;
            allOrders = [...allOrders, ...orders];

            // Check for pagination
            const linkHeader = response.headers['link'];
            if (linkHeader && linkHeader.includes('rel="next"')) {
                pageInfo = linkHeader.match(/page_info=([^&>]*)/)[1];
                hasNextPage = true;
            } else {
                hasNextPage = false;
            }

            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`Fetched ${allOrders.length} orders for ${year}-${month}`);
        return allOrders;
    } catch (error) {
        console.error('Error fetching orders:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            url: error.config?.url,
            headers: error.config?.headers
        });
        throw new Error(`Failed to fetch orders: ${error.message}`);
    }
}

// Function to get the number of open days (Wednesday through Sunday)
function getOpenDays(firstDay, lastDay) {
    let openDaysCount = 0;
    let currentDate = new Date(firstDay);

    while (currentDate <= lastDay) {
        const dayOfWeek = currentDate.getUTCDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday, ..., 6 = Saturday
        if (dayOfWeek >= 3 && dayOfWeek <= 6) { // Check for Wednesday (3) to Sunday (6)
            openDaysCount++;
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return openDaysCount;
}

// Replace with:
function generateMockData() {
  const dailySales = [];
  const dates = [];
  const daysInMonth = new Date(2025, 3, 0).getDate(); // March 2025
  let cumulativeSum = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(2025, 2, day)); // March is 2 (0-based)
    const dayOfWeek = date.getUTCDay();
    
    let dailyAmount;
    // March 19th should be exactly $4,808.20
    if (day === 19) {
      dailyAmount = 4808.20;
    } else {
      // Generate random sales between $400 and $800
      // Higher sales on weekends
      dailyAmount = dayOfWeek === 0 || dayOfWeek === 6 ? 
        Math.random() * 400 + 600 : // $600-1000 on weekends
        Math.random() * 300 + 400;  // $400-700 on weekdays
      dailyAmount = Number(dailyAmount.toFixed(2));
    }
    cumulativeSum += dailyAmount;
    dailySales.push(cumulativeSum);
    dates.push(date.toISOString().split('T')[0]);
  }

  return {
    dailySales,
    dates,
    salesGoal: 8500,
    projectedSales: generateProjectedSales(daysInMonth)
  };
}

// Helper function to generate projected sales based on distribution
function generateProjectedSales(daysInMonth) {
  const projectedSales = [];
  let cumulative = 0;
  const monthlyGoal = 8500;
  
  // Default distribution if none set - will be overridden by Settings
  const defaultDistribution = {
    0: 0.2,  // Sunday
    1: 0,    // Monday
    2: 0,    // Tuesday
    3: 0.2,  // Wednesday
    4: 0.2,  // Thursday
    5: 0.2,  // Friday
    6: 0.2   // Saturday
  };

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(2025, 2, day));
    const dayOfWeek = date.getUTCDay();
    
    // Use the distribution percentage for this day of week
    const dayShare = defaultDistribution[dayOfWeek];
    if (dayShare > 0) {
      // Calculate this day's contribution to the monthly goal
      const dailyAmount = (monthlyGoal * dayShare);
      cumulative += dailyAmount;
    }
    projectedSales.push(Number(cumulative.toFixed(2)));
  }

  return projectedSales;
}

export async function calculateCumulativeSales(month) {
  try {
    // Check if we have Shopify credentials
    if (!process.env.SHOPIFY_SHOP_NAME || !process.env.SHOPIFY_ACCESS_TOKEN) {
      throw new Error('Missing Shopify credentials');
    }

    const currentYear = new Date().getFullYear();
    const orders = await fetchOrders(currentYear, month);
    const { firstDay, lastDay } = getMonthRange(currentYear, month);

    // Initialize daily sales for every day in the month
    let dailySales = {};
    for (let d = new Date(firstDay); d <= lastDay; d.setUTCDate(d.getUTCDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      dailySales[dateStr] = 0;  // Initialize all days to 0
    }

    // Process orders and map them to the correct date
    orders.forEach((order) => {
      const orderDateUTC = new Date(order.processed_at);
      const orderDateStr = orderDateUTC.toISOString().split("T")[0];
      if (dailySales.hasOwnProperty(orderDateStr)) {
        dailySales[orderDateStr] += parseFloat(order.total_price);
      }
    });

    // Convert to arrays and calculate cumulative
    const dates = [];
    const salesArray = [];
    const dailyAmounts = [];
    let cumulative = 0;

    // Sort the dates to ensure chronological order
    const sortedDates = Object.keys(dailySales).sort();
    
    sortedDates.forEach(date => {
      dates.push(date);
      const dailyAmount = dailySales[date];
      dailyAmounts.push(Number(dailyAmount.toFixed(2)));
      cumulative += dailyAmount;
      salesArray.push(Number(cumulative.toFixed(2)));
    });

    // Generate projected sales based on the actual month's data
    const projectedSales = Array(sortedDates.length).fill(8500);

    return {
      dates,
      dailySales: salesArray, // Return cumulative amounts for the chart
      dailyAmounts, // Add daily amounts for the tooltip
      salesGoal: 8500,
      projectedSales
    };

  } catch (error) {
    console.error('Error in calculateCumulativeSales:', error);
    throw error; // Let the frontend handle the error
  }
}
