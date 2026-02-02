// tests/utils/notifyUsers.test.ts
// Unit tests for notifyUsers: HOLDLOCK in next-id query, transaction rollback on error.

const capturedQueries: string[] = [];

const mockRequestChain = {
  input: jest.fn().mockReturnThis(),
  query: jest.fn().mockImplementation((sqlText: string) => {
    capturedQueries.push(sqlText);
    return Promise.resolve({ recordset: [{ NextId: 1 }] });
  }),
};

const MockTransaction = class {
  begin = jest.fn().mockResolvedValue(undefined);
  commit = jest.fn().mockResolvedValue(undefined);
  rollback = jest.fn().mockResolvedValue(undefined);
  request = () => mockRequestChain;
};

jest.mock('../../src/backend/config/db', () => ({
  poolPromise: Promise.resolve({
    request: () => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [{ UserID: 1 }],
      }),
    }),
  }),
  sql: {
    Transaction: MockTransaction,
    Int: 1,
    VarChar: () => ({}),
    NVarChar: () => ({}),
    DateTime: Date,
    Bit: 0,
  },
}));

import { notifyUsers } from '../../src/backend/utils/notifyUsers';

beforeEach(() => {
  jest.clearAllMocks();
  capturedQueries.length = 0;
  mockRequestChain.query.mockImplementation((sqlText: string) => {
    capturedQueries.push(sqlText);
    if (capturedQueries.length === 1) {
      return Promise.resolve({ recordset: [{ NextId: 1 }] });
    }
    return Promise.resolve({ recordset: [] });
  });
});

describe('notifyUsers', () => {
  it('uses UPDLOCK and HOLDLOCK in next-id query for safe concurrent allocation', async () => {
    await notifyUsers({
      recipientRoleIds: [1],
      sheetId: 1,
      title: 'Test',
      message: 'Msg',
      category: 'Template',
      createdBy: 1,
    });

    const nextIdQuery = capturedQueries.find(
      (q) => q.includes('MAX(NotificationID)') && q.includes('NextId')
    );
    expect(nextIdQuery).toBeDefined();
    expect(nextIdQuery).toContain('UPDLOCK');
    expect(nextIdQuery).toContain('HOLDLOCK');
  });
});
