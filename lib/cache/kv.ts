// Tiny persistent key-value store (IndexedDB). Never throws: a failure just means "no cache".
const DB_NAME = "anaija-cache";
const STORE = "kv";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      res(db);
    };
    req.onerror = () => {
      dbPromise = null;
      rej(req.error);
    };
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open()
    .then(
      (db) =>
        new Promise<T | undefined>((res) => {
          const tx = db.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          tx.oncomplete = () => res(req.result);
          tx.onerror = () => res(undefined);
          tx.onabort = () => res(undefined);
        }),
    )
    .catch(() => undefined);
}

export const kvGet = <T>(key: string) => run<T>("readonly", (s) => s.get(key));
export const kvSet = (key: string, value: unknown) => run("readwrite", (s) => s.put(value, key)).then(() => undefined);
export const kvDelete = (key: string) => run("readwrite", (s) => s.delete(key)).then(() => undefined);
export const kvClear = () => run("readwrite", (s) => s.clear()).then(() => undefined);

/** Every entry in one transaction. Used once at boot to warm the in-memory cache. */
export function kvAll(): Promise<[string, unknown][]> {
  return open()
    .then(
      (db) =>
        new Promise<[string, unknown][]>((res) => {
          const out: [string, unknown][] = [];
          const tx = db.transaction(STORE, "readonly");
          const req = tx.objectStore(STORE).openCursor();
          req.onsuccess = () => {
            const c = req.result;
            if (c) {
              out.push([String(c.key), c.value]);
              c.continue();
            }
          };
          tx.oncomplete = () => res(out);
          tx.onerror = () => res([]);
          tx.onabort = () => res([]);
        }),
    )
    .catch(() => [] as [string, unknown][]);
}
