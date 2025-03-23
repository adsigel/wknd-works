import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import Settings from './Settings';

// Mock axios
jest.mock('axios');

describe('Settings Component', () => {
  const mockChartSettings = {
    'Daily Sales': {
      backgroundColor: 'rgba(44, 61, 47, 0.6)',
      borderColor: 'rgba(44, 61, 47, 1)',
      borderWidth: 1
    },
    'Projected Sales': {
      backgroundColor: 'rgba(210, 129, 95, 0.2)',
      borderColor: 'rgba(210, 129, 95, 1)',
      borderWidth: 2
    }
  };

  const mockProjectionSettings = {
    'Monday': 0,
    'Tuesday': 0,
    'Wednesday': 20,
    'Thursday': 20,
    'Friday': 20,
    'Saturday': 20,
    'Sunday': 20
  };

  const mockProps = {
    onClose: jest.fn(),
    chartSettings: mockChartSettings,
    onChartSettingsChange: jest.fn(),
    projectionSettings: mockProjectionSettings,
    onProjectionSettingsChange: jest.fn()
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('renders all tabs', () => {
    render(<Settings {...mockProps} />);
    expect(screen.getByText('Monthly Goals')).toBeInTheDocument();
    expect(screen.getByText('Chart Styling')).toBeInTheDocument();
    expect(screen.getByText('Customize Projection')).toBeInTheDocument();
  });

  test('switches between tabs', async () => {
    render(<Settings {...mockProps} />);
    
    // Click Chart Styling tab
    fireEvent.click(screen.getByText('Chart Styling'));
    expect(screen.getByText('Daily Sales')).toBeInTheDocument();
    
    // Click Customize Projection tab
    fireEvent.click(screen.getByText('Customize Projection'));
    expect(screen.getByText('Daily Sales Distribution')).toBeInTheDocument();
  });

  test('updates projection settings', async () => {
    render(<Settings {...mockProps} />);
    
    // Go to Projection tab
    fireEvent.click(screen.getByText('Customize Projection'));
    
    // Find Wednesday input and change its value
    const wednesdayInput = screen.getByLabelText('Wednesday:');
    fireEvent.change(wednesdayInput, { target: { value: '25' } });
    
    // Click Save Changes
    fireEvent.click(screen.getByText('Save Changes'));
    
    // Check if onProjectionSettingsChange was called with updated settings
    expect(mockProps.onProjectionSettingsChange).toHaveBeenCalledWith({
      ...mockProjectionSettings,
      'Wednesday': 25
    });
  });

  test('updates chart settings', async () => {
    render(<Settings {...mockProps} />);
    
    // Go to Chart Styling tab
    fireEvent.click(screen.getByText('Chart Styling'));
    
    // Find Daily Sales border width input and change it
    const borderWidthInput = screen.getAllByLabelText('Border Width:')[0];
    fireEvent.change(borderWidthInput, { target: { value: '2' } });
    
    // Click Save Changes
    fireEvent.click(screen.getByText('Save Changes'));
    
    // Check if onChartSettingsChange was called with updated settings
    const expectedSettings = {
      ...mockChartSettings,
      'Daily Sales': {
        ...mockChartSettings['Daily Sales'],
        borderWidth: 2
      }
    };
    expect(mockProps.onChartSettingsChange).toHaveBeenCalledWith(expectedSettings);
  });

  test('analyzes past sales', async () => {
    // Mock successful API response
    axios.get.mockResolvedValueOnce({
      data: {
        dailyDistribution: {
          'Monday': 0.1,
          'Tuesday': 0.1,
          'Wednesday': 0.2,
          'Thursday': 0.2,
          'Friday': 0.2,
          'Saturday': 0.1,
          'Sunday': 0.1
        }
      }
    });

    render(<Settings {...mockProps} />);
    
    // Go to Projection tab
    fireEvent.click(screen.getByText('Customize Projection'));
    
    // Click Analyze Past Sales
    fireEvent.click(screen.getByText('Analyze Past Sales'));
    
    // Wait for analysis to complete
    await waitFor(() => {
      expect(mockProps.onProjectionSettingsChange).toHaveBeenCalledWith({
        'Monday': 10,
        'Tuesday': 10,
        'Wednesday': 20,
        'Thursday': 20,
        'Friday': 20,
        'Saturday': 10,
        'Sunday': 10
      });
    });
  });

  test('handles API errors gracefully', async () => {
    // Mock failed API response
    axios.get.mockRejectedValueOnce(new Error('API Error'));

    render(<Settings {...mockProps} />);
    
    // Go to Projection tab
    fireEvent.click(screen.getByText('Customize Projection'));
    
    // Click Analyze Past Sales
    fireEvent.click(screen.getByText('Analyze Past Sales'));
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to analyze past sales data/i)).toBeInTheDocument();
    });
  });
}); 