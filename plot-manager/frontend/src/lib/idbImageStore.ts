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

// MongoDB image storage helpers
const getAuthHeaders = () => {
  const user = localStorage.getItem('realestate-user');
  if (!user) return {};
  const parsed = JSON.parse(user);
  return parsed?.token ? { Authorization: `Bearer ${parsed.token}` } : {};
};

export const uploadImageToMongo = async (dataUrl: string, contentType?: string): Promise<{ id: string; url: string }> => {
  const res = await fetch(apiUrl('/api/images/upload'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ image: dataUrl, contentType: contentType || 'image/jpeg' }),
  });

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }

  return res.json();
};

const imageUrlCache = new Map<string, string>();

const getMongoImageUrl = (ref: string): string => {
  const id = ref.startsWith('mongo:') ? ref.slice(6) : ref;
  const cached = imageUrlCache.get(id);
  if (cached) return cached;
  
  const url = apiUrl(`/api/images/${id}`);
  imageUrlCache.set(id, url);
  return url;
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
    // MongoDB stored image
    if (ref.startsWith('mongo:')) {
      return getMongoImageUrl(ref);
    }
    // Legacy S3 refs - return empty (S3 disabled)
    if (ref.startsWith('s3:')) {
      console.warn('S3 storage disabled, image not available:', ref);
      return '';
    }
    // Direct URL or data URL
    if (!ref.startsWith('idb:')) return ref;
    
    // IndexedDB fallback
    const key = ref.slice(4);
    const blob = await getImageBlob(key);
    if (!blob) {
      throw new Error('Image not found in IndexedDB');
    }
    return URL.createObjectURL(blob);
  } catch (error) {
    console.warn('Failed to resolve image reference:', ref, error);
    return '';
  }
};
