import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './InventorySummary.css';

const InventorySummary = React.forwardRef((props, ref) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching inventory summary with forceRefresh:', forceRefresh);

      // First, ensure we have the latest settings
      await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/settings`);

      // Then get the summary with forceRefresh
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/inventory/summary`,
        { params: { forceRefresh } }
      );
      
      console.log('Raw API response:', response);
      console.log('Summary data received:', response.data);
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching inventory summary:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      setError('Failed to load inventory summary');
      throw error; // Re-throw the error so parent components can handle it
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('InventorySummary component mounted');
    fetchSummary(false).catch(error => {
      console.error('Error in initial summary fetch:', error);
    });
  }, []);

  // Expose the refresh method to parent components
  React.useImperativeHandle(ref, () => ({
    refreshSummary: () => {
      console.log('Refresh summary called from parent');
      return fetchSummary(true);
    }
  }));

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const calculateMarginPercentage = (profit, total) => {
    if (!total) return 0;
    return Math.round((profit / total) * 100);
  };

  if (loading) return <div>Loading inventory summary...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!summary) {
    console.log('No summary data available');
    return null;
  }

  console.log('Rendering summary with data:', summary);

  const {
    totalProducts,
    totalVariants,
    totalRetailValue,
    totalCostValue,
    totalDiscountedValue
  } = summary;

  console.log('Extracted values:', {
    totalProducts,
    totalVariants,
    totalRetailValue,
    totalCostValue,
    totalDiscountedValue
  });

  const retailGrossProfit = totalRetailValue - totalCostValue;
  const discountedGrossProfit = totalDiscountedValue - totalCostValue;
  const retailMarginPercentage = calculateMarginPercentage(retailGrossProfit, totalRetailValue);
  const discountedMarginPercentage = calculateMarginPercentage(discountedGrossProfit, totalDiscountedValue);

  console.log('Calculated values:', {
    retailGrossProfit,
    discountedGrossProfit,
    retailMarginPercentage,
    discountedMarginPercentage
  });

  return (
    <div className="inventory-summary">
      <h3>Inventory Summary</h3>
      <div className="summary-grid">
        <div className="summary-item">
          <label>Total Products:</label>
          <span>{totalProducts || 0}</span>
        </div>
        <div className="summary-item">
          <label>Total Variants:</label>
          <span>{totalVariants || 0}</span>
        </div>
        <div className="summary-item">
          <label>Total Retail Value:</label>
          <span>{formatCurrency(totalRetailValue)}</span>
        </div>
        <div className="summary-item">
          <label>Retail Gross Profit:</label>
          <span>{formatCurrency(retailGrossProfit)} ({retailMarginPercentage}%)</span>
        </div>
        <div className="summary-item">
          <label>Total Discounted Value:</label>
          <span>{formatCurrency(totalDiscountedValue)}</span>
        </div>
        <div className="summary-item">
          <label>Discounted Gross Profit:</label>
          <span>{formatCurrency(discountedGrossProfit)} ({discountedMarginPercentage}%)</span>
        </div>
      </div>
    </div>
  );
});

export default InventorySummary; 