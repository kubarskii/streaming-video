# Диагностика 403 для статических файлов

## Что проверить

### 1. Проверьте логи сервера
После деплоя проверьте логи при запросе к файлу. Вы должны увидеть:

**Если запрос доходит до Node.js:**
```
[Static] 📥 Request: GET /assets/index-DqLkL0Op.js
[Static]    Host: www.videotrubka.org
[Static]    Safe path: /app/public/assets/index-DqLkL0Op.js
[Static]    File exists: true/false
```

**Если НЕ видите эти логи** - значит запросы блокируются ДО Node.js (Cloudflare/nginx).

### 2. Проверьте Cloudflare (если используется)

#### Security → WAF
1. Зайдите в Cloudflare Dashboard
2. Security → WAF → Tools → Recent requests
3. Найдите запросы к `/assets/*.js`
4. Проверьте, не заблокированы ли они правилами

#### Page Rules
Создайте правило:
```
URL Pattern: *videotrubka.org/assets/*
Settings:
  - Security Level: Off
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Disable Apps: On
  - Disable Performance: Off
```

#### Firewall Rules
Проверьте, нет ли правил, блокирующих `/assets/*`

### 3. Проверьте структуру файлов в контейнере

Подключитесь к контейнеру и проверьте:
```bash
# Через Railway CLI или docker exec
ls -la /app/public/
ls -la /app/public/assets/
```

Должны быть файлы:
- `/app/public/assets/index-DqLkL0Op.js`
- `/app/public/assets/react-vendor-Bzgz95E1.js`
- `/app/public/assets/index-D_a__fMm.css`

### 4. Проверьте права доступа
```bash
ls -la /app/public/assets/
```

Файлы должны быть читаемыми (644 или 755).

### 5. Проверьте напрямую к серверу

Если у вас есть прямой доступ к серверу (минуя Cloudflare):
```bash
curl -I http://your-server-ip:3000/assets/index-DqLkL0Op.js
```

Если это работает, проблема точно в Cloudflare/nginx.

### 6. Проверьте переменные окружения

Убедитесь что:
- `NODE_ENV=production`
- `PUBLIC_DIR` правильно установлен (должен быть `/app/public`)

## Быстрое решение

### Если проблема в Cloudflare:

1. **Отключите WAF для статических файлов:**
   - Security → WAF → Custom Rules
   - Создайте правило: `(http.request.uri.path contains "/assets/")` → Skip

2. **Или добавьте в исключения:**
   - Security → WAF → Tools
   - Найдите заблокированные запросы
   - Добавьте в Allow List

3. **Или временно отключите Cloudflare:**
   - DNS → записи A/AAAA
   - Временно отключите прокси (серый облачко)

### Если проблема в файлах:

1. **Пересоберите Docker образ:**
   ```bash
   docker build --no-cache -t your-app .
   ```

2. **Проверьте Dockerfile:**
   Убедитесь что файлы копируются правильно:
   ```dockerfile
   RUN cp -r dist/* /app/public/
   ```

3. **Проверьте что файлы есть:**
   ```bash
   docker run --rm your-app ls -la /app/public/assets/
   ```

## Что покажут логи

После деплоя с новым кодом, логи покажут:

### Если файл найден:
```
[Static] ✅ SERVING: /assets/index-DqLkL0Op.js (application/javascript)
```

### Если файл не найден:
```
[Static] ❌ FILE NOT FOUND: /assets/index-DqLkL0Op.js
[Static]    Expected at: /app/public/assets/index-DqLkL0Op.js
[Static]    Public dir contents: [...]
[Static]    Assets dir contents: [...]
```

### Если запрос не доходит до сервера:
**НЕ будет никаких логов `[Static]`** - значит Cloudflare/nginx блокирует.

## Следующие шаги

1. Задеплойте новую версию с логированием
2. Попробуйте загрузить файл в браузере
3. Проверьте логи сервера
4. Используйте информацию из логов для диагностики

