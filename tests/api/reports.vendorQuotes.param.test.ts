// Mock the DB layer to capture inputs and SQL
const inputMock = jest.fn().mockReturnThis()
const queryMock = jest.fn().mockResolvedValue({ recordset: [] })
const requestMock = jest.fn(() => ({
  input: inputMock,
  query: queryMock,
}))

jest.mock('../../src/backend/config/db', () => {
  const sql = { Int: 'Int' as unknown as number }

  return {
    sql,
    poolPromise: Promise.resolve({ request: requestMock }),
  }
})

import { getVendorQuotesFromDB } from '../../src/backend/services/reportsService'

describe('getVendorQuotesFromDB', () => {
  it('uses the passed EstimationID parameter in the SQL query', async () => {
    const estimationId = 123

    await getVendorQuotesFromDB(estimationId)

    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(inputMock).toHaveBeenCalledTimes(1)

    const [nameArg, , valueArg] = inputMock.mock.calls[0]
    expect(nameArg).toBe('EstimationID')
    expect(valueArg).toBe(estimationId)

    expect(queryMock).toHaveBeenCalledTimes(1)
    const sqlText = queryMock.mock.calls[0][0] as string
    expect(sqlText).toContain('WHERE ei.EstimationID = @EstimationID')
    expect(sqlText).not.toContain('WHERE ei.EstimationID = 1')
  })
})

