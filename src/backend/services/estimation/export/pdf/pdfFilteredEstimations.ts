// src/backend/services/estimation/export/pdf/pdfFilteredEstimations.ts

import puppeteer from 'puppeteer'

import { getFilteredEstimations } from '@/backend/database/estimationQueries'
import { formatDate } from '../common/exportHelpers'

export interface FilteredEstimationsPdfInput {
  statuses: string[]
  clients: number[]
  projects: number[]
  search: string
}

type FilteredEstimationRow = {
  EstimationID: number
  Title: string
  Description?: string | null
  Status: string
  ClientName?: string | null
  ProjectName?: string | null
  CreatedAt?: string | number | Date | null
}

export const generateFilteredEstimationsPdf = async (
  input: FilteredEstimationsPdfInput,
): Promise<Buffer> => {
  const { statuses, clients, projects, search } = input

  const estimations = await getFilteredEstimations(
    statuses,
    clients,
    projects,
    search,
  ) as FilteredEstimationRow[]

  const html = buildFilteredEstimationsHtml(estimations)

  const browser = await puppeteer.launch({
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '7mm',
        right: '7mm',
      },
    })

    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

const buildFilteredEstimationsHtml = (
  estimations: FilteredEstimationRow[],
): string => {
  const rowsHtml = estimations
    .map(est => {
      const description = est.Description || '-'
      const clientName = est.ClientName || '-'
      const projectName = est.ProjectName || '-'
      const createdAt = formatDate(est.CreatedAt)

      return `
        <tr>
          <td>${est.EstimationID}</td>
          <td>${est.Title}</td>
          <td>${description}</td>
          <td>${est.Status}</td>
          <td>${clientName}</td>
          <td>${projectName}</td>
          <td>${createdAt}</td>
        </tr>
      `
    })
    .join('')

  return `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            font-size: 11px;
            padding: 20px;
            color: #333333;
          }
          h1 {
            color: #1a3c66;
            margin-bottom: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 10px;
          }
          th, td {
            border: 1px solid #cccccc;
            padding: 6px;
            text-align: left;
          }
          th {
            background: #f0f0f0;
          }
        </style>
      </head>
      <body>
        <h1>Filtered Estimations</h1>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Description</th>
              <th>Status</th>
              <th>Client</th>
              <th>Project</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `
}
