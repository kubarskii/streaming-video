# Исправление 403 для статических файлов через домен

## Проблема
Файлы доступны напрямую, но возвращают 403 при доступе через домен `videotrubka.org`. Это указывает на проблему с **reverse proxy** или **CDN** (Cloudflare, nginx и т.д.).

## Исправления в коде

### 1. Пропуск строгой CORS проверки для статических файлов
Статические файлы теперь получают разрешающие CORS заголовки (`Access-Control-Allow-Origin: *`), что позволяет им загружаться с любого домена.

### 2. Улучшенное логирование
Добавлено детальное логирование для отладки проблем с статическими файлами.

## Проверка Cloudflare (если используется)

Если вы используете Cloudflare, проверьте:

### 1. Security Settings
- Зайдите в Cloudflare Dashboard → Security → Settings
- Убедитесь что **Security Level** не установлен на "High" или "I'm Under Attack!"
- Для статических файлов рекомендуется "Medium" или "Low"

### 2. Page Rules
Создайте правило для статических файлов:
```
URL Pattern: *videotrubka.org/assets/*
Settings:
  - Security Level: Off
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
```

### 3. Firewall Rules
Проверьте Firewall Rules - убедитесь что нет правил, блокирующих `/assets/*`

### 4. WAF (Web Application Firewall)
- Зайдите в Security → WAF
- Проверьте Custom Rules - убедитесь что нет правил, блокирующих статические файлы
- Проверьте Managed Rules - отключите правила, которые могут блокировать JS файлы

## Проверка Nginx (если используется)

Если используется nginx как reverse proxy, проверьте конфигурацию:

```nginx
server {
    listen 80;
    server_name videotrubka.org www.videotrubka.org;

    # Статические файлы - отдавать напрямую без проверок
    location /assets/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Не блокировать статические файлы
        proxy_intercept_errors off;
        
        # Кеширование
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        
        # CORS заголовки
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
    }

    # Остальные запросы
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Проверка Railway/других платформ

Если используете Railway или другой хостинг:

### 1. Проверьте переменные окружения
Убедитесь что `ALLOWED_ORIGINS` включает ваш домен:
```bash
ALLOWED_ORIGINS=https://www.videotrubka.org,https://videotrubka.org
```

### 2. Проверьте Custom Domain настройки
- Убедитесь что домен правильно настроен
- Проверьте SSL сертификат
- Проверьте DNS записи

## Диагностика

### 1. Проверьте заголовки ответа
```bash
curl -I https://www.videotrubka.org/assets/index-DqLkL0Op.js
```

Ожидаемый ответ:
```
HTTP/2 200
access-control-allow-origin: *
content-type: application/javascript
cache-control: public, max-age=31536000, immutable
```

Если видите 403, проверьте:
- Какие заголовки приходят в запросе
- Что в логах сервера

### 2. Проверьте логи сервера
После запроса к файлу проверьте логи - должны увидеть:
```
⚠️  Static file not found: /assets/index-DqLkL0Op.js
   Resolved path: /app/public/assets/index-DqLkL0Op.js
   File exists: true/false
   Request headers: {...}
```

### 3. Проверьте напрямую к Node.js серверу
Если у вас есть прямой доступ к серверу (не через домен):
```bash
curl -I http://your-server-ip:3000/assets/index-DqLkL0Op.js
```

Если это работает, проблема точно в reverse proxy/CDN.

## Быстрое решение для Cloudflare

1. Зайдите в Cloudflare Dashboard
2. Security → WAF → Tools
3. Найдите запрос к `/assets/index-DqLkL0Op.js` в логах
4. Если он заблокирован, добавьте в исключения (Allow)
5. Или создайте Page Rule для `/assets/*` с Security Level: Off

## Тестирование после исправлений

1. Перезапустите сервер с новым кодом
2. Очистите кеш Cloudflare (если используется):
   - Cloudflare Dashboard → Caching → Purge Everything
3. Проверьте файл:
   ```bash
   curl -I https://www.videotrubka.org/assets/index-DqLkL0Op.js
   ```
4. Должен вернуться `200 OK` с заголовком `access-control-allow-origin: *`

