import React from 'react';
import { Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Chart as ChartJS } from 'chart.js';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import './InventoryAgeBreakdown.css';

const InventoryAgeBreakdown = ({ inventoryData }) => {
  console.log('InventoryAgeBreakdown received data:', inventoryData);
  
  if (!inventoryData || !Array.isArray(inventoryData) || inventoryData.length === 0) {
    console.log('No inventory data available:', { 
      isArray: Array.isArray(inventoryData),
      length: inventoryData?.length,
      data: inventoryData 
    });
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

  // Map backend data to chart format
  const ageDistribution = inventoryData.map(bucket => {
    const [start, end] = bucket.range.split('-').map(n => parseInt(n, 10));
    const color = end <= 30 ? '#4CAF50' :
                 end <= 60 ? '#FFC107' :
                 end <= 90 ? '#FF9800' :
                 end === Infinity || isNaN(end) ? '#F44336' : '#FF9800';
    
    // Format the range label
    const rangeLabel = end === Infinity || isNaN(end) ? 
                      `${start}+ days` : 
                      `${start}-${end} days`;
    
    return {
      label: rangeLabel,
      count: bucket.count,
      retailValue: bucket.retailValue,
      discountedValue: bucket.discountedValue,
      percentage: Math.round(bucket.percentage),  // Round to whole number
      color
    };
  });

  // Ensure percentages sum to 100%
  const totalPercentage = ageDistribution.reduce((sum, bucket) => sum + bucket.percentage, 0);
  if (totalPercentage !== 100) {
    // Adjust the largest bucket to make total 100%
    const largestBucket = ageDistribution.reduce((max, bucket) => 
      bucket.percentage > max.percentage ? bucket : max
    , ageDistribution[0]);
    largestBucket.percentage += (100 - totalPercentage);
  }

  const chartData = {
    labels: [''],  // Empty label since we don't need it
    datasets: ageDistribution.map(bucket => ({
      label: `${bucket.label} (${bucket.percentage}%)`,
      data: [bucket.percentage],
      backgroundColor: bucket.color,
      borderColor: bucket.color,
      borderWidth: 0  // Remove borders for cleaner look
    }))
  };

  const chartOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 6,  // Make the chart wider than it is tall
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'start',
        labels: {
          boxWidth: 12,
          padding: 8,
          font: {
            size: 11
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const bucket = ageDistribution[context.datasetIndex];
            const discount = bucket.label.includes('0-30') ? '0%' :
                           bucket.label.includes('31-60') ? '5%' :
                           bucket.label.includes('61-90') ? '10%' :
                           '15%';
            return [
              bucket.label,
              `${discount} Discount`,
              `${bucket.count} of ${totalItems} Items`,
              `Retail Value: ${formatCurrency(bucket.retailValue)}`,
              `Discounted Value: ${formatCurrency(bucket.discountedValue)}`
            ];
          }
        }
      },
      datalabels: {  // Add data labels plugin configuration
        color: '#333',
        font: {
          size: 11,
          weight: 'bold'
        },
        formatter: (value) => `${value}%`,
        align: 'center',
        anchor: 'center'
      }
    },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        max: 100,
        grid: {
          display: false
        },
        ticks: {
          callback: value => `${value}%`,
          font: {
            size: 11
          }
        }
      },
      y: {
        stacked: true,
        display: false
      }
    }
  };

  // Calculate totals from the backend data
  const totalItems = inventoryData.reduce((sum, bucket) => sum + bucket.count, 0);
  const totalRetailValue = inventoryData.reduce((sum, bucket) => sum + bucket.retailValue, 0);
  const totalDiscountedValue = inventoryData.reduce((sum, bucket) => sum + bucket.discountedValue, 0);

  const grossMarginTooltip = "Calculated as (Discounted Value - Cost) / Discounted Value, assuming cost is 50% of retail value. This shows your expected margin after applying age-based discounts.";
  
  const weightedDiscountTooltip = "Calculated by comparing total discounted value to total retail value, automatically weighting each age bucket's discount by its share of total inventory value. For example, if 50% of inventory value is in 90+ days (15% discount) and 50% is in 0-30 days (0% discount), the weighted average would be 7.5%.";

  return (
    <div className="inventory-age-breakdown">
      <div className="section-header">
        <h3>Inventory Age Distribution</h3>
      </div>
      <div className="chart-container">
        <Bar 
          data={chartData} 
          options={chartOptions} 
          plugins={[ChartDataLabels]}
        />
      </div>
      <div className="summary-stats">
        <div className="stat-tile">
          <div className="stat-label">Total Retail Value</div>
          <div className="stat-value">${formatNumber(Math.round(totalRetailValue * 100) / 100)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Total Discounted Value</div>
          <div className="stat-value">${formatNumber(Math.round(totalDiscountedValue * 100) / 100)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">
            Weighted Average Discount
            <span className="info-icon" title={weightedDiscountTooltip}>ⓘ</span>
          </div>
          <div className="stat-value">{((1 - totalDiscountedValue / totalRetailValue) * 100).toFixed(1)}%</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">
            Gross Margin with Discounts
            <span className="info-icon" title={grossMarginTooltip}>ⓘ</span>
          </div>
          <div className="stat-value">
            {((totalDiscountedValue - (totalRetailValue * 0.5)) / totalDiscountedValue * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryAgeBreakdown; 