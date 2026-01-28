// src/app/(admin)/datasheets/templates/[id]/verify/VerifyForm.tsx
'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type VerifyFormProps = {
  sheetId: number
}

type VerifyAction = 'verify' | 'reject' | ''

const VerifyForm = (props: Readonly<VerifyFormProps>) => {
  const { sheetId } = props

  const [action, setAction] = useState<VerifyAction>('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  const requiresComment = action === 'reject'
  const hasComment = comment.trim().length > 0

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (action === '') {
      globalThis.alert('Please select Verify or Reject.')
      return
    }

    if (requiresComment && !hasComment) {
      globalThis.alert('Rejection comment is required.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/backend/templates/${sheetId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetId,
          action,
          rejectionComment: comment,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (response.ok) {
        router.push(`/datasheets/templates/${sheetId}`)
        return
      }

      const message =
        typeof result?.error === 'string'
          ? result.error
          : 'Verification failed'
      globalThis.alert(message)
    } catch (submitError: unknown) {
      console.error('Error during template verification', submitError)
      globalThis.alert('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleActionChange = (value: VerifyAction) => {
    setAction(value)

    if (value !== 'reject') {
      setComment('')
    }
  }

  const handleCommentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setComment(event.target.value)
  }

  const isVerifySelected = action === 'verify'
  const isRejectSelected = action === 'reject'

  return (
    <form
      onSubmit={handleSubmit}
      className='mt-8 border-t pt-6'
    >
      <fieldset className='mb-4'>
        <legend className='mb-2 block font-medium'>
          Decision
        </legend>
        <div className='flex items-center gap-6'>
          <label className='inline-flex items-center'>
            <input
              type='radio'
              name='action'
              value='verify'
              checked={isVerifySelected}
              onChange={() => handleActionChange('verify')}
              required
            />
            <span className='ml-2'>
              Verify
            </span>
          </label>
          <label className='inline-flex items-center'>
            <input
              type='radio'
              name='action'
              value='reject'
              checked={isRejectSelected}
              onChange={() => handleActionChange('reject')}
              required
            />
            <span className='ml-2'>
              Reject
            </span>
          </label>
        </div>
      </fieldset>

      {isRejectSelected && (
        <div className='mb-4'>
          <label
            htmlFor='rejectionComment'
            className='mb-1 block font-medium'
          >
            Rejection Comment
          </label>
          <textarea
            id='rejectionComment'
            name='rejectionComment'
            rows={3}
            className='w-full rounded border border-gray-300 px-3 py-2'
            placeholder='Please provide the reason for rejection'
            value={comment}
            onChange={handleCommentChange}
          />
        </div>
      )}

      <button
        type='submit'
        disabled={loading}
        className='mt-4 rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50'
      >
        {loading ? 'Processing...' : 'Submit'}
      </button>
    </form>
  )
}

export default VerifyForm
