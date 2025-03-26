import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const SHOP = `${process.env.SHOPIFY_SHOP_NAME}.myshopify.com`;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

if (!process.env.SHOPIFY_SHOP_NAME || !process.env.SHOPIFY_ACCESS_TOKEN) {
  throw new Error('Missing required environment variables: SHOPIFY_SHOP_NAME and SHOPIFY_ACCESS_TOKEN');
}

function formatDate(date) {
    return date.toISOString(); // Returns the date in the correct format (e.g. 2024-01-15T12:00:00.000Z)
}

async function createOrder(orderDate) {
    const orderData = {
        order: {
            email: "Russel.winfield@example.com",
            financial_status: "paid",
            fulfillment_status: "fulfilled",
            created_at: new Date(orderDate).toISOString(), // Ensure UTC format
            line_items: [
                {
                    variant_id: 51840891126127,
                    quantity: 1
                }
            ],
            customer: {
                id: 23048875802991
            },
            currency: "USD",
            total_price: "699.95"
        }
    };

    try {
        const response = await axios.post(
            `https://${SHOP}/admin/api/2024-01/orders.json`,
            orderData,
            {
                headers: {
                    "X-Shopify-Access-Token": ACCESS_TOKEN,
                    "Content-Type": "application/json"
                }
            }
        );
        console.log("Order created:", response.data.order.id, "on", response.data.order.created_at);
    } catch (error) {
        console.error("Error creating order:", error.response?.data || error.message);
    }
}

// Function to generate multiple orders with sequential dates starting from March 1st
async function createMultipleOrders(count) {
    let currentDate = new Date("2025-03-26"); // Start on March 1st, 2025

    for (let i = 0; i < count; i++) {
        const orderDate = currentDate.toISOString(); // Format as ISO string for Shopify API
        await createOrder(orderDate); // Pass formatted date to order function
        currentDate.setDate(currentDate.getDate() + 1); // Increment by 1 day
    }
}

createMultipleOrders(5); // Generate 5 orders starting from March 1st, 2025