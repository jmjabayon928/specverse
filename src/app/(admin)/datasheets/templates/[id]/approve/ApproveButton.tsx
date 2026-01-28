'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Button from '@/components/ui/button/Button'

type ApproveButtonProps = {
  sheetId: number
}

const ApproveButton = (props: Readonly<ApproveButtonProps>) => {
  const { sheetId } = props

  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleApprove = async () => {
    const confirmed = globalThis.confirm('Are you sure you want to approve this template?')

    if (!confirmed) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/backend/templates/${sheetId}/approve`, {
        method: 'POST',
      })

      if (response.ok) {
        toast.success('Template approved successfully')
        router.push(`/datasheets/templates/${sheetId}`)
        return
      }

      const text = await response.text().catch(() => '')
      const message = text || 'Approval failed'
      throw new Error(message)
    } catch (error: unknown) {
      // Keep this log small and useful
      console.error('Template approval failed', error)
      toast.error('Error approving template')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Button
      onClick={handleApprove}
      disabled={isSubmitting}
      className='mt-6 bg-green-600 hover:bg-green-700 text-white'
    >
      {isSubmitting ? 'Approving...' : 'Approve'}
    </Button>
  )
}

export default ApproveButton
