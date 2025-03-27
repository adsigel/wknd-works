import axios from 'axios';

/**
 * Shopify API Service
 * Required API Scopes:
 * - read_inventory: For inventory levels and adjustments
 * - read_products: For product information
 * - read_orders: For historical sales analysis
 * - read_analytics: For efficient historical data access
 * 
 * Optional Scopes:
 * - read_locations: For multi-location support
 * - read_price_rules: For promotion analysis
 */
/**
 * ShopifyService class for interacting with the Shopify API
 */
export default class ShopifyService {
  constructor(shopName, accessToken) {
    this.shopName = shopName;
    this.accessToken = accessToken;
    this.baseUrl = `https://${shopName}.myshopify.com`;
    
    // Log configuration
    console.log('ShopifyService initialized with:');
    console.log('Shop Name:', shopName);
    console.log('Base URL:', this.baseUrl);
  }

  _ensureClient() {
    if (!this.client) {
      console.log('Creating Axios client with base URL:', this.baseUrl);
      this.client = axios.create({
        baseURL: this.baseUrl,
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      // Add request interceptor for logging
      this.client.interceptors.request.use(config => {
        if (config.url?.includes('graphql')) {
          console.log('Making GraphQL request:', config.data);
        }
        return config;
      });

      // Add response interceptor for logging
      this.client.interceptors.response.use(response => {
        if (response.config.url?.includes('graphql')) {
          console.log('GraphQL response status:', response.status);
          if (response.data.errors) {
            console.error('GraphQL errors:', response.data.errors);
          }
        }
        return response;
      });
    }
  }

  /**
   * Validates API access by checking required endpoints
   */
  async validateAccess() {
    try {
      // Check if credentials are configured
      if (!this.baseUrl || !this.accessToken) {
        return {
          hasAllRequiredScopes: false,
          missingScopes: ['all'],
          message: 'Shopify credentials not configured. Please check SHOPIFY_SHOP_NAME and SHOPIFY_ACCESS_TOKEN environment variables.'
        };
      }

      this._ensureClient();
      
      console.log('Attempting to validate with URL:', this.baseUrl);
      
      const checks = await Promise.all([
        this.client.get('/admin/api/2024-01/products/count.json').catch(e => {
          console.log('Products check failed:', e.message);
          return null;
        }),
        // Try a different inventory endpoint
        this.client.get('/admin/api/2024-01/locations.json').then(async response => {
          if (response?.data?.locations?.[0]?.id) {
            const locationId = response.data.locations[0].id;
            console.log('Found location ID:', locationId);
            // Try to get inventory for this location
            return this.client.get(`/admin/api/2024-01/inventory_levels.json?location_ids=${locationId}`);
          }
          return null;
        }).catch(e => {
          console.log('Inventory check failed:', e.message);
          return null;
        }),
        this.client.get('/admin/api/2024-01/orders/count.json').catch(e => {
          console.log('Orders check failed:', e.message);
          return null;
        })
      ]);

      const [productsCheck, inventoryCheck, ordersCheck] = checks;
      
      const missingScopes = [];
      if (!productsCheck) missingScopes.push('read_products');
      if (!inventoryCheck) missingScopes.push('read_inventory');
      if (!ordersCheck) missingScopes.push('read_orders');

      return {
        hasAllRequiredScopes: missingScopes.length === 0,
        missingScopes,
        message: missingScopes.length === 0 
          ? 'All required scopes are available'
          : `Missing required scopes: ${missingScopes.join(', ')}`,
        debug: {
          productsCheck: !!productsCheck,
          inventoryCheck: !!inventoryCheck,
          ordersCheck: !!ordersCheck
        }
      };
    } catch (error) {
      console.error('Error validating Shopify API access:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      return {
        hasAllRequiredScopes: false,
        missingScopes: ['unknown'],
        message: `Failed to validate Shopify API access: ${error.response?.data?.errors || error.message}`
      };
    }
  }

  async getProducts() {
    try {
      this._ensureClient();
      
      // First, get the location ID and inventory levels
      console.log('Fetching location ID...');
      const locationResponse = await this.client.get('/admin/api/2024-01/locations.json');
      if (!locationResponse.data?.locations?.[0]?.id) {
        throw new Error('No location found');
      }
      const numericLocationId = locationResponse.data.locations[0].id;
      const locationId = `gid://shopify/Location/${numericLocationId}`;
      console.log('Found location ID:', locationId);

      // Get all inventory levels first
      console.log('Fetching all inventory levels...');
      const inventoryLevels = await this.getInventoryLevels(numericLocationId);
      console.log(`Found ${inventoryLevels.length} total inventory levels`);
      
      // Log a few inventory levels to see their structure
      console.log('Sample inventory levels:', inventoryLevels.slice(0, 2));
      
      let allProducts = [];
      let hasNextPage = true;
      let cursor = null;
      
      while (hasNextPage) {
        const query = `query {
          products(first: 250${cursor ? `, after: "${cursor}"` : ''}) {
            edges {
              node {
                id
                title
                status
                productType
                tags
                createdAt
                updatedAt
                variants(first: 100) {
                  edges {
                    node {
                      id
                      title
                      sku
                      price
                      compareAtPrice
                      inventoryQuantity
                      createdAt
                      updatedAt
                      inventoryItem {
                        id
                        # Add legacy_resource_id to help with matching
                        legacyResourceId
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

        console.log('Making GraphQL request to fetch products...');
        console.log('Using cursor:', cursor || 'Initial request');
        
        const response = await this.client.post('/admin/api/2024-01/graphql.json', {
          query
        });

        if (!response.data?.data?.products) {
          console.error('Invalid response format:', response.data);
          throw new Error('Invalid response format from Shopify GraphQL API');
        }

        const transformedProducts = response.data.data.products.edges.map(edge => {
          const product = edge.node;
          console.log(`\nProcessing product "${product.title}":`, {
            status: product.status,
            variantCount: product.variants.edges.length,
            id: product.id
          });

          // Only skip if explicitly archived
          if (product.status === 'ARCHIVED') {
            console.log(`Skipping archived product: ${product.title}`);
            return null;
          }

          const variants = product.variants.edges.map(variantEdge => {
            const variant = variantEdge.node;
            const inventoryItemId = variant.inventoryItem?.legacyResourceId || variant.inventoryItem?.id?.split('/').pop();
            
            // Find matching inventory level from our complete list
            const inventoryLevel = inventoryLevels.find(
              level => level.inventory_item_id.toString() === inventoryItemId?.toString()
            );

            const quantity = variant.inventoryQuantity || inventoryLevel?.available || 0;

            // Log variant processing
            console.log(`  Variant "${variant.title}":`, {
              inventoryItemId,
              quantity,
              price: variant.price,
              compareAtPrice: variant.compareAtPrice
            });
            
            return {
              id: variant.id.split('/').pop(),
              title: variant.title,
              sku: variant.sku,
              price: variant.price,
              compare_at_price: variant.compareAtPrice,
              inventory_quantity: quantity,
              inventory_item_id: inventoryItemId,
              created_at: variant.createdAt,
              updated_at: variant.updatedAt
            };
          });

          // Check if any variants have inventory
          const hasInventory = variants.some(v => v.inventory_quantity > 0);
          console.log(`  Product "${product.title}" has inventory:`, hasInventory);

          return {
            id: product.id.split('/').pop(),
            title: product.title,
            status: product.status,
            product_type: product.productType,
            tags: product.tags,
            created_at: product.createdAt,
            updated_at: product.updatedAt,
            variants: variants
          };
        }).filter(Boolean); // Remove null products (archived ones)

        allProducts = allProducts.concat(transformedProducts);
        console.log(`\nFetched ${transformedProducts.length} products (total so far: ${allProducts.length})`);

        hasNextPage = response.data.data.products.pageInfo.hasNextPage;
        cursor = response.data.data.products.pageInfo.endCursor;
      }

      console.log(`Completed fetching all products. Total: ${allProducts.length}`);
      
      // Log some sample products with inventory
      console.log('Sample products with inventory:', 
        JSON.stringify(
          allProducts
            .filter(p => p.variants.some(v => v.inventory_quantity > 0))
            .slice(0, 2)
            .map(p => ({
              ...p,
              variants: p.variants.map(v => ({
                title: v.title,
                sku: v.sku,
                inventory_quantity: v.inventory_quantity,
                inventory_item_id: v.inventory_item_id,
                price: v.price
              }))
            })),
          null,
          2
        )
      );

      // Log inventory matching stats
      const productsWithInventory = allProducts.filter(p => 
        p.variants.some(v => v.inventory_quantity > 0)
      );
      console.log('\nInventory matching statistics:');
      console.log(`Products with inventory: ${productsWithInventory.length} / ${allProducts.length}`);
      console.log(`Total variants with inventory: ${
        allProducts.reduce((sum, p) => 
          sum + p.variants.filter(v => v.inventory_quantity > 0).length, 
          0
        )
      }`);
      
      return allProducts;
    } catch (error) {
      console.error('Error fetching products:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  async getInventoryLevels(locationId) {
    try {
      this._ensureClient();
      
      let allInventoryLevels = [];
      let hasMore = true;
      let nextUrl = `/admin/api/2024-01/inventory_levels.json?location_ids=${locationId}&limit=250`;
      
      while (hasMore) {
        // If we have a full URL from the Link header, use it directly
        const response = await this.client.get(nextUrl);

        if (!response.data || !response.data.inventory_levels) {
          throw new Error('Invalid response format from Shopify');
        }

        allInventoryLevels = allInventoryLevels.concat(response.data.inventory_levels);
        console.log(`Fetched ${response.data.inventory_levels.length} inventory levels (total so far: ${allInventoryLevels.length})`);

        // Check for Link header that contains the next page info
        const linkHeader = response.headers['link'];
        if (linkHeader) {
          const nextLink = linkHeader.split(',').find(link => link.includes('rel="next"'));
          if (nextLink) {
            // Extract the full URL from the Link header
            const matches = nextLink.match(/<([^>]+)>/);
            if (matches) {
              // Get just the path and query parameters from the full URL
              const fullUrl = new URL(matches[1]);
              nextUrl = fullUrl.pathname + fullUrl.search;
              console.log('Next page URL:', nextUrl);
            } else {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      console.log(`Completed fetching all inventory levels. Total: ${allInventoryLevels.length}`);
      return allInventoryLevels;
    } catch (error) {
      console.error('Error fetching inventory levels:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  async getOrdersWithinDateRange(startDate, endDate) {
    try {
      this._ensureClient();
      const response = await this.client.get('/admin/api/2024-01/orders.json', {
        params: {
          created_at_min: startDate.toISOString(),
          created_at_max: endDate.toISOString(),
          status: 'any',
          limit: 250
        }
      });
      return response.data.orders;
    } catch (error) {
      console.error('Error fetching orders from Shopify:', error);
      throw error;
    }
  }

  async getProductInventoryHistory(productId, locationId) {
    try {
      this._ensureClient();
      const response = await this.client.get(`/admin/api/2024-01/inventory_levels/adjust.json`, {
        params: {
          inventory_item_id: productId,
          location_id: locationId
        }
      });
      return response.data.inventory_level_adjustments;
    } catch (error) {
      console.error('Error fetching inventory history from Shopify:', error);
      throw error;
    }
  }

  async getInventoryValue() {
    try {
      this._ensureClient();
      
      // First, create a new report
      const createReportResponse = await this.client.post('/api/2024-01/reports.json', {
        report: {
          name: "Inventory Value",
          category: "inventory",
          shopify_ql: `
            SHOW inventory_value 
            FROM products 
            AS OF now()
            ORDER BY value DESC
          `
        }
      });

      const reportId = createReportResponse.data.report.id;

      // Wait for report to be ready (poll with exponential backoff)
      let report;
      let attempts = 0;
      const maxAttempts = 5;
      const baseDelay = 1000; // 1 second

      while (attempts < maxAttempts) {
        const reportResponse = await this.client.get(`/api/2024-01/reports/${reportId}.json`);
        report = reportResponse.data.report;

        if (report.status === 'completed') {
          break;
        }

        if (report.status === 'failed') {
          throw new Error('Report generation failed');
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempts)));
        attempts++;
      }

      if (!report || report.status !== 'completed') {
        throw new Error('Report did not complete in time');
      }

      // Get the report results
      const resultsResponse = await this.client.get(report.output_url);
      
      return {
        success: true,
        data: resultsResponse.data,
        timestamp: new Date(),
        reportId: reportId
      };
    } catch (error) {
      console.error('Error getting inventory value:', error);
      throw error;
    }
  }
} 