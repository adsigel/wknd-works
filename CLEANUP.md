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