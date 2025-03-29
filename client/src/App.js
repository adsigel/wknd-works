import React from 'react';
import SalesChart from './salesChart';
import './App.css';

const App = () => {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Sales Dashboard</h1>
      </header>
      <main className="App-main">
        <SalesChart />
      </main>
    </div>
  );
};

export default App;
