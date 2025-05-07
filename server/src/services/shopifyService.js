import axios from 'axios';
import Inventory from '../models/Inventory.js';
import { logError, logInfo, logDebug } from '../utils/loggingUtils.js';
import Settings from '../models/Settings.js';

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
            logInfo(`Product: ${product.title}, Variant: ${variant.title}, Price: ${variant.price}`);
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

  /**
   * Syncs Shopify inventory data with our local inventory model
   * @returns {Promise<Object>} Summary of sync operation
   */
  async syncInventory() {
    try {
      logInfo('Starting inventory sync...');
      
      // Get all products
      logInfo('Fetching products from Shopify...');
      const products = await this.getProducts();
      logInfo(`Fetched ${products.length} products`);

      // Get settings for no-cost handling
      const settings = await Settings.findOne() || {};
      const noCostInventoryHandling = settings.noCostInventoryHandling || 'exclude';
      logInfo(`Using no-cost inventory handling: ${noCostInventoryHandling}`);

      let created = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;
      let totalVariants = 0;

      // Process each product
      for (const product of products) {
        try {
          logInfo(`Processing product: ${product.title} (${product.id})`);
          
          for (const variant of product.variants) {
            totalVariants++;
            try {
              // 1. Get retail price (no validation needed since price differences are intentional)
              const retailPrice = Number(variant.price);

              // 2. Get cost from Shopify
              let cost = null;
              try {
                cost = await this.getInventoryItemCost(variant.inventory_item_id);
                logInfo(`[Cost Data] Product: ${product.title}, Variant: ${variant.title}, Cost: ${cost}`);
              } catch (costError) {
                logError(`Failed to fetch cost for inventory item ${variant.inventory_item_id}:`, costError);
              }

              // 3. Calculate costPrice based on settings
              let costPrice = 0;
              if (cost !== null) {
                costPrice = cost;
              } else if (noCostInventoryHandling === 'assumeMargin') {
                costPrice = retailPrice * 0.5;
              }

              // 4. Prepare inventory data
              const inventoryData = {
                shopifyProductId: product.id,
                variant: {
                  id: variant.id,
                  title: variant.title,
                  sku: variant.sku
                },
                name: `${product.title} - ${variant.title}`,
                category: product.product_type || 'Uncategorized',
                currentStock: variant.inventory_quantity,
                retailPrice: retailPrice,
                costPrice: costPrice,
                shopifyCost: cost,  // Store the raw cost from Shopify
                costSource: cost !== null ? 'shopify' : 'assumed',
                lastUpdated: new Date(),
                lastReceivedDate: new Date()
              };

              // 5. Update or create inventory item using a compound unique index
              const result = await Inventory.findOneAndUpdate(
                { 
                  shopifyProductId: product.id,
                  'variant.id': variant.id 
                },
                { $set: inventoryData },
                { 
                  upsert: true, 
                  new: true,
                  runValidators: true
                }
              );

              if (result.isNew) {
                created++;
                logInfo(`Created new inventory item: ${variant.sku}`);
              } else {
                updated++;
                logInfo(`Updated inventory item: ${variant.sku}`);
              }
            } catch (variantError) {
              logError(`Error processing variant ${variant.id}:`, variantError);
              errors++;
            }
          }
        } catch (productError) {
          logError(`Error processing product ${product.id}:`, productError);
          errors++;
        }
      }

      const summary = {
        created,
        updated,
        skipped,
        errors,
        total: totalVariants
      };

      logInfo('Inventory sync completed', summary);
      return summary;
    } catch (error) {
      logError('Error in syncInventory:', error);
      throw error;
    }
  }

  async getInventoryItemCost(inventoryItemId) {
    try {
      const response = await this.client.get(`/admin/api/2024-01/inventory_items/${inventoryItemId}.json`);
      const cost = response.data?.inventory_item?.cost;
      
      // Validate cost is a reasonable number
      if (cost !== null && cost !== undefined) {
        const numCost = Number(cost);
        if (isNaN(numCost) || numCost < 0) {
          logError(`Invalid cost value for inventory item ${inventoryItemId}: ${cost}`);
          return null;
        }
        return numCost;
      }
      return null;
    } catch (error) {
      logError(`Failed to fetch cost for inventory item ${inventoryItemId}:`, error);
      return null;
    }
  }
} 