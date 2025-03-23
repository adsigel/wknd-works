import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import SalesChart from './salesChart';

// Mock axios
jest.mock('axios');

// Mock Chart.js
jest.mock('react-chartjs-2', () => ({
  Bar: () => null
}));

describe('SalesChart Component', () => {
  const mockSalesData = {
    dates: ['2025-03-01', '2025-03-02', '2025-03-03'],
    dailySales: [100, 250, 400],
    dailyAmounts: [100, 150, 150],
    projectedSales: [120, 240, 360]
  };

  const mockSettings = {
    chartSettings: {
      'Daily Sales': {
        backgroundColor: 'rgba(44, 61, 47, 0.6)',
        borderColor: 'rgba(44, 61, 47, 1)',
        borderWidth: 1
      },
      'Projected Sales': {
        backgroundColor: 'rgba(210, 129, 95, 0.2)',
        borderColor: 'rgba(210, 129, 95, 1)',
        borderWidth: 2
      },
      'Sales Goal': {
        backgroundColor: 'rgba(143, 171, 158, 0.2)',
        borderColor: 'rgba(143, 171, 158, 1)',
        borderWidth: 3
      }
    },
    projectionSettings: {
      'Monday': 0,
      'Tuesday': 0,
      'Wednesday': 20,
      'Thursday': 20,
      'Friday': 20,
      'Saturday': 20,
      'Sunday': 20
    }
  };

  beforeEach(() => {
    // Mock API responses
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/settings')) {
        return Promise.resolve({ data: mockSettings });
      }
      if (url.includes('/api/sales/goal')) {
        return Promise.resolve({ data: { goal: 1000 } });
      }
      if (url.includes('/api/sales/')) {
        return Promise.resolve({ data: mockSalesData });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders month and year selectors', async () => {
    render(<SalesChart />);
    
    expect(screen.getByText('Select Month:')).toBeInTheDocument();
    expect(screen.getByText('Year:')).toBeInTheDocument();
    
    // Check if current month is selected
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    expect(screen.getByText(currentMonth)).toBeInTheDocument();
  });

  test('loads and displays sales data', async () => {
    render(<SalesChart />);
    
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/sales\/\d+/), expect.any(Object));
    });
    
    // Check if stats are displayed
    await waitFor(() => {
      expect(screen.getByText('Stats')).toBeInTheDocument();
      expect(screen.getByText(/Today's Sales Goal/)).toBeInTheDocument();
      expect(screen.getByText(/\$ to Target/)).toBeInTheDocument();
    });
  });

  test('updates sales goal', async () => {
    render(<SalesChart />);
    
    // Mock the API response for updating goal
    axios.post.mockResolvedValueOnce({ data: { success: true } });
    
    // Click edit button
    const editButton = await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(editButton);
    
    // Enter new goal
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '2000' } });
    
    // Submit form
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    // Verify API call
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/sales\/goal/),
        expect.objectContaining({ goal: 2000 })
      );
    });
  });

  test('opens settings modal', async () => {
    render(<SalesChart />);
    
    // Click settings button
    const settingsButton = screen.getByText('Settings');
    fireEvent.click(settingsButton);
    
    // Verify settings modal is open
    await waitFor(() => {
      expect(screen.getByText('Monthly Goals')).toBeInTheDocument();
      expect(screen.getByText('Chart Styling')).toBeInTheDocument();
      expect(screen.getByText('Customize Projection')).toBeInTheDocument();
    });
  });

  test('calculates stats correctly', async () => {
    // Mock the current date to be March 3, 2025
    const mockDate = new Date(2025, 2, 3);
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    
    render(<SalesChart />);
    
    await waitFor(() => {
      // Check if stats are calculated correctly
      expect(screen.getByText(/\$ to Target/)).toBeInTheDocument();
      expect(screen.getByText(/Days Hit Target/)).toBeInTheDocument();
      expect(screen.getByText(/\$ from Plan/)).toBeInTheDocument();
    });
    
    // Restore the original Date implementation
    global.Date.mockRestore();
  });

  test('handles API errors gracefully', async () => {
    // Mock API error
    axios.get.mockRejectedValueOnce(new Error('API Error'));
    
    render(<SalesChart />);
    
    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });
}); 