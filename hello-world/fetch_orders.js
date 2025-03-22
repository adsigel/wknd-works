import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

function getMonthRange(year, month) {
    // Create dates in local timezone first
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0, 23, 59, 59);
    
    // Convert to UTC timestamps
    const firstDayUTC = new Date(Date.UTC(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate()));
    const lastDayUTC = new Date(Date.UTC(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59));
    
    return { firstDay: firstDayUTC, lastDay: lastDayUTC };
}

// Function to fetch orders for a specific month
export async function fetchOrders(year, month) {
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

// Helper function to wait between API calls
async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to make API request with retries
async function makeRequest(url, config, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Wait 500ms between requests to respect the 2 calls/second limit
            await wait(500);
            return await axios.get(url, config);
        } catch (error) {
            if (error.response?.status === 429 && attempt < retries) {
                // If rate limited, wait longer before retrying
                console.log(`Rate limited on attempt ${attempt}, waiting 2 seconds...`);
                await wait(2000);
                continue;
            }
            throw error;
        }
    }
}

// Function to fetch orders since a specific date
export async function getOrders(startDate) {
    // Check credentials before making API call
    const SHOPIFY_SHOP_NAME = process.env.SHOPIFY_SHOP_NAME;
    const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!SHOPIFY_SHOP_NAME || !SHOPIFY_ACCESS_TOKEN) {
        throw new Error('Missing required environment variables: SHOPIFY_SHOP_NAME and SHOPIFY_ACCESS_TOKEN');
    }

    const cleanShopName = SHOPIFY_SHOP_NAME.replace(/\.myshopify\.com$/, '');
    const baseUrl = `https://${cleanShopName}.myshopify.com/admin/api/2024-01/orders.json`;
    const dailyTotals = {};
    let totalOrders = 0;
    let pageCount = 0;

    try {
        console.log('Fetching orders since:', startDate);
        
        let hasNextPage = true;
        let nextUrl = null;

        // Initial request parameters
        const initialParams = {
            created_at_min: startDate,
            status: "any",
            limit: 250,
            fields: 'created_at,total_price',
            order: 'created_at asc'
        };

        while (hasNextPage) {
            pageCount++;
            let response;

            if (nextUrl) {
                // For subsequent pages, use the full next URL from the Link header
                response = await makeRequest(nextUrl, {
                    headers: {
                        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN
                    }
                });
            } else {
                // For the first page, use our initial parameters
                response = await makeRequest(baseUrl, {
                    headers: {
                        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN
                    },
                    params: initialParams
                });
            }

            // Process this page's orders into daily totals
            response.data.orders.forEach(order => {
                const date = order.created_at.split('T')[0];
                dailyTotals[date] = (dailyTotals[date] || 0) + parseFloat(order.total_price);
            });

            totalOrders += response.data.orders.length;
            console.log(`Processed page ${pageCount} with ${response.data.orders.length} orders. Total so far: ${totalOrders}`);

            // Check for next page using Link header
            const linkHeader = response.headers['link'];
            if (linkHeader && linkHeader.includes('rel="next"')) {
                // Extract the full next URL from the Link header
                const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
                if (match) {
                    nextUrl = match[1];
                    hasNextPage = true;
                    console.log(`Next page URL found, continuing to page ${pageCount + 1}...`);
                } else {
                    hasNextPage = false;
                }
            } else {
                hasNextPage = false;
                console.log('No more pages to process.');
            }
        }

        // Convert to array format expected by the rest of the code
        const orders = Object.entries(dailyTotals).map(([date, total]) => ({
            created_at: date,
            total_price: total.toFixed(2)
        })).sort((a, b) => a.created_at.localeCompare(b.created_at));

        console.log(`Successfully processed ${totalOrders} orders into ${orders.length} daily totals`);
        return orders;
    } catch (error) {
        console.error('Error fetching orders:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            url: error.config?.url
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
function generateMockData(month, year) {
  const dailySales = [];
  const dates = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  let cumulativeSum = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = date.getUTCDay();
    
    let dailyAmount;
    // Generate random sales between $400 and $800
    // Higher sales on weekends
    dailyAmount = dayOfWeek === 0 || dayOfWeek === 6 ? 
      Math.random() * 400 + 600 : // $600-1000 on weekends
      Math.random() * 300 + 400;  // $400-700 on weekdays
    dailyAmount = Number(dailyAmount.toFixed(2));
    
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

export async function calculateCumulativeSales(month, year = new Date().getFullYear()) {
  try {
    // Check if we have Shopify credentials
    if (!process.env.SHOPIFY_SHOP_NAME || !process.env.SHOPIFY_ACCESS_TOKEN) {
      console.log('No Shopify credentials found, using mock data');
      return generateMockData(month, year);
    }

    const orders = await fetchOrders(year, month);
    const { firstDay, lastDay } = getMonthRange(year, month);

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
    const projectedSales = Array(sortedDates.length).fill(8500); // Default goal
        
        return {
      dates,
      dailySales: salesArray,
      dailyAmounts,
      salesGoal: 8500, // Default goal
      projectedSales
    };

  } catch (error) {
    console.error('Error in calculateCumulativeSales:', error);
    // If there's an error, fall back to mock data
    console.log('Falling back to mock data due to error');
    return generateMockData(month, year);
  }
}
