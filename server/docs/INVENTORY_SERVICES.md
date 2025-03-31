# Inventory Services Documentation

## Overview
The inventory management system consists of several interconnected services that handle different aspects of inventory tracking, valuation, and forecasting.

## Core Services

### 1. InventoryValueService
Primary service for managing inventory values and syncing with Shopify.

#### Key Responsibilities
- Sync inventory data from Shopify
- Calculate inventory values (retail, cost, discounted)
- Provide inventory summaries
- Manage inventory categories
- Handle inventory adjustments

#### Data Flow
1. **Shopify Sync Process**
   - Fetches all products from Shopify
   - Processes each product and its variants
   - Calculates values based on:
     - Current stock levels
     - Retail prices (compare_at_price or price)
     - Cost prices (calculated as 50% of retail)
   - Stores data in MongoDB

2. **Value Calculations**
   - **Retail Value**: `currentStock * retailPrice`
   - **Cost Value**: `currentStock * costPrice`
   - **Discounted Value**: Applied based on inventory age:
     - 90+ days: 40% discount
     - 60-89 days: 25% discount
     - 30-59 days: 15% discount

3. **Category Management**
   - Categories are extracted from:
     - Product type (primary)
     - Product tags (fallback, looking for "category:" prefix)
     - Default category if none found

#### Caching
- Inventory summaries are cached for 5 minutes
- Cache can be bypassed with `forceRefresh` parameter

### 2. InventoryForecastService
Handles inventory forecasting and projections.

#### Key Responsibilities
- Generate weekly sales projections
- Calculate inventory burn rates
- Track inventory levels over time
- Apply discount rules based on inventory age

#### Data Flow
1. **Projection Generation**
   - Uses monthly sales goals
   - Applies daily sales distribution patterns
   - Calculates ending inventory values
   - Tracks retail and discounted values

2. **Discount Rules**
   - Applied based on inventory age:
     - 90+ days: 40% discount
     - 60-89 days: 25% discount
     - 30-59 days: 15% discount

### 3. Inventory Model
MongoDB schema for storing inventory data.

#### Key Fields
- `productId`: Unique identifier
- `shopifyProductId`: Shopify product ID
- `variant`: Variant details (id, title, sku)
- `name`: Product name
- `category`: Product category
- `currentStock`: Current inventory level
- `retailPrice`: Retail price
- `costPrice`: Cost price
- `discountFactor`: Current discount (0-1)
- `shrinkageFactor`: Expected loss rate (0-1)
- `lastUpdated`: Last update timestamp

## API Endpoints

### Inventory Sync
```http
POST /api/inventory/sync
```
- Syncs inventory data from Shopify
- Returns summary of processed items and values

### Inventory Summary
```http
GET /api/inventory/summary
```
- Returns current inventory summary
- Includes total values and category breakdown

### Inventory Forecast
```http
GET /api/inventory/forecast
```
- Returns inventory projections
- Includes weekly burn rates and ending values

## Data Relationships
1. **Products → Variants → Inventory Items**
   - Each product can have multiple variants
   - Each variant corresponds to one inventory item

2. **Categories → Inventory Items**
   - Inventory items are grouped by category
   - Categories affect value calculations and forecasting

3. **Sales Goals → Forecasts**
   - Monthly sales goals drive inventory projections
   - Daily distribution patterns affect burn rates

## Value Calculation Logic
1. **Base Values**
   - Retail Value = Current Stock × Retail Price
   - Cost Value = Current Stock × Cost Price
   - Cost is calculated as 50% of retail price

2. **Discounts**
   - Applied based on inventory age
   - Affects both retail and cost values
   - Tracked in `discountFactor` field

3. **Shrinkage**
   - Expected loss rate tracked in `shrinkageFactor`
   - Default value of 0.98 (2% loss rate)
   - Applied to final value calculations

## Future Improvements
1. **Cost Calculation**
   - Implement actual cost tracking from Shopify
   - Add support for multiple cost tiers

2. **Discount Rules**
   - Make discount rules configurable
   - Add support for category-specific rules

3. **Performance**
   - Implement batch processing for large inventories
   - Add background job processing for syncs

4. **Reporting**
   - Add detailed inventory reports
   - Implement trend analysis
   - Add export functionality 