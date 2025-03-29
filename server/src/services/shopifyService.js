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
    this.baseUrl = `https://${shopName}${shopName.includes('.myshopify.com') ? '' : '.myshopify.com'}`;
  }

  _ensureClient() {
    if (!this.client) {
      this.client = axios.create({
        baseURL: this.baseUrl,
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
    }
  }

  /**
   * Validates API access by checking required endpoints
   */
  async validateAccess() {
    try {
      if (!this.baseUrl || !this.accessToken) {
        return {
          hasAllRequiredScopes: false,
          missingScopes: ['all'],
          message: 'Shopify credentials not configured. Please check SHOPIFY_SHOP_NAME and SHOPIFY_ACCESS_TOKEN environment variables.'
        };
      }

      this._ensureClient();
      
      const checks = await Promise.all([
        this.client.get('/admin/api/2024-01/products/count.json').catch(() => null),
        this.client.get('/admin/api/2024-01/locations.json').then(async response => {
          if (response?.data?.locations?.[0]?.id) {
            const locationId = response.data.locations[0].id;
            return this.client.get(`/admin/api/2024-01/inventory_levels.json?location_ids=${locationId}`);
          }
          return null;
        }).catch(() => null),
        this.client.get('/admin/api/2024-01/orders/count.json').catch(() => null)
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
          : `Missing required scopes: ${missingScopes.join(', ')}`
      };
    } catch (error) {
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
      
      const locationResponse = await this.client.get('/admin/api/2024-01/locations.json');
      if (!locationResponse.data?.locations?.[0]?.id) {
        throw new Error('No location found');
      }
      const numericLocationId = locationResponse.data.locations[0].id;
      const locationId = `gid://shopify/Location/${numericLocationId}`;

      const inventoryLevels = await this.getInventoryLevels(numericLocationId);
      
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

        const response = await this.client.post('/admin/api/2024-01/graphql.json', {
          query
        });

        if (!response.data?.data?.products) {
          throw new Error('Invalid response format from Shopify GraphQL API');
        }

        const transformedProducts = response.data.data.products.edges.map(edge => {
          const product = edge.node;

          if (product.status === 'ARCHIVED') {
            return null;
          }

          const variants = product.variants.edges.map(variantEdge => {
            const variant = variantEdge.node;
            const inventoryItemId = variant.inventoryItem?.legacyResourceId || variant.inventoryItem?.id?.split('/').pop();
            
            const inventoryLevel = inventoryLevels.find(
              level => level.inventory_item_id.toString() === inventoryItemId?.toString()
            );

            const quantity = variant.inventoryQuantity || inventoryLevel?.available || 0;
            
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

          const hasInventory = variants.some(v => v.inventory_quantity > 0);

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
        }).filter(Boolean);

        allProducts = allProducts.concat(transformedProducts);

        hasNextPage = response.data.data.products.pageInfo.hasNextPage;
        cursor = response.data.data.products.pageInfo.endCursor;
      }

      return allProducts;
    } catch (error) {
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
        const response = await this.client.get(nextUrl);

        if (!response.data || !response.data.inventory_levels) {
          throw new Error('Invalid response format from Shopify');
        }

        allInventoryLevels = allInventoryLevels.concat(response.data.inventory_levels);

        const linkHeader = response.headers['link'];
        if (linkHeader) {
          const nextLink = linkHeader.split(',').find(link => link.includes('rel="next"'));
          if (nextLink) {
            const matches = nextLink.match(/<([^>]+)>/);
            if (matches) {
              const fullUrl = new URL(matches[1]);
              nextUrl = fullUrl.pathname + fullUrl.search;
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

      return allInventoryLevels;
    } catch (error) {
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
      throw error;
    }
  }

  async getInventoryValue() {
    try {
      this._ensureClient();
      
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

      let report;
      let attempts = 0;
      const maxAttempts = 5;
      const baseDelay = 1000;

      while (attempts < maxAttempts) {
        const reportResponse = await this.client.get(`/api/2024-01/reports/${reportId}.json`);
        report = reportResponse.data.report;

        if (report.status === 'completed') {
          break;
        }

        if (report.status === 'failed') {
          throw new Error('Report generation failed');
        }

        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempts)));
        attempts++;
      }

      if (!report || report.status !== 'completed') {
        throw new Error('Report did not complete in time');
      }

      const resultsResponse = await this.client.get(report.output_url);
      
      return {
        success: true,
        data: resultsResponse.data,
        timestamp: new Date(),
        reportId: reportId
      };
    } catch (error) {
      throw error;
    }
  }
} 