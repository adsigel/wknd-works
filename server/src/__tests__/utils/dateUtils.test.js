import {
  createUTCDate,
  formatUTCDate,
  parseShopifyDate,
  getDateRange,
  isValidDate,
  compareDates
} from '../../utils/dateUtils.js';

describe('dateUtils', () => {
  describe('createUTCDate', () => {
    it('should create a UTC date from a valid date string', () => {
      const date = createUTCDate('2024-03-15');
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(2); // March is 2 (0-based)
      expect(date.getUTCDate()).toBe(15);
    });

    it('should throw error for invalid date string', () => {
      expect(() => createUTCDate('invalid')).toThrow();
      expect(() => createUTCDate('2024-13-15')).toThrow();
    });
  });

  describe('formatUTCDate', () => {
    it('should format date as YYYY-MM-DD in UTC', () => {
      const date = new Date(Date.UTC(2024, 2, 15)); // March 15, 2024
      expect(formatUTCDate(date)).toBe('2024-03-15');
    });

    it('should pad single digit month and day with zeros', () => {
      const date = new Date(Date.UTC(2024, 0, 5)); // January 5, 2024
      expect(formatUTCDate(date)).toBe('2024-01-05');
    });
  });

  describe('parseShopifyDate', () => {
    it('should parse Shopify date string to local date', () => {
      const shopifyDate = '2024-03-15T12:00:00Z';
      const localDate = parseShopifyDate(shopifyDate);
      
      // The exact hour will depend on the local timezone
      // but the date should be March 15, 2024
      expect(localDate.getFullYear()).toBe(2024);
      expect(localDate.getMonth()).toBe(2); // March
      expect(localDate.getDate()).toBe(15);
    });
  });

  describe('getDateRange', () => {
    it('should return correct start and end dates for a month', () => {
      const { start, end } = getDateRange(2024, 3); // March 2024
      
      expect(start.getUTCFullYear()).toBe(2024);
      expect(start.getUTCMonth()).toBe(2); // March
      expect(start.getUTCDate()).toBe(1);
      expect(start.getUTCHours()).toBe(0);
      
      expect(end.getUTCFullYear()).toBe(2024);
      expect(end.getUTCMonth()).toBe(2); // March
      expect(end.getUTCDate()).toBe(31);
      expect(end.getUTCHours()).toBe(23);
    });
  });

  describe('isValidDate', () => {
    it('should return true for valid dates', () => {
      expect(isValidDate(new Date())).toBe(true);
      expect(isValidDate(new Date('2024-03-15'))).toBe(true);
    });

    it('should return false for invalid dates', () => {
      expect(isValidDate(new Date('invalid'))).toBe(false);
      expect(isValidDate('not a date')).toBe(false);
    });
  });

  describe('compareDates', () => {
    it('should compare dates correctly ignoring time', () => {
      const date1 = new Date('2024-03-15T10:00:00');
      const date2 = new Date('2024-03-15T15:00:00');
      const date3 = new Date('2024-03-16T10:00:00');

      expect(compareDates(date1, date2)).toBe(0); // Same day
      expect(compareDates(date1, date3)).toBe(-1); // date1 < date3
      expect(compareDates(date3, date1)).toBe(1); // date3 > date1
    });
  });
}); 