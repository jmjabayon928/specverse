import { TextEncoder, TextDecoder } from 'node:util'

const encoderIsMissing = globalThis.TextEncoder === undefined
const decoderIsMissing = globalThis.TextDecoder === undefined

if (encoderIsMissing) {
  Object.defineProperty(globalThis, 'TextEncoder', {
    value: TextEncoder,
    writable: false,
    configurable: true
  })
}

if (decoderIsMissing) {
  Object.defineProperty(globalThis, 'TextDecoder', {
    value: TextDecoder,
    writable: false,
    configurable: true
  })
}
