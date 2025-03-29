export default {
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js'],
  transformIgnorePatterns: [
    'node_modules/(?!@shopify/shopify-api)'
  ]
}; 