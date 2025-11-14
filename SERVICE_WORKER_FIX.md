# Исправление Service Worker для проблемы 403

## Проблема
Service worker кешировал ошибки 403 для статических файлов, используя стратегию "cache-first". Это означало, что даже после исправления на сервере, браузер продолжал возвращать закешированную ошибку 403.

## Исправления

### 1. Обновлена версия кеша
- Изменено с `videotrubka-v1` на `videotrubka-v2`
- Это автоматически очистит старые кеши при обновлении service worker

### 2. Изменена стратегия кеширования для `/assets/`
- **Было**: Cache-first (сначала кеш, потом сеть)
- **Стало**: Network-first (сначала сеть, потом кеш)
- Это гарантирует, что всегда проверяется актуальная версия файла

### 3. Ошибки больше не кешируются
- Теперь кешируются только успешные ответы (200-299)
- Ошибки (403, 404, 500) не кешируются
- Если приходит ошибка, service worker проверяет кеш как fallback, но не сохраняет ошибку

### 4. Автоматическая очистка при активации
- При активации нового service worker старые кеши автоматически удаляются
- Это гарантирует удаление всех закешированных 403 ошибок

## Что нужно сделать

### 1. Задеплойте новую версию
После деплоя новый service worker автоматически заменит старый.

### 2. Очистите кеш вручную (если нужно)
Если проблема сохраняется, пользователи могут очистить кеш:

**В Chrome/Edge:**
1. Откройте DevTools (F12)
2. Application → Service Workers
3. Нажмите "Unregister" для текущего service worker
4. Application → Storage → Clear site data
5. Перезагрузите страницу

**В Firefox:**
1. Откройте DevTools (F12)
2. Application → Service Workers
3. Нажмите "Unregister"
4. Storage → Clear All
5. Перезагрузите страницу

**Программно (для пользователей):**
```javascript
// В консоли браузера
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(registration => registration.unregister());
});
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key));
});
location.reload();
```

### 3. Проверьте обновление service worker
После деплоя проверьте в консоли браузера:
```
✅ Service Worker registered: ...
🔄 New version available, reloading...
```

Если видите эти сообщения, service worker обновился успешно.

## Как проверить, что исправление работает

1. Откройте DevTools → Network
2. Найдите запрос к `/assets/index-DqLkL0Op.js`
3. Проверьте:
   - **Status**: должен быть `200 OK` (не 403)
   - **Size**: должен быть размер файла (не "from ServiceWorker" с ошибкой)
   - **Type**: должен быть `application/javascript`

4. Проверьте в Application → Cache Storage:
   - Должен быть только `videotrubka-v2`
   - В кеше не должно быть файлов со статусом 403

## Технические детали

### Старая логика (проблемная):
```javascript
// Cache-first: сначала проверяет кеш
caches.match(request).then(cached => {
  if (cached) return cached; // Возвращает 403 из кеша!
  return fetch(request); // Никогда не доходит сюда, если 403 в кеше
});
```

### Новая логика (исправленная):
```javascript
// Network-first: сначала проверяет сеть
fetch(request).then(response => {
  if (response.ok) {
    // Кешируем только успешные ответы
    cache.put(request, response);
  } else {
    // Ошибки не кешируются, проверяем кеш как fallback
    return caches.match(request) || response;
  }
});
```

## Мониторинг

После деплоя следите за логами service worker в консоли:
- `[SW] Activating service worker...` - активация
- `[SW] Deleting old cache: videotrubka-v1` - удаление старого кеша
- `[SW] Cleared cache to remove old 403 errors` - очистка кеша

Если видите эти сообщения, исправление работает правильно.

