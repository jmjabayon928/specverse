'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type ApproveButtonProps = {
  sheetId: number
}

type ApproveAction = 'approve' | 'reject' | ''

const ApproveButton = (props: Readonly<ApproveButtonProps>) => {
  const { sheetId } = props

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
      const response = await fetch(`/api/backend/templates/${sheetId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          rejectComment: action === 'reject' ? comment.trim() : undefined,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (response.ok) {
        toast.success(action === 'approve' ? 'Template approved successfully' : 'Template rejected')
        router.push(`/datasheets/templates/${sheetId}`)
        return
      }

      const message =
        typeof result?.error === 'string'
          ? result.error
          : action === 'approve'
            ? 'Approval failed'
            : 'Rejection failed'
      toast.error(message)
    } catch (submitError: unknown) {
      console.error('Template approve/reject failed', submitError)
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleActionChange = (value: ApproveAction) => {
    setAction(value)
    if (value !== 'reject') {
      setComment('')
    }
  }

  const handleCommentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setComment(event.target.value)
  }

  const isApproveSelected = action === 'approve'
  const isRejectSelected = action === 'reject'

  return (
    <form onSubmit={handleSubmit} className="mt-8 border-t pt-6">
      <fieldset className="mb-4">
        <legend className="mb-2 block font-medium">
          Decision
        </legend>
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
            onChange={handleCommentChange}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 rounded bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Submit'}
      </button>
    </form>
  )
}

export default ApproveButton
