import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const shopName = process.env.SHOPIFY_SHOP_NAME;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

if (!shopName || !accessToken) {
  console.error('Missing Shopify credentials in .env file');
  process.exit(1);
}

const baseUrl = `https://${shopName}.myshopify.com`;

// First, get the location ID
const locationQuery = `{
  locations(first: 1) {
    edges {
      node {
        id
        name
      }
    }
  }
}`;

// Then use it in the product query
const productQuery = (locationId, cursor = null) => `{
  shop {
    name
    id
  }
  products(first: 250, ${cursor ? `after: "${cursor}"` : ''}, query: "status:active") {
    edges {
      cursor
      node {
        id
        title
        status
        variants(first: 100) {
          edges {
            node {
              id
              title
              sku
              price
              compareAtPrice
              inventoryItem {
                id
                unitCost {
                  amount
                }
                createdAt
                inventoryLevel(locationId: "${locationId}") {
                  quantities(names: ["available", "incoming", "on_hand"]) {
                    name
                    quantity
                  }
                  location {
                    id
                    name
                  }
                }
              }
            }
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

// Function to calculate discount based on inventory age
function calculateDiscount(createdAt) {
  const createdDate = new Date(createdAt);
  const today = new Date();
  const daysInInventory = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));

  if (daysInInventory < 30) return 0;
  if (daysInInventory < 60) return 0.15;
  if (daysInInventory < 90) return 0.25;
  return 0.40;
}

async function testGraphQL() {
  try {
    console.log('Testing Shopify GraphQL API connection...');
    console.log('Shop:', shopName);
    console.log('Base URL:', baseUrl);

    // First, get the location ID
    console.log('\nFetching location ID...');
    const locationResponse = await axios.post(
      `${baseUrl}/admin/api/2024-01/graphql`,
      { query: locationQuery },
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    if (locationResponse.data.errors) {
      console.error('Error fetching location:', locationResponse.data.errors);
      return;
    }

    const locationId = locationResponse.data.data.locations.edges[0].node.id;
    console.log('Found location ID:', locationId);

    // Fetch all products with pagination
    let allProducts = [];
    let hasNextPage = true;
    let endCursor = null;
    let pageCount = 0;

    while (hasNextPage) {
      pageCount++;
      console.log(`\nFetching product page ${pageCount}...`);
      
      const productResponse = await axios.post(
        `${baseUrl}/admin/api/2024-01/graphql`,
        { query: productQuery(locationId, endCursor) },
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      if (productResponse.data.errors) {
        console.error('\nGraphQL Errors:', productResponse.data.errors);
        break;
      }

      const products = productResponse.data.data.products.edges;
      allProducts = allProducts.concat(products);
      
      hasNextPage = productResponse.data.data.products.pageInfo.hasNextPage;
      endCursor = productResponse.data.data.products.pageInfo.endCursor;
      
      console.log(`Fetched ${products.length} products (total so far: ${allProducts.length})`);
    }

    // Calculate total retail and cost values
    let totalRetailValue = 0;
    let totalCostValue = 0;
    let totalDiscountedValue = 0;
    let totalProducts = 0;
    let totalVariants = 0;
    let productsWithInventory = 0;
    let productsWithCost = 0;

    console.log('\nCalculating inventory values...');
    for (const product of allProducts) {
      // Skip if product is not active
      if (product.node.status !== 'ACTIVE') {
        console.log(`\n⚠️ Skipping inactive product: ${product.node.title}`);
        continue;
      }

      const variants = product.node.variants.edges;
      totalProducts++;
      
      for (const variant of variants) {
        totalVariants++;
        const inventoryLevel = variant.node.inventoryItem.inventoryLevel;
        
        // Skip if no inventory level
        if (!inventoryLevel) {
          console.log(`\n⚠️ No inventory level for ${product.node.title} - ${variant.node.title}`);
          continue;
        }

        // Find available quantity
        const availableQuantity = inventoryLevel.quantities.find(q => q.name === 'available')?.quantity || 0;
        
        if (availableQuantity > 0) {
          productsWithInventory++;
          // Use compare_at_price if available, otherwise use price
          const retailPrice = variant.node.compareAtPrice 
            ? parseFloat(variant.node.compareAtPrice)
            : parseFloat(variant.node.price);
            
          // Get cost from inventory item
          const cost = parseFloat(variant.node.inventoryItem.unitCost?.amount) || 0;
          if (cost > 0) {
            productsWithCost++;
          }
            
          const variantRetailValue = availableQuantity * retailPrice;
          const variantCostValue = availableQuantity * cost;
          
          // Calculate discount based on inventory age
          const createdAt = variant.node.inventoryItem.createdAt;
          const discount = calculateDiscount(createdAt);
          const discountedPrice = retailPrice * (1 - discount);
          const variantDiscountedValue = availableQuantity * discountedPrice;
          
          totalRetailValue += variantRetailValue;
          totalCostValue += variantCostValue;
          totalDiscountedValue += variantDiscountedValue;
          
          console.log(`\nProduct: ${product.node.title}`);
          console.log(`Variant: ${variant.node.title}`);
          console.log(`SKU: ${variant.node.sku || 'No SKU'}`);
          console.log(`Available: ${availableQuantity}`);
          console.log(`Created At: ${new Date(createdAt).toLocaleDateString()}`);
          console.log(`Retail Price: $${retailPrice}`);
          console.log(`Cost: $${cost}`);
          console.log(`Discount: ${(discount * 100).toFixed(0)}%`);
          console.log(`Discounted Price: $${discountedPrice.toFixed(2)}`);
          console.log(`Retail Value: $${variantRetailValue.toFixed(2)}`);
          console.log(`Cost Value: $${variantCostValue.toFixed(2)}`);
          console.log(`Discounted Value: $${variantDiscountedValue.toFixed(2)}`);
        }
      }
    }

    console.log('\n=== Inventory Summary ===');
    console.log(`Total Active Products: ${totalProducts}`);
    console.log(`Total Variants: ${totalVariants}`);
    console.log(`Products with Inventory > 0: ${productsWithInventory}`);
    console.log(`Products with Cost Data: ${productsWithCost}`);
    console.log(`Total Retail Value: $${totalRetailValue.toFixed(2)}`);
    console.log(`Total Cost Value: $${totalCostValue.toFixed(2)}`);
    console.log(`Total Discounted Value: $${totalDiscountedValue.toFixed(2)}`);
    console.log(`Potential Profit (at retail): $${(totalRetailValue - totalCostValue).toFixed(2)}`);
    console.log(`Potential Profit (with discounts): $${(totalDiscountedValue - totalCostValue).toFixed(2)}`);

  } catch (error) {
    console.error('\nError:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testGraphQL(); 