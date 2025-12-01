import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Ensures a directory exists. Creates it recursively if missing.
 */
function ensureDir(dirPath: string): void {
  const exists = fs.existsSync(dirPath)
  if (exists) return

  fs.mkdirSync(dirPath, { recursive: true })
}

/**
 * Creates a safe filename with a timestamp prefix.
 */
function makeSafeFilename(originalName: string): string {
  const timestamp = Date.now()
  const safe = originalName.replaceAll(/\s+/g, "_")
  return `${timestamp}_${safe}`
}

/**
 * Base folder for all uploaded attachments.
 * We keep it under /public/attachments for static serving.
 */
const ATTACH_DIR = path.join(process.cwd(), "public", "attachments")
ensureDir(ATTACH_DIR)

/**
 * Multer disk storage using:
 * - safe timestamped filenames
 * - guaranteed directory
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ATTACH_DIR)
  },
  filename: (_req, file, cb) => {
    const safeName = makeSafeFilename(file.originalname)
    cb(null, safeName)
  },
})

/**
 * Exported Multer instance for routes that accept a single file.
 *
 * Usage (routes):
 *    router.post("/attachments/:id", uploadAttachment.single("file"), handler)
 */
export const uploadAttachment = multer({ storage })

/**
 * Re-export the base directory so controllers can use it
 * for generating relative paths, cleanup, or checks if needed.
 */
export const ATTACHMENT_BASE_DIR = ATTACH_DIR
