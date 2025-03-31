import React from 'react';
import ForecastDashboard from './features/forecast/ForecastDashboard';
import './App.css';

const App = () => {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Inventory & Sales Dashboard</h1>
      </header>
      <main className="App-main">
        <ForecastDashboard />
      </main>
    </div>
  );
};

export default App;
