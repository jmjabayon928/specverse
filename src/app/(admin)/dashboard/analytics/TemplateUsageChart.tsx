// src/app/(admin)/dashboard/analytics/TemplateUsageChart.tsx

'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

// Raw data from backend
interface RawTemplateUsage {
  TemplateName: string
  Month: string
  UsageCount: number
}

// Grouped data format for chart
type ChartRow = {
  month: string
} & Record<string, number | string>

type TemplateUsageResponse = RawTemplateUsage[]

const COLORS = [
  '#82ca9d',
  '#8884d8',
  '#ffc658',
  '#ff8042',
  '#00C49F',
  '#FFBB28',
  '#A28DFF',
  '#FF6699',
  '#33CC99',
  '#3399FF',
]

function isRawTemplateUsage(value: unknown): value is RawTemplateUsage {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<Record<keyof RawTemplateUsage, unknown>>

  const hasTemplateName = typeof candidate.TemplateName === 'string'
  const hasMonth = typeof candidate.Month === 'string'
  const hasUsageCount = typeof candidate.UsageCount === 'number'

  if (hasTemplateName && hasMonth && hasUsageCount) {
    return true
  }

  return false
}

function isTemplateUsageResponse(value: unknown): value is TemplateUsageResponse {
  if (!Array.isArray(value)) {
    return false
  }

  for (const item of value) {
    if (!isRawTemplateUsage(item)) {
      return false
    }
  }

  return true
}

export default function TemplateUsageChart() {
  const [data, setData] = useState<ChartRow[]>([])
  const [templateNames, setTemplateNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/backend/stats/template-usage', {
          credentials: 'include',
        })
        if (!res.ok) {
          throw new Error('Failed to fetch template usage data')
        }

        const rawJson: unknown = await res.json()

        if (!isTemplateUsageResponse(rawJson)) {
          // Unexpected shape, log and bail out gracefully
          console.error('Unexpected template usage payload shape', rawJson)
          return
        }

        const json = rawJson

        const grouped: Record<string, ChartRow> = {}
        const templateSet = new Set<string>()

        for (const row of json) {
          const monthKey = row.Month
          const templateKey = row.TemplateName

          templateSet.add(templateKey)

          grouped[monthKey] ??= { month: monthKey }

          grouped[monthKey][templateKey] = row.UsageCount
        }

        const sorted = Object.values(grouped).sort((a, b) =>
          a.month.localeCompare(b.month),
        )

        setData(sorted)
        setTemplateNames(Array.from(templateSet))
      } catch (error) {
        console.error('Error fetching template usage data:', error)
      } finally {
        setLoading(false)
      }
    }

    void fetchData()
  }, [])

  if (loading) {
    return <Skeleton className='h-[300px] w-full rounded-xl' />
  }

  return (
    <ResponsiveContainer width='100%' height={300}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray='3 3' />
        <XAxis dataKey='month' />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />

        {templateNames.map((name, index) => (
          <Area
            key={name}
            type='monotone'
            dataKey={name}
            name={name}
            stroke={COLORS[index % COLORS.length]}
            fill={COLORS[index % COLORS.length]}
            fillOpacity={0.3}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
