import React, { useState, useEffect } from 'react';
import { fetchOrders } from './fetch_orders'; // Update path if needed
import SalesChart from './salesChart'; // Update path if needed

function App() {
  const [salesData, setSalesData] = useState([]);

  useEffect(() => {
    const loadSalesData = async () => {
      const data = await fetchOrders(2025, 3); // Test if fetchOrders works
      console.log('Sales Data Loaded:', data);  // Check if data is being loaded
      setSalesData(data);
    };

    loadSalesData();
  }, []);

  return (
    <div>
      <h1>Sales Dashboard</h1>
      <SalesChart salesData={salesData} />
    </div>
  );
}

export default App;
