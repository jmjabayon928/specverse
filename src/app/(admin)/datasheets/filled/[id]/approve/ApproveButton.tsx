'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Button from '@/components/ui/button/Button'

type Props = {
  sheetId: number
}

type ApproveAction = 'approve' | 'reject' | ''

export default function ApproveButton({ sheetId }: Readonly<Props>) {
  const router = useRouter()
  const [action, setAction] = useState<ApproveAction>('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  const requiresComment = action === 'reject'
  const hasComment = comment.trim().length > 0

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (action === '') {
      toast.error('Please select Approve or Reject.')
      return
    }

    if (requiresComment && !hasComment) {
      toast.error('Rejection reason is required.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`/api/backend/filledsheets/${sheetId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejectComment: action === 'reject' ? comment.trim() : undefined,
        }),
      })

      const result = await res.json().catch(() => ({}))

      if (res.ok) {
        toast.success(
          action === 'approve'
            ? 'Filled sheet approved successfully'
            : 'Filled sheet rejected'
        )
        router.push(`/datasheets/filled/${sheetId}?success=${action === 'approve' ? 'approved' : 'rejected'}`)
        return
      }

      const message =
        typeof result?.error === 'string'
          ? result.error
          : action === 'approve'
            ? 'Approval failed'
            : 'Rejection failed'
      toast.error(message)
    } catch (err) {
      console.error('Filled sheet approve/reject failed', err)
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleActionChange = (value: ApproveAction) => {
    setAction(value)
    if (value !== 'reject') setComment('')
  }

  const isApproveSelected = action === 'approve'
  const isRejectSelected = action === 'reject'

  return (
    <form onSubmit={handleSubmit} className="mt-8 border-t pt-6">
      <fieldset className="mb-4">
        <legend className="mb-2 block font-medium">Decision</legend>
        <div className="flex items-center gap-6">
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="action"
              value="approve"
              checked={isApproveSelected}
              onChange={() => handleActionChange('approve')}
              required
            />
            <span className="ml-2">Approve</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="action"
              value="reject"
              checked={isRejectSelected}
              onChange={() => handleActionChange('reject')}
              required
            />
            <span className="ml-2">Reject</span>
          </label>
        </div>
      </fieldset>

      {isRejectSelected && (
        <div className="mb-4">
          <label htmlFor="rejectComment" className="mb-1 block font-medium">
            Rejection Reason (required)
          </label>
          <textarea
            id="rejectComment"
            name="rejectComment"
            rows={3}
            className="w-full rounded border border-gray-300 px-3 py-2"
            placeholder="Please provide the reason for rejection"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="mt-6 bg-green-600 hover:bg-green-700 text-white"
      >
        {loading ? 'Processing...' : 'Submit'}
      </Button>
    </form>
  )
}
