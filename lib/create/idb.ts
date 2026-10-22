// One IndexedDB database for the composer: drafts + pending uploads. Files/Blobs are stored natively.
const DB_NAME = "anaija-composer";
const VERSION = 2;

export type StoreName = "drafts" | "uploads";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("drafts")) db.createObjectStore("drafts", { keyPath: "draftId" });
      if (!db.objectStoreNames.contains("uploads")) db.createObjectStore("uploads", { keyPath: "id" });
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

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((res, rej) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => res(req.result);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export const idbPut = (store: StoreName, value: unknown) => run(store, "readwrite", (s) => s.put(value)).then(() => undefined);
export const idbGet = <T>(store: StoreName, key: string) => run<T | undefined>(store, "readonly", (s) => s.get(key));
export const idbAll = <T>(store: StoreName) => run<T[]>(store, "readonly", (s) => s.getAll());
export const idbDelete = (store: StoreName, key: string) => run(store, "readwrite", (s) => s.delete(key)).then(() => undefined);
