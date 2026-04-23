import { EventEmitter } from 'events'
import { initDb, getDb, closeDb } from '../db/database'

export type WriteLockHolder = 'scraper' | null

const dbEvents = new EventEmitter()
let writeLockHolder: WriteLockHolder = null

export function initConnectionManager(): void {
  initDb()
}

export { getDb, closeDb, dbEvents }

/**
 * Attempt to acquire the write lock.
 * Returns true if acquired, false if already held by another holder.
 */
export function acquireWriteLock(holder: NonNullable<WriteLockHolder>): boolean {
  if (writeLockHolder !== null) return false
  writeLockHolder = holder
  dbEvents.emit('write-lock-acquired', holder)
  return true
}

export function releaseWriteLock(): void {
  const prev = writeLockHolder
  writeLockHolder = null
  dbEvents.emit('write-lock-released', prev)
}

export function getWriteLockHolder(): WriteLockHolder {
  return writeLockHolder
}
