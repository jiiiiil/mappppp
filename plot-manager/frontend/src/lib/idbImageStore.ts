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
  console.log('[getAuthHeaders] localStorage user:', user?.substring(0, 100));
  if (!user) {
    console.warn('[getAuthHeaders] No user in localStorage');
    return {};
  }
  const parsed = JSON.parse(user);
  console.log('[getAuthHeaders] Parsed user:', { id: parsed?.id, role: parsed?.role, hasToken: !!parsed?.token });
  if (!parsed?.token) {
    console.warn('[getAuthHeaders] No token in user object');
    return {};
  }
  const headers = { Authorization: `Bearer ${parsed.token}` };
  console.log('[getAuthHeaders] Returning headers:', headers);
  return headers;
};

export const uploadImageToMongo = async (dataUrl: string, contentType?: string): Promise<{ id: string; url: string }> => {
  console.log('[uploadImageToMongo] Starting upload, dataUrl length:', dataUrl.length);
  const res = await fetch(apiUrl('/api/images/upload'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ image: dataUrl, contentType: contentType || 'image/jpeg' }),
  });

  if (!res.ok) {
    console.error('[uploadImageToMongo] Upload failed:', res.status);
    throw new Error(`Upload failed: ${res.status}`);
  }

  const result = await res.json();
  console.log('[uploadImageToMongo] Upload success:', result);
  return result;
};

const getMongoImageUrl = (ref: string): string => {
  console.log('[getMongoImageUrl] Input ref:', ref?.substring(0, 30));
  const id = ref.startsWith('mongo:') ? ref.slice(6) : ref;
  console.log('[getMongoImageUrl] Extracted id:', id?.substring(0, 30));
  if (!id) {
    console.warn('[getMongoImageUrl] Empty id, returning empty string');
    return '';
  }
  
  // Always use fresh timestamp to prevent browser caching issues
  const timestamp = Date.now();
  const url = apiUrl(`/api/images/${id}?t=${timestamp}`);
  console.log('[getMongoImageUrl] Final URL:', url);
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
  console.log('[makeObjectUrlFromRef] Resolving ref:', ref?.substring(0, 50));
  try {
    // MongoDB stored image
    if (ref.startsWith('mongo:')) {
      const url = getMongoImageUrl(ref);
      console.log('[makeObjectUrlFromRef] MongoDB URL:', url);
      return url;
    }
    // Legacy S3 refs - return empty (S3 disabled)
    if (ref.startsWith('s3:')) {
      console.warn('[makeObjectUrlFromRef] S3 storage disabled, image not available:', ref);
      return '';
    }
    // Direct URL or data URL
    if (!ref.startsWith('idb:')) {
      console.log('[makeObjectUrlFromRef] Direct URL:', ref?.substring(0, 50));
      return ref;
    }
    
    // IndexedDB fallback
    const key = ref.slice(4);
    console.log('[makeObjectUrlFromRef] IndexedDB key:', key);
    const blob = await getImageBlob(key);
    if (!blob) {
      throw new Error('Image not found in IndexedDB');
    }
    return URL.createObjectURL(blob);
  } catch (error) {
    console.warn('[makeObjectUrlFromRef] Failed to resolve image reference:', ref, error);
    return '';
  }
};
