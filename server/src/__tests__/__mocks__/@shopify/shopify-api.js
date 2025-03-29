export const shopifyApi = {
  initialize: jest.fn(),
  clients: {
    Graphql: jest.fn().mockImplementation(() => ({
      query: jest.fn().mockResolvedValue({
        body: {
          data: {
            orders: {
              edges: [
                {
                  node: {
                    id: '1',
                    createdAt: '2024-01-01T00:00:00Z',
                    currentTotalPriceSet: {
                      shopMoney: {
                        amount: '100.00'
                      }
                    }
                  }
                }
              ],
              pageInfo: {
                hasNextPage: false
              }
            }
          }
        }
      })
    }))
  }
};

export const LATEST_API_VERSION = '2024-01'; 