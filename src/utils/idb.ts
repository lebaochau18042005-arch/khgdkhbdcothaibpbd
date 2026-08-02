export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('EduPlanDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('history')) {
        db.createObjectStore('history', { keyPath: 'id' });
      }
    };
  });
};

export const saveHistoryToDB = async (historyData: any[]) => {
  try {
    const db = await initDB();
    const tx = db.transaction('history', 'readwrite');
    const store = tx.objectStore('history');
    store.put({ id: 'eduplan_history', data: historyData });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Failed to save to IndexedDB', error);
  }
};

export const loadHistoryFromDB = async (): Promise<any[] | null> => {
  try {
    const db = await initDB();
    const tx = db.transaction('history', 'readonly');
    const store = tx.objectStore('history');
    const request = store.get('eduplan_history');
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result?.data || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load from IndexedDB', error);
    return null;
  }
};
