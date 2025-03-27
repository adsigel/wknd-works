import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import axios from 'axios';

const InventorySummary = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInventorySummary = async () => {
      try {
        const response = await axios.get('/api/inventory/summary');
        setSummary(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInventorySummary();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">Error loading inventory summary: {error}</Typography>
      </Box>
    );
  }

  if (!summary) {
    return null;
  }

  const retailGrossMargin = ((summary.totalRetailValue - summary.totalCostValue) / summary.totalRetailValue) * 100;
  const adjustedGrossMargin = ((summary.totalDiscountedValue - summary.totalCostValue) / summary.totalDiscountedValue) * 100;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Current Inventory Summary
      </Typography>
      <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={2}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Total Active Products
          </Typography>
          <Typography variant="h6">
            {summary.totalProducts}
          </Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Total Variants
          </Typography>
          <Typography variant="h6">
            {summary.totalVariants}
          </Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Total Retail Value
          </Typography>
          <Typography variant="h6">
            ${summary.totalRetailValue.toFixed(2)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Retail Gross Margin
          </Typography>
          <Typography variant="h6" color={retailGrossMargin >= 0 ? 'success.main' : 'error.main'}>
            {retailGrossMargin.toFixed(1)}%
          </Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Total Adjusted Value
          </Typography>
          <Typography variant="h6">
            ${summary.totalDiscountedValue.toFixed(2)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Adjusted Gross Margin
          </Typography>
          <Typography variant="h6" color={adjustedGrossMargin >= 0 ? 'success.main' : 'error.main'}>
            {adjustedGrossMargin.toFixed(1)}%
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default InventorySummary; 