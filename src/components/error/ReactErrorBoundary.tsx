'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  route: string
  buildId: string
  userId: number | null
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ReactErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error({
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      route: this.props.route,
      buildId: this.props.buildId,
      userId: this.props.userId,
      errorName: error.name,
      timestamp: new Date().toISOString(),
    })
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Route: {this.props.route}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
