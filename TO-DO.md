# TO-DO List

## Inventory Planning 2.0
1. Get current cost of inventory (in cost)
2. Optional: Adjust down for loss
3. Estimated gross margin (set a high end and low end to keep it simple)
4. Calculate revenue potential of inventory on hand
5. Determine runway for inventory based on future sales goals and weeks' worth of buffer with gross margin ranges
6. Calculate inventory budget based on shortfall between high/low end of inventory revenue potential and sales goal + buffer

## UI/UX Improvements
1. Replace Month/Year picklist in the sales chart with forward/back arrows for simpler navigation
2. Move the Settings button outside of the tabbed interface for accessibility from either tab
3. Remove thickness as a styling option for the Daily Sales chart series
4. Update the copy on the stats box for "$" to "Monthly Goal"

## Historical Data Display
1. Fix stats calculation for completed months:
   - Ensure `dollarsToTarget` reflects final month-end status
   - Fix "Days Hit Target" to show correct total days and hit count
   - Review "Day-to-Day Projection" calculation for historical months
2. Consider adding visual indicator that we're viewing historical data
3. Consider different stats presentation for completed vs current months

## Chart Styling
1. Add hover effects to chart elements
2. Improve color contrast for better accessibility
3. Add data point markers for key values

## Future Ideas
1. Enhanced Features
   - Holiday and event calendar integration
   - Price change tracking
   - Supplier lead time management
   - Automated reorder suggestions
   - Make the minimum inventory buffer user configurable
   - Improve inventory discount settings with:
     - Customizable discount tiers
     - Category-specific discount rules
     - Time-based discount schedules
   - Add support for manual restocks with:
     - Date specification
     - Value tracking
     - Restock notes/comments
     - Restock history view
   - Add probability analysis:
     - Probability of hitting sales goals
     - Probability distributions for inventory burndown (a la Betterment)
   - Add inventory age analysis:
     - Inventory breakdown by age
     - Sales breakdown by age
     - Customizable buckets for inventory age and their discounts
   - Add financial analysis:
     - Cash flow projections for inventory purchases
     - User customizable inventory loss levels
   - Add data export capabilities:
     - Export monthly sales goals to CSV
     - Export inventory tracking to CSV

2. Performance Optimization
   - Implement caching for frequently accessed data
   - Optimize database queries
   - Add real-time updates for critical changes

3. Testing and Validation
   - Add unit tests for forecast calculations
   - Implement integration tests
   - Add performance benchmarks
   - Create user acceptance testing plan

## Additional Ideas
- Add tooltips to explain each stat in the stats box
- Consider adding a "Compare to Last Year" toggle
- Add export functionality for forecast data
- Consider adding a "Quick Actions" menu for common tasks
- Add keyboard shortcuts for navigation between tabs

## High Priority
- [ ] Fix inventory forecast not refreshing when monthly goals are updated
- [ ] Consolidate all Settings into a single panel (Sales, Inventory, etc.)
- [ ] Add "analyze past sales" button to weighted inventory sales distribution
- [ ] Calculate initial sales distribution based on actual inventory age distribution instead of defaulting to 25% per bucket

## Medium Priority
- [ ] Add ability to view historical inventory snapshots
- [ ] Implement bulk actions for inventory management
- [ ] Add export functionality for reports
- [ ] Improve historical month data display and stats calculations

## Low Priority
- [ ] Add dark mode support
- [ ] Implement keyboard shortcuts
- [ ] Add tooltips for complex features 