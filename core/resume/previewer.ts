/**
 * Converts an absolute PDF path to a resume:// URL for iframe display in the
 * sandboxed renderer. The main process serves resume:// via protocol.handle,
 * which forwards to net.fetch(file://...) — bypassing Chromium's cross-path
 * file:// restriction that would otherwise blank the iframe.
 */
export function pdfPathToUrl(absolutePdfPath: string): string {
  const encoded = absolutePdfPath.split(/[\\/]/).map(encodeURIComponent).join('/')
  return `resume://local/${encoded}`
}
