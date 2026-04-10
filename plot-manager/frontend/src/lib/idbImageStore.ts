const DB_NAME = 'plotperfect-db';
const DB_VERSION = 1;
const STORE_NAME = 'images';

const apiUrl = (path: string) => {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!base) return path;
  const baseNoSlash = base.endsWith('/') ? base.slice(0, -1) : base;
  const pathWithSlash = path.startsWith('/') ? path : `/${path}`;
  return `${baseNoSlash}${pathWithSlash}`;
};

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

const getSignedUrlForS3Ref = async (ref: string) => {
  const cached = signedUrlCache.get(ref);
  if (cached && Date.now() < cached.expiresAt) return cached.url;

  try {
    const res = await fetch(
      apiUrl(`/api/storage/signed-url?key=${encodeURIComponent(ref)}`)
    );
    if (!res.ok) {
      console.warn('Failed to get signed URL, response not ok:', res.status, res.statusText);
      throw new Error('Could not resolve image');
    }
    const data = (await res.json()) as { url?: string };
    if (!data?.url) {
      console.warn('No URL in signed URL response');
      throw new Error('Could not resolve image');
    }

    signedUrlCache.set(ref, { url: data.url, expiresAt: Date.now() + 4 * 60 * 1000 });
    return data.url;
  } catch (error) {
    console.error('Error getting signed URL for S3 reference:', ref, error);
    throw error;
  }
};

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    
    // Add timeout to prevent hanging
    setTimeout(() => {
      if (req.result) return;
      reject(new Error('IndexedDB initialization timeout'));
    }, 5000);
  });

const withStore = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await openDb();

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const req = fn(store);

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);

    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      reject(tx.error);
      db.close();
    };
  });
};

export const putImageBlob = (key: string, blob: Blob) => withStore('readwrite', (s) => s.put(blob, key)).then(() => undefined);

export const getImageBlob = (key: string) => withStore<Blob | undefined>('readonly', (s) => s.get(key));

export const deleteImageBlob = (key: string) => withStore('readwrite', (s) => s.delete(key)).then(() => undefined);

export const storeFileImage = async (file: File, key: string) => {
  await putImageBlob(key, file);
  return `idb:${key}`;
};

export const storeDataUrlImage = async (dataUrl: string, key: string) => {
  const blob = await (await fetch(dataUrl)).blob();
  await putImageBlob(key, blob);
  return `idb:${key}`;
};

export const makeObjectUrlFromRef = async (ref: string) => {
  try {
    if (ref.startsWith('s3:')) {
      try {
        return await getSignedUrlForS3Ref(ref);
      } catch (s3Error) {
        console.warn('S3 URL resolution failed, using fallback:', s3Error);
        // Return a fallback URL or empty string
        return '';
      }
    }
    if (!ref.startsWith('idb:')) return ref;
    
    const key = ref.slice(4);
    const blob = await getImageBlob(key);
    if (!blob) {
      throw new Error('Image not found in IndexedDB');
    }
    return URL.createObjectURL(blob);
  } catch (error) {
    console.warn('Failed to resolve image reference:', ref, error);
    // Return empty string instead of throwing to prevent map crashes
    return '';
  }
};
