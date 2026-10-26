import { AUDIO_LIMITS } from './audio-data.js';

const DB_NAME = 'cardrealm.audio.v1';
const STORE_NAME = 'files';
const AUDIO_EXTENSION = /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm|opus)$/i;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('当前环境无法使用本地音频仓库。'));
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
    request.onerror = () => reject(request.error || new Error('无法打开本地音频仓库。'));
  });
  return dbPromise;
}

function audioId() {
  if (crypto.randomUUID) return `audio_${crypto.randomUUID()}`;
  return `audio_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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
    request.onerror = () => reject(request.error || new Error('本地音频仓库读写失败。'));
    tx.onabort = () => reject(tx.error || new Error('本地音频仓库写入被中止。'));
  }));
}

export async function saveAudioFile(blob, meta = {}) {
  const record = {
    id: audioId(),
    kind: meta.kind === 'music' ? 'music' : 'sfx',
    slot: String(meta.slot || ''),
    name: String(meta.name || '未命名音频').slice(0, 80),
    mime: String(meta.mime || '').slice(0, 80),
    size: Math.max(0, Number(blob?.size) || 0),
    duration: Math.max(0, Number(meta.duration) || 0),
    blob,
    createdAt: Date.now(),
  };
  await runRequest('readwrite', (store) => store.put(record));
  return record;
}

export async function loadAudioFile(id) {
  if (!id) return null;
  const record = await runRequest('readonly', (store) => store.get(id));
  return record?.blob ? record : null;
}

export async function deleteAudioFile(id) {
  if (!id) return;
  await runRequest('readwrite', (store) => store.delete(id));
}

export async function clearAudioFiles() {
  await runRequest('readwrite', (store) => store.clear());
}

export function audioFileError(file, kind) {
  if (!file) return '没有选中音频。';
  const limit = AUDIO_LIMITS[kind === 'music' ? 'music' : 'sfx'];
  if (!file.type?.startsWith('audio/') && !AUDIO_EXTENSION.test(file.name || '')) {
    return '请选择 mp3、wav、ogg、m4a、flac 等音频文件。';
  }
  if (file.size <= 0) return '这个文件是空的。';
  if (file.size > limit.bytes) {
    return `文件太大了。${kind === 'music' ? '背景音乐' : '音效'}最大支持 ${limit.label}。`;
  }
  return null;
}

export function readAudioDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      probe.onloadedmetadata = null;
      probe.onerror = null;
      probe.src = '';
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 5000);
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const duration = Number(probe.duration);
      finish(Number.isFinite(duration) && duration > 0 ? duration : null);
    };
    probe.onerror = () => finish(null);
    probe.src = url;
  });
}

export async function durationError(file, kind, duration) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return '无法读取这段音频的时长，请换一个常见格式（mp3 / wav / ogg / m4a）。';
  }
  const limit = AUDIO_LIMITS[kind === 'music' ? 'music' : 'sfx'];
  if (duration > limit.seconds) {
    return `这段音频有 ${formatDuration(duration)}，超过了 ${formatDuration(limit.seconds)} 的上限。`;
  }
  return null;
}

export async function ensureStorageRoom(bytes) {
  try {
    if (!navigator.storage?.estimate) return;
    const estimate = await navigator.storage.estimate();
    if (!estimate?.quota) return;
    if (estimate.usage + bytes > estimate.quota * 0.97) {
      throw new Error('本机存储空间不足。请先还原一些旧的音频，或清理浏览器数据后再试。');
    }
  } catch (error) {
    if (error?.message?.includes('存储空间不足')) throw error;
  }
}

export function formatBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes}:${String(rest).padStart(2, '0')}` : `0:${String(rest).padStart(2, '0')}`;
}
