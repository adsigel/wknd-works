import React from 'react';
import { Bar } from 'react-chartjs-2';
import { formatCurrency } from '../../utils/formatters';
import './InventoryAgeBreakdown.css';

const AGE_BUCKETS = [
  { label: '0-30 days', maxAge: 30, color: '#4CAF50' },
  { label: '31-60 days', maxAge: 60, color: '#8BC34A' },
  { label: '61-90 days', maxAge: 90, color: '#FFC107' },
  { label: '91-120 days', maxAge: 120, color: '#FF9800' },
  { label: '120+ days', maxAge: Infinity, color: '#F44336' }
];

const InventoryAgeBreakdown = ({ inventoryData }) => {
  console.log('InventoryAgeBreakdown received data:', inventoryData);
  
  if (!inventoryData || !Array.isArray(inventoryData) || inventoryData.length === 0) {
    return (
      <div className="inventory-age-breakdown">
        <div className="section-header">
          <h3>Inventory Age Distribution</h3>
        </div>
        <div className="placeholder-message">
          Inventory age data is not available yet. Check back later or contact support if this persists.
        </div>
      </div>
    );
  }

  // Log sample item structure
  console.log('Sample inventory item:', inventoryData[0]);

  // Calculate age distribution
  const ageDistribution = AGE_BUCKETS.map(bucket => {
    const items = inventoryData.filter(item => {
      if (!item.lastReceivedDate) {
        console.log('Item missing lastReceivedDate:', item);
        return false;
      }
      const age = Math.floor((new Date() - new Date(item.lastReceivedDate)) / (1000 * 60 * 60 * 24));
      return age <= bucket.maxAge && 
             (bucket.maxAge === Infinity ? age > 120 : age > (bucket.maxAge - 30));
    });

    const totalRetailValue = items.reduce((sum, item) => {
      if (!item.quantity || !item.retailPrice) {
        console.log('Item missing quantity or retailPrice:', item);
        return sum;
      }
      return sum + (item.quantity * item.retailPrice);
    }, 0);

    const totalDiscountedValue = items.reduce((sum, item) => {
      if (!item.quantity || !item.retailPrice || !item.age) {
        console.log('Item missing required fields for discount calculation:', item);
        return sum;
      }
      const discountFactor = Math.min(1, 1 - (item.age / 120));
      return sum + (item.quantity * item.retailPrice * discountFactor);
    }, 0);

    return {
      label: bucket.label,
      count: items.length,
      retailValue: totalRetailValue,
      discountedValue: totalDiscountedValue,
      percentage: inventoryData.length > 0 ? (items.length / inventoryData.length) * 100 : 0,
      color: bucket.color
    };
  });

  console.log('Calculated age distribution:', ageDistribution);

  const chartData = {
    labels: ageDistribution.map(bucket => bucket.label),
    datasets: [{
      data: ageDistribution.map(bucket => bucket.percentage),
      backgroundColor: ageDistribution.map(bucket => bucket.color),
      borderColor: ageDistribution.map(bucket => bucket.color),
      borderWidth: 1
    }]
  };

  const chartOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const bucket = ageDistribution[context.dataIndex];
            return [
              `Items: ${bucket.count}`,
              `Retail Value: ${formatCurrency(bucket.retailValue)}`,
              `Discounted Value: ${formatCurrency(bucket.discountedValue)}`,
              `Percentage: ${bucket.percentage.toFixed(1)}%`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Percentage of Inventory'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Age Range'
        }
      }
    }
  };

  return (
    <div className="inventory-age-breakdown">
      <div className="section-header">
        <h3>Inventory Age Distribution</h3>
        <div className="legend">
          {ageDistribution.map((bucket, index) => (
            <div key={index} className="legend-item">
              <div className="legend-color" style={{ backgroundColor: bucket.color }} />
              <span>{bucket.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="chart-container">
        <Bar data={chartData} options={chartOptions} />
      </div>
      <div className="summary-stats">
        <div className="stat">
          <span className="label">Total Items:</span>
          <span className="value">{inventoryData.length}</span>
        </div>
        <div className="stat">
          <span className="label">Total Retail Value:</span>
          <span className="value">{formatCurrency(ageDistribution.reduce((sum, bucket) => sum + bucket.retailValue, 0))}</span>
        </div>
        <div className="stat">
          <span className="label">Total Discounted Value:</span>
          <span className="value">{formatCurrency(ageDistribution.reduce((sum, bucket) => sum + bucket.discountedValue, 0))}</span>
        </div>
      </div>
    </div>
  );
};

export default InventoryAgeBreakdown; 