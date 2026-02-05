// tests/ui/estimation/EstimationTable.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import EstimationTable from '../../../src/components/estimation/EstimationTable'
import type { Estimation } from '../../../src/domain/estimations/estimationTypes'

function makeEstimation(overrides: Partial<Estimation> = {}): Estimation {
  return {
    EstimationID: 1,
    ClientID: 10,
    ProjectID: 20,
    Title: 'Test Estimate',
    Status: 'Draft',
    CreatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('EstimationTable', () => {
  it('renders client and project names in table when API returns ClientName and ProjName', () => {
    const estimations: Estimation[] = [
      makeEstimation({
        EstimationID: 1,
        ClientName: 'Acme Corp',
        ProjectName: 'Phase 1 Build',
        Title: 'Piping Estimate',
      }),
      makeEstimation({
        EstimationID: 2,
        ClientName: 'Beta Inc',
        ProjName: 'Reno 2025',
        Title: 'Electrical Estimate',
      } as Estimation & { ProjName?: string }),
    ]
    render(<EstimationTable estimations={estimations} />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Phase 1 Build')).toBeInTheDocument()
    expect(screen.getByText('Beta Inc')).toBeInTheDocument()
    expect(screen.getByText('Reno 2025')).toBeInTheDocument()
  })

  it('shows dash when client or project name is missing', () => {
    const estimations: Estimation[] = [
      makeEstimation({ ClientName: undefined, ProjectName: undefined }),
    ]
    render(<EstimationTable estimations={estimations} />)
    const cells = screen.getAllByText('-')
    expect(cells.length).toBeGreaterThanOrEqual(2)
  })
})
