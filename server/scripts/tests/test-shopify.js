import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function testShopifyConnection() {
    const SHOPIFY_SHOP_NAME = process.env.SHOPIFY_SHOP_NAME;
    const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

    console.log('Testing Shopify connection with:');
    console.log('Shop Name:', SHOPIFY_SHOP_NAME);
    console.log('Access Token:', SHOPIFY_ACCESS_TOKEN ? 'Set (first 4 chars: ' + SHOPIFY_ACCESS_TOKEN.substring(0, 4) + '...)' : 'Not set');

    try {
        const cleanShopName = SHOPIFY_SHOP_NAME.replace(/\.myshopify\.com$/, '');
        const url = `https://${cleanShopName}.myshopify.com/admin/api/2024-01/shop.json`;
        
        console.log('\nMaking request to:', url);
        
        const response = await axios.get(url, {
            headers: {
                "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            }
        });

        console.log('\nConnection successful!');
        console.log('Shop details:');
        console.log('- Name:', response.data.shop.name);
        console.log('- Domain:', response.data.shop.domain);
        console.log('- Country:', response.data.shop.country_name);
        console.log('- Timezone:', response.data.shop.timezone);

        // Test orders endpoint
        const ordersUrl = `https://${cleanShopName}.myshopify.com/admin/api/2024-01/orders.json?limit=1&status=any`;
        console.log('\nTesting orders endpoint:', ordersUrl);
        
        const ordersResponse = await axios.get(ordersUrl, {
            headers: {
                "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            }
        });

        console.log('\nSuccessfully fetched orders:');
        console.log('- Total orders available:', ordersResponse.headers['x-shopify-shop-api-call-limit']);
        console.log('- Sample order date:', ordersResponse.data.orders[0]?.created_at || 'No orders found');

    } catch (error) {
        console.error('\nError connecting to Shopify:');
        console.error('Status:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Error Message:', error.message);
        if (error.response?.data) {
            console.error('Error Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testShopifyConnection(); 