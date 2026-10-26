const DB_NAME = 'cardrealm.cardart.v1';
const STORE_NAME = 'art';

let dbPromise = null;
const cache = new Map();

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('当前环境无法使用本地卡面仓库。'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开本地卡面仓库。'));
  });
  return dbPromise;
}

function runRequest(mode, action) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let request;
    try {
      request = action(store);
    } catch (error) {
      reject(error);
      return;
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('本地卡面仓库读写失败。'));
    tx.onabort = () => reject(tx.error || new Error('本地卡面仓库写入被中止。'));
  }));
}

export async function loadCardArt() {
  try {
    const records = await runRequest('readonly', (store) => store.getAll());
    cache.clear();
    for (const record of records || []) {
      if (record?.id && typeof record.data === 'string' && record.data.startsWith('data:image')) {
        cache.set(record.id, record.data);
      }
    }
    return cache;
  } catch {
    return cache;
  }
}

export function peekCardArt(cardId) {
  return cache.get(String(cardId || '')) || '';
}

export function cardArtCount() {
  return cache.size;
}

export async function saveCardArt(cardId, dataUrl) {
  const id = String(cardId || '');
  if (!id || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
    throw new Error('卡面数据无效。');
  }
  await runRequest('readwrite', (store) => store.put({ id, data: dataUrl, updatedAt: Date.now() }));
  cache.set(id, dataUrl);
  return dataUrl;
}

export async function deleteCardArt(cardId) {
  const id = String(cardId || '');
  if (!id) return;
  await runRequest('readwrite', (store) => store.delete(id));
  cache.delete(id);
}

export async function clearCardArt() {
  await runRequest('readwrite', (store) => store.clear());
  cache.clear();
}

export function peekCardArtMap() {
  return cache;
}