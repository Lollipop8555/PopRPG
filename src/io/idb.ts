/**
 * 皮肤**包体**的二进制存储（裁决 15）。
 *
 * `.pp` 是二进制 zip，体积远超 `localStorage` 的配额，且 `localStorage` 只能存字符串
 * （需 base64，再膨胀三分之一）——因此条目索引走 `localStorage`，包体走 IndexedDB。
 * 这是对「数据只走 `localStorage`」约定的一处扩展，仍为纯客户端、离线可用（`08-deploy.md` §9）。
 *
 * IndexedDB 不可用（隐私模式 / 测试环境）时降级为内存实现：当次会话有效，不报错。
 */

/** 包体存储：只按 id 存取整包字节，不做逐文件拆解 */
export interface BlobStore {
  get(id: string): Promise<Uint8Array | undefined>
  put(id: string, bytes: Uint8Array): Promise<void>
  remove(id: string): Promise<void>
  keys(): Promise<string[]>
}

/** 内存实现：测试与「无 IndexedDB」环境共用 */
export function createMemoryBlobStore(seed?: Record<string, Uint8Array>): BlobStore {
  const map = new Map<string, Uint8Array>(Object.entries(seed ?? {}))
  return {
    get: async (id) => map.get(id),
    put: async (id, bytes) => void map.set(id, bytes),
    remove: async (id) => void map.delete(id),
    keys: async () => [...map.keys()],
  }
}

const DB_NAME = 'poprpg'
const STORE_NAME = 'skins'

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 操作失败'))
  })
}

function openDb(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'))
  })
}

/**
 * IndexedDB 实现；环境没有 IndexedDB 时返回 `undefined`（调用方回退内存实现）。
 * 每次操作独立开关连接：皮肤读写是低频操作，省掉连接生命周期的管理。
 */
export function createIndexedDbBlobStore(
  dbName = DB_NAME,
  storeName = STORE_NAME,
): BlobStore | undefined {
  if (typeof indexedDB === 'undefined') return undefined

  async function withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await openDb(dbName, storeName)
    try {
      return await request(run(db.transaction(storeName, mode).objectStore(storeName)))
    } finally {
      db.close()
    }
  }

  return {
    get: (id) =>
      withStore<Uint8Array | undefined>('readonly', (store) => store.get(id) as IDBRequest<Uint8Array | undefined>),
    put: async (id, bytes) => {
      await withStore('readwrite', (store) => store.put(bytes, id) as IDBRequest<IDBValidKey>)
    },
    remove: async (id) => {
      await withStore('readwrite', (store) => store.delete(id) as IDBRequest<undefined>)
    },
    keys: () =>
      withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys() as IDBRequest<IDBValidKey[]>).then(
        (keys) => keys.map(String),
      ),
  }
}

/** 默认包体存储：优先 IndexedDB，不可用则内存（当次会话有效） */
export function defaultBlobStore(): BlobStore {
  return createIndexedDbBlobStore() ?? createMemoryBlobStore()
}
