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
      throw new Error(`Export failed with status ${response.status}`)
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
    // Still log for debugging; message stays user-friendly
    console.error('Export error:', error)
    alert('An error occurred while exporting the datasheet.')
  }
}
