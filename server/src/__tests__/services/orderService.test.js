import { jest } from '@jest/globals';
import { calculateCumulativeSales } from '../../services/orderService.js';
import { AppError } from '../../utils/errorUtils.js';

// Mock axios
const { default: axios } = await import('axios');
jest.spyOn(axios, 'post').mockImplementation((url, data, config) => {
  // Check if the access token is invalid
  if (config?.headers?.['X-Shopify-Access-Token'] === 'invalid_token') {
    return Promise.reject(new Error('Invalid access token'));
  }
  
  return Promise.resolve({
    data: {
      data: {
        orders: {
          edges: [
            {
              node: {
                id: '1',
                createdAt: '2024-01-01T00:00:00Z',
                currentTotalPriceSet: {
                  shopMoney: {
                    amount: '100.00'
                  }
                }
              }
            }
          ],
          pageInfo: {
            hasNextPage: false
          }
        }
      }
    }
  });
});

describe('orderService', () => {
  describe('calculateCumulativeSales', () => {
    it('should validate month input', async () => {
      await expect(calculateCumulativeSales(0, 2024)).rejects.toThrow('Month must be a number between 1 and 12');
      await expect(calculateCumulativeSales(13, 2024)).rejects.toThrow('Month must be a number between 1 and 12');
      await expect(calculateCumulativeSales('invalid', 2024)).rejects.toThrow('Month must be a number between 1 and 12');
    });

    it('should validate year input', async () => {
      await expect(calculateCumulativeSales(1, 1999)).rejects.toThrow('Year must be a valid number between 2000 and current year');
      await expect(calculateCumulativeSales(1, new Date().getFullYear() + 1)).rejects.toThrow('Year must be a valid number between 2000 and current year');
      await expect(calculateCumulativeSales(1, 'invalid')).rejects.toThrow('Year must be a valid number between 2000 and current year');
    });

    it('should return sample data when Shopify credentials are missing', async () => {
      // Temporarily clear Shopify credentials
      const originalShopName = process.env.SHOPIFY_SHOP_NAME;
      const originalAccessToken = process.env.SHOPIFY_ACCESS_TOKEN;
      process.env.SHOPIFY_SHOP_NAME = '';
      process.env.SHOPIFY_ACCESS_TOKEN = '';

      const result = await calculateCumulativeSales(1, 2024);

      // Restore credentials
      process.env.SHOPIFY_SHOP_NAME = originalShopName;
      process.env.SHOPIFY_ACCESS_TOKEN = originalAccessToken;

      // Verify sample data structure
      expect(result).toHaveProperty('dailySales');
      expect(result).toHaveProperty('dailyAmounts');
      expect(result).toHaveProperty('cumulativeSales');
      expect(result).toHaveProperty('cumulativeAmount');
      
      // Verify data types
      expect(Array.isArray(result.dailySales)).toBe(true);
      expect(Array.isArray(result.dailyAmounts)).toBe(true);
      expect(typeof result.cumulativeSales).toBe('number');
      expect(typeof result.cumulativeAmount).toBe('number');
      
      // Verify array lengths match days in month
      const daysInMonth = new Date(2024, 0, 0).getDate();
      expect(result.dailySales.length).toBe(daysInMonth);
      expect(result.dailyAmounts.length).toBe(daysInMonth);
    });

    it('should handle API errors gracefully', async () => {
      // Temporarily set invalid access token
      const originalAccessToken = process.env.SHOPIFY_ACCESS_TOKEN;
      process.env.SHOPIFY_ACCESS_TOKEN = 'invalid_token';

      await expect(calculateCumulativeSales(1, 2024)).rejects.toThrow(AppError);

      // Restore access token
      process.env.SHOPIFY_ACCESS_TOKEN = originalAccessToken;
    });

    it('should calculate correct cumulative totals', async () => {
      const result = await calculateCumulativeSales(1, 2024);
      
      // Verify cumulative totals match sum of daily values
      const expectedCumulativeSales = result.dailySales.reduce((sum, val) => sum + val, 0);
      const expectedCumulativeAmount = result.dailyAmounts.reduce((sum, val) => sum + val, 0);
      
      expect(result.cumulativeSales).toBe(expectedCumulativeSales);
      expect(result.cumulativeAmount).toBe(expectedCumulativeAmount);
    });
  });
}); 