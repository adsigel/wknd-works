# WKND Works Codebase Cleanup Project

## Project Overview
This document outlines the goals, priorities, and rationale for restructuring the WKND Works codebase. The primary aim is to improve code organization, reduce confusion, and establish better development practices.

## Current Issues
1. Multiple backend implementations scattered across different directories
2. Inconsistent environment variable management
3. Duplicate dependencies and package management complexity
4. Unclear project structure with mixed concerns
5. Test and utility scripts mixed with application code
6. Inconsistent configuration file management
7. Fragmented documentation

## Priority Order and Implementation Plan

### Phase 1: Core Infrastructure (Highest Priority)

#### 1. Backend Consolidation
**Goal**: Single source of truth for backend code  
**Changes**:
- Create new `server` directory structure:
  ```
  server/
  ├── src/
  │   ├── config/      # Configuration files
  │   ├── models/      # Database models
  │   ├── routes/      # API routes
  │   ├── services/    # Business logic
  │   └── utils/       # Helper functions
  ├── scripts/         # Utility scripts
  └── tests/           # Test files
  ```
**Rationale**:
- Eliminates confusion about where to put new backend code
- Makes the codebase more maintainable
- Reduces risk of path/import errors
- Simplifies debugging and testing

#### 2. Environment Management
**Goal**: Clear and consistent environment variable structure  
**Changes**:
- Implement three-tier env structure:
  ```
  .env              # Shared variables
  server/.env.local # Server-specific variables
  client/.env.local # Client-specific variables
  ```
**Rationale**:
- Prevents environment variable conflicts
- Makes configuration more predictable
- Improves security by separating concerns
- Easier to maintain different environments (dev/prod)

#### 3. Dependency Management
**Goal**: Centralized package management  
**Changes**:
- Implement workspace structure:
  ```
  package.json         # Workspace definition
  client/package.json  # Client dependencies
  server/package.json  # Server dependencies
  ```
**Rationale**:
- Better dependency version control
- Reduces duplicate dependencies
- Simplifies package updates
- Improves build consistency

### Phase 2: Project Organization (Medium Priority)

#### 4. Client Reorganization
**Goal**: Consistent naming and structure  
**Changes**:
- Rename `react-dashboard` to `client`
- Update all related paths and references
**Rationale**:
- More intuitive naming
- Consistent with modern project structures
- Better scalability for future frontend changes

#### 5. Script Organization
**Goal**: Clear separation of utility scripts  
**Changes**:
- Move all scripts to appropriate directories
- Categorize by purpose (database, Shopify, etc.)
**Rationale**:
- Easier to find and maintain utility scripts
- Better documentation of script purposes
- Clearer separation from application code

### Phase 3: Development Experience (Lower Priority)

#### 6. Configuration Files
**Goal**: Standardized development tooling  
**Changes**:
- Consolidate shared configs at root level
- Maintain project-specific overrides where needed
**Rationale**:
- Consistent code style
- Simplified tooling setup
- Better developer experience

#### 7. Test Organization
**Goal**: Structured test architecture  
**Changes**:
- Separate unit and integration tests
- Establish clear testing patterns
**Rationale**:
- Easier to maintain test suite
- Better test coverage tracking
- Clearer test organization

## Success Metrics
- ✅ All backend code in one location
- ✅ Clear environment variable structure
- ✅ Simplified dependency management
- ✅ Intuitive project organization
- ✅ Easy to find and run utility scripts
- ✅ Consistent development experience
- ✅ Comprehensive test coverage

## Testing Strategy
1. Test after each major phase
2. Ensure all existing functionality works
3. Verify build processes
4. Check deployment procedures
5. Validate development workflows

## Notes
- Keep original files until new structure is verified
- Document all changes in commit messages
- Update README files as structure changes
- Maintain list of any breaking changes

## Project Plan
[Previous project plan content remains unchanged until "Notes" section]

---

## Phase Completion Documentation

### Phase 2: Code Organization and Utilities ✅
**Completed: March 29, 2024**

#### Issues Addressed
1. **Code Organization**
   - Inconsistent formatting of currency and numbers across the application
   - Duplicate color conversion logic in multiple components
   - Scattered utility functions without clear organization

2. **Testing Infrastructure**
   - Updated test infrastructure to support ES modules
   - Improved test coverage for core services
   - Added proper mocking for external services

#### Technical Changes Made

##### Utility Functions (`client/src/utils/` & `server/src/utils/`)
1. **Formatting Utilities**
   - Created `formatters.js` with currency and number formatting functions
   - Standardized currency display across the application
   - Added percentage formatting utility

2. **Color Utilities**
   - Created `colors.js` with RGBA to HEX conversion
   - Added HEX to RGBA conversion utility
   - Centralized color manipulation functions

3. **Service Updates**
   - Updated `inventoryValueService.js` to use new formatting utilities
   - Updated `orderService.js` to use standardized formatting
   - Improved logging with formatted values

#### Key Learnings
1. **Code Reusability**
   - Centralized utilities reduce code duplication
   - Consistent formatting improves user experience
   - Shared utilities between client and server need careful versioning

2. **Testing Strategy**
   - ES modules require specific Jest configuration
   - Mocking external services needs careful consideration
   - Some edge case tests can be deferred for core functionality

#### Future Considerations
1. **Additional Utilities**
   - Consider adding date formatting utilities
   - Look into adding number rounding utilities
   - Consider adding input validation utilities

2. **Testing Improvements**
   - Complete edge case test coverage
   - Add more integration tests
   - Improve test documentation

### Phase 1: Settings and Data Persistence ✅
**Completed: March 19, 2024**

#### Issues Addressed
1. **Settings Persistence**
   - Daily sales projection settings were not persisting after browser refresh
   - Settings were being overwritten by default values on component mount
   - MongoDB settings model had incorrect default values

2. **User Experience**
   - Page was reloading unnecessarily after analyzing past sales
   - No validation for projection settings total (must equal 100%)
   - Insufficient error handling and user feedback

#### Technical Changes Made

##### Frontend (`client/src/`)
1. **SalesChart Component**
   - Fixed React hooks ordering issue
   - Added proper loading state management
   - Updated settings initialization to prevent defaults from overriding saved settings
   - Improved error handling and user feedback

2. **Settings Component**
   - Removed immediate server save after analysis to prevent unwanted reload
   - Added validation to ensure projection percentages total 100%
   - Improved local state management for settings changes
   - Added detailed logging for better debugging

##### Backend (`server/src/`)
1. **Settings Model**
   - Updated default projection settings to match expected values
   - Fixed settings persistence in MongoDB

2. **API Endpoints**
   - Enhanced error handling in settings routes
   - Added validation for settings updates
   - Improved logging for debugging

#### Key Learnings
1. **React State Management**
   - Always initialize state with null or loading state when data needs to be fetched
   - Use proper loading states to prevent flashing of default values
   - Follow React hooks rules strictly (no conditional hook calls)

2. **Data Persistence**
   - Validate data before saving to prevent invalid states
   - Use proper error handling and rollback mechanisms
   - Add comprehensive logging for debugging

3. **User Experience**
   - Avoid unnecessary page reloads
   - Provide clear feedback for user actions
   - Validate data on both client and server side

#### Future Considerations
1. **Performance**
   - Consider implementing optimistic updates
   - Add caching for frequently accessed settings

2. **Error Handling**
   - Implement retry mechanisms for failed API calls
   - Add more detailed error messages

3. **Testing**
   - Add unit tests for settings validation
   - Add integration tests for settings persistence
   - Add end-to-end tests for critical user flows

---

### Phase 2: Project Organization 🔄
[To be documented when completed]

# WKND Dashboard Cleanup Project

## Phase 1: Settings and Data Persistence

### Issues Addressed
1. **Settings Persistence**
   - Daily sales projection settings were not persisting after browser refresh
   - Settings were being overwritten by default values on component mount
   - MongoDB settings model had incorrect default values

2. **User Experience**
   - Page was reloading unnecessarily after analyzing past sales
   - No validation for projection settings total (must equal 100%)
   - Insufficient error handling and user feedback

### Technical Changes Made

#### Frontend (`client/src/`)
1. **SalesChart Component**
   - Fixed React hooks ordering issue
   - Added proper loading state management
   - Updated settings initialization to prevent defaults from overriding saved settings
   - Improved error handling and user feedback

2. **Settings Component**
   - Removed immediate server save after analysis to prevent unwanted reload
   - Added validation to ensure projection percentages total 100%
   - Improved local state management for settings changes
   - Added detailed logging for better debugging

#### Backend (`server/src/`)
1. **Settings Model**
   - Updated default projection settings to match expected values
   - Fixed settings persistence in MongoDB

2. **API Endpoints**
   - Enhanced error handling in settings routes
   - Added validation for settings updates
   - Improved logging for debugging

### Key Learnings
1. **React State Management**
   - Always initialize state with null or loading state when data needs to be fetched
   - Use proper loading states to prevent flashing of default values
   - Follow React hooks rules strictly (no conditional hook calls)

2. **Data Persistence**
   - Validate data before saving to prevent invalid states
   - Use proper error handling and rollback mechanisms
   - Add comprehensive logging for debugging

3. **User Experience**
   - Avoid unnecessary page reloads
   - Provide clear feedback for user actions
   - Validate data on both client and server side

### Future Considerations
1. **Performance**
   - Consider implementing optimistic updates
   - Add caching for frequently accessed settings

2. **Error Handling**
   - Implement retry mechanisms for failed API calls
   - Add more detailed error messages

3. **Testing**
   - Add unit tests for settings validation
   - Add integration tests for settings persistence
   - Add end-to-end tests for critical user flows

## Next Steps
Phase 2 of the cleanup project will focus on [to be determined]... 