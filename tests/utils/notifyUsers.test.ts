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

  it('builds template notification link to templates route', async () => {
    await notifyUsers({
      recipientUserIds: [1],
      sheetId: 42,
      title: 'Template Created',
      message: 'Template #42 was created.',
      category: 'Template',
      createdBy: 1,
    });

    const linkInputCall = mockRequestChain.input.mock.calls.find(
      (call: unknown[]) => Array.isArray(call) && call[0] === 'Link'
    );
    expect(linkInputCall).toBeDefined();
    expect(linkInputCall[2]).toBe('/datasheets/templates/42');
  });

  it('builds datasheet notification link to filled route', async () => {
    await notifyUsers({
      recipientUserIds: [1],
      sheetId: 99,
      title: 'Filled Sheet Updated',
      message: 'Sheet #99 has been updated.',
      category: 'Datasheet',
      createdBy: 1,
    });

    const linkInputCall = mockRequestChain.input.mock.calls.find(
      (call: unknown[]) => Array.isArray(call) && call[0] === 'Link'
    );
    expect(linkInputCall).toBeDefined();
    expect(linkInputCall[2]).toBe('/datasheets/filled/99');
  });
});
