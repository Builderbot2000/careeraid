import { pathToFileURL } from 'url'

/**
 * Converts an absolute PDF path to a file:// URL string safe for use as an
 * iframe src in the renderer.  The renderer never calls Node APIs directly —
 * it receives this string over IPC.
 */
export function pdfPathToUrl(absolutePdfPath: string): string {
  return pathToFileURL(absolutePdfPath).href
}
