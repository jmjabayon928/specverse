// src/utils/datasheetExport.ts

import { saveAs } from 'file-saver'

export type ExportOptions = {
  sheetId: number
  type: 'pdf' | 'excel'
  unitSystem: 'SI' | 'USC'
  language: string
  sheetName: string
  revisionNum: number
  clientName: string
  isTemplate: boolean
}

export const handleExport = async ({
  sheetId,
  type,
  unitSystem,
  language,
  sheetName,
  revisionNum,
  clientName,
  isTemplate,
}: ExportOptions): Promise<void> => {
  try {
    const sheetType = isTemplate ? 'templates' : 'filledsheets'

    const response = await fetch(
      `/api/backend/${sheetType}/export/${sheetId}/${type}?uom=${unitSystem}&lang=${language}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    )

    if (!response.ok) {
      let details = `Export failed with status ${response.status}`

      try {
        const contentType = response.headers.get('Content-Type') ?? ''

        const isJson = contentType.toLowerCase().includes('application/json')
        if (isJson) {
          const body: unknown = await response.json()
          if (body && typeof body === 'object') {
            const rec = body as Record<string, unknown>
            const msg =
              (typeof rec.message === 'string' && rec.message.trim() !== ''
                ? rec.message
                : undefined) ??
              (typeof rec.error === 'string' && rec.error.trim() !== '' ? rec.error : undefined)

            if (msg) {
              details = `Export failed: ${msg}`
            }
          }
        } else {
          const text = (await response.text()).trim()
          if (text) {
            // Avoid dumping full HTML bodies into alerts; keep it short.
            details = `Export failed: ${text.slice(0, 300)}`
          }
        }
      } catch {
        // best-effort parsing only
      }

      throw new Error(details)
    }

    // Default filename
    let filename = `${isTemplate ? 'Template' : 'FilledSheet'}-${clientName}-${sheetName}-RevNo-${revisionNum}-${unitSystem}-${language}.${type === 'pdf' ? 'pdf' : 'xlsx'}`

    // Prefer server-provided filename (RFC 5987: filename*=UTF-8'')
    const disposition = response.headers.get('Content-Disposition') ?? ''
    const encodedNameMatch = /filename\*=UTF-8''([^;]+)/.exec(disposition)

    if (encodedNameMatch?.[1]) {
      filename = decodeURIComponent(encodedNameMatch[1])
    } else {
      // Fallback: plain filename="..."
      const plainNameMatch = /filename="([^"]+)"/.exec(disposition)
      if (plainNameMatch?.[1]) {
        filename = plainNameMatch[1]
      }
    }

    const blob = await response.blob()
    saveAs(blob, filename)
  } catch (error) {
    console.error('Export error:', error)
    const message =
      error instanceof Error && error.message.trim() !== ''
        ? error.message
        : 'An error occurred while exporting the datasheet.'
    alert(message)
  }
}
