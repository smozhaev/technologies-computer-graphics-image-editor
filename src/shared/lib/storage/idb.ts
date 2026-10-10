/** Tiny promise wrapper over one IndexedDB object store (key → structured-cloneable value). */

const DB_NAME = 'graybit-studio'
const STORE = 'kv'

function available(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      const req = fn(t.objectStore(STORE))
      t.oncomplete = () => resolve(req.result)
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error)
    })
  } finally {
    db.close()
  }
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  if (!available()) return undefined
  return tx('readonly', (s) => s.get(key) as IDBRequest<T | undefined>)
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  if (!available()) return
  await tx('readwrite', (s) => s.put(value, key))
}

export async function idbDelete(key: string): Promise<void> {
  if (!available()) return
  await tx('readwrite', (s) => s.delete(key))
}
