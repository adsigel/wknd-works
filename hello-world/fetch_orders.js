import axios from 'axios';

const SHOP = process.env.SHOP;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

function getMonthRange(year, month) {
    const firstDay = new Date(Date.UTC(year, month - 1, 1)); // First day of month in UTC
    const lastDay = new Date(Date.UTC(year, month, 0, 23, 59, 59)); // Last day of month in UTC
    return { firstDay, lastDay };
}

// Function to fetch orders for a specific month
// Fetch orders from Shopify API
async function fetchOrders(year, month) {
    const { firstDay, lastDay } = getMonthRange(year, month);
    let allOrders = [];
    let hasNextPage = true;
    let pageInfo = null;

    try {
        while (hasNextPage) {
            const response = await axios.get(
                `https://${process.env.SHOP}/admin/api/2024-01/orders.json`,
                {
                    headers: {
                        "X-Shopify-Access-Token": process.env.ACCESS_TOKEN,
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
        console.error('Error fetching orders:', error.response?.data || error.message);
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

// Function to process orders and generate a report with cumulative projected daily sales
export async function calculateCumulativeSales(year, month, monthSalesGoal) {
    const { firstDay, lastDay } = getMonthRange(year, month);
    const orders = await fetchOrders(year, month);

    // console.log("Received monthSalesGoal:", monthSalesGoal);

    // Initialize daily sales for every day in the month
    let dailySales = {};
    for (let d = new Date(firstDay); d <= lastDay; d.setUTCDate(d.getUTCDate() + 1)) {
        let dateStr = d.toISOString().split("T")[0]; 
        dailySales[dateStr] = 0;  // ✅ Ensures every date exists
    }


    // Process orders and map them to the correct date
    orders.forEach((order) => {
        const orderDateUTC = new Date(order.processed_at); // Ensure this is defined
        const orderDateStr = orderDateUTC.toISOString().split("T")[0]; // YYYY-MM-DD
    
        if (!dailySales[orderDateStr]) {
            dailySales[orderDateStr] = 0; // Set a default value if it's missing
        }
        dailySales[orderDateStr] += parseFloat(order.total_price);
    });    

    // Calculate the number of open days in the month (Wednesday to Sunday)
    const openDaysCount = getOpenDays(firstDay, lastDay);
    const totalSales = Object.values(dailySales).reduce((acc, sale) => acc + sale, 0); // Total sales up to this point

    // Generate and print report with cumulative sales, monthly goal, and cumulative projected daily sales
    let cumulativeSales = 0;
    let cumulativeProjectedDailySales = 0;
    // Check to see if days are missing
    console.log("Final sales data:", dailySales);
    
    let report = Object.keys(dailySales).map((date) => {
        const dailySale = dailySales[date] || 0;
        cumulativeSales += dailySale;

        // Log the cumulative sales after each date is processed
        console.log(`Date: ${date}, Cumulative Sales after: ${cumulativeSales}`);
    
        if (isNaN(cumulativeSales)) {
            console.error(`Invalid cumulativeSales value: ${cumulativeSales}`);
            cumulativeSales = 0;
        }
    
        if (isNaN(monthSalesGoal)) {
            console.error(`Invalid monthSalesGoal value: ${monthSalesGoal}`);
            monthSalesGoal = 0;
        }
    
        const dayOfWeek = new Date(date).getUTCDay();
        if (dayOfWeek >= 3 && dayOfWeek <= 6) { // Wednesday (3) to Sunday (6)
            cumulativeProjectedDailySales += monthSalesGoal / openDaysCount;
        }
        
        // console.log(`Date: ${date}, Daily Sales: ${dailySale}, Cumulative Sales: ${cumulativeSales}`);       
        
        return {
            date,
            dailySales: Number(cumulativeSales.toFixed(2)),  // ✅ Now cumulative instead of daily
            cumulativeSales: Number(cumulativeSales.toFixed(2)),  
            monthSalesGoal: Number(monthSalesGoal.toFixed(2)),
            cumulativeProjectedDailySales: Number(cumulativeProjectedDailySales.toFixed(2))
        };      
    });

    // Return the generated report data
    return report;
}
