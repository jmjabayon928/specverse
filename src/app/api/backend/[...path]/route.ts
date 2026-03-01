import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: {
    path: string[]
  }
}

const getBackendOrigin = (): string => {
  const internal = process.env.BACKEND_INTERNAL_ORIGIN
  if (internal && internal.length > 0) {
    return internal.replace(/\/+$/, '')
  }
  const origin = process.env.BACKEND_ORIGIN
  if (origin && origin.length > 0) {
    return origin.replace(/\/+$/, '')
  }
  return 'http://127.0.0.1:4000'
}

const buildUpstreamUrl = (req: NextRequest, context: RouteContext): string => {
  const origin = getBackendOrigin()
  const segments = Array.isArray(context.params.path) ? context.params.path : [context.params.path]
  const joined = segments.join('/')
  const search = req.nextUrl.search

  const base = `${origin}/api/backend`
  const path = joined ? `/${joined}` : ''

  return `${base}${path}${search}`
}

const prepareHeaders = (req: NextRequest): Headers => {
  const headers = new Headers(req.headers)
  headers.delete('host')
  headers.delete('connection')
  headers.delete('content-length')
  headers.delete('accept-encoding')
  headers.delete('transfer-encoding')
  headers.delete('keep-alive')
  headers.delete('proxy-authenticate')
  headers.delete('proxy-authorization')
  headers.delete('te')
  headers.delete('trailer')
  headers.delete('upgrade')
  return headers
}

const createBackendResponse = async (upstream: Response): Promise<Response> => {
  const resBody = await upstream.arrayBuffer()
  const upstreamHeaders = upstream.headers as Headers & {
    getSetCookie?: () => string[]
  }
  const responseHeaders = new Headers(upstreamHeaders)
  responseHeaders.delete('set-cookie')

  const setCookies = upstreamHeaders.getSetCookie?.()
  if (Array.isArray(setCookies)) {
    for (const cookie of setCookies) {
      responseHeaders.append('set-cookie', cookie)
    }
  } else {
    const singleSetCookie = upstreamHeaders.get('set-cookie')
    if (singleSetCookie) {
      responseHeaders.append('set-cookie', singleSetCookie)
    }
  }

  return new Response(resBody, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

const handleRequest = async (req: NextRequest, context: RouteContext): Promise<Response> => {
  const upstreamUrl = buildUpstreamUrl(req, context)
  const method = req.method.toUpperCase()
  const headers = prepareHeaders(req)

  let body: ArrayBuffer | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    body = await req.arrayBuffer()
  }

  const upstream = await fetch(upstreamUrl, {
    method,
    headers,
    body,
    redirect: 'manual',
    cache: 'no-store',
  })

  return createBackendResponse(upstream)
}

export const GET = (req: NextRequest, context: RouteContext) => handleRequest(req, context)
export const POST = (req: NextRequest, context: RouteContext) => handleRequest(req, context)
export const PUT = (req: NextRequest, context: RouteContext) => handleRequest(req, context)
export const PATCH = (req: NextRequest, context: RouteContext) => handleRequest(req, context)
export const DELETE = (req: NextRequest, context: RouteContext) => handleRequest(req, context)
export const OPTIONS = (req: NextRequest, context: RouteContext) => handleRequest(req, context)

