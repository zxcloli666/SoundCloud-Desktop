# Ops Commands — диагностика прода

Шпаргалка команд которые реально пригодились (или должны были) при разборе агонии Node-бекенда.
Все команды ориентированы на Linux хост с Docker.

## Установка инструментов на хост

```bash
# Debian/Ubuntu хост
apt-get update && apt-get install -y strace lsof tcpdump curl net-tools dnsutils linux-perf

# для контейнеров на debian:slim — внутри контейнера
docker exec <name> sh -c 'apt-get update && apt-get install -y curl net-tools'
```

## Процессы и треды

```bash
# реальные процессы (не треды!) с фильтром по имени
ps aux | grep "node " | grep -v grep | wc -l

# дерево процессов: PPID-связи, видно кто чей родитель
ps -ef --forest | grep -E "gateway|node"

# ВСЕ треды процессов (LWP) — каждая нода имеет ~11 LWP (libuv pool 4 + V8 GC + main + etc)
ps -eLf | grep node

# CPU% по тредам одного процесса (live snapshot)
top -H -p <PID> -b -n 1 | head -25

# CPU/RSS по процессам
ps aux | grep "node dist" | awk '{print $2, $3, $4, $11}'

# RSS в человеческом виде через docker
docker stats --no-stream
```

Что искать:
- много процессов где должно быть мало → supervisor плодит / что-то форкается
- много LWP — норм (libuv пул)
- main thread в R-state с высоким CPU → синхронный JS блокирует event loop
- RSS растёт со временем — leak

## Сетевая активность

```bash
# таблица syscalls за 10 сек: где зависает процесс
strace -c -p <PID> -f -- sleep 10 2>&1 | tail -30

# конкретные syscalls (для отладки конкретной операции)
strace -p <PID> -f -e trace=connect,sendto,recvfrom 2>&1 | head -50

# открытые сокеты процесса (TCP/UDP/UDS)
lsof -p <PID> -n -i 2>/dev/null

# куда летят НОВЫЕ TCP-соединения (SYN, исключая loopback) за 5 сек
timeout 5 tcpdump -ni any 'tcp[tcpflags] & tcp-syn != 0 and not src net 127.0.0.0/8' -c 200 2>/dev/null \
  | awk '{print $5}' | cut -d. -f1-4 | sort | uniq -c | sort -rn | head -10

# DNS-запросы за 5 сек (UDP 53)
timeout 5 tcpdump -ni any 'udp port 53' 2>/dev/null | head -20

# established connections изнутри контейнера (нет ss/netstat?)
docker exec <name> sh -c 'cat /proc/net/tcp | awk "NR>1 {print \$3, \$4}"'
```

Что искать:
- доминирует `futex` → треды ждут на мутексах (libuv pool sync с main)
- доминирует `connect` + `socket` + `bind` → лавина новых соединений (нет keep-alive)
- `connect` errors → что-то недоступно, retry без backoff
- много UDP в tcpdump → DNS флуд (нет кеша)
- куча SYN на ОДИН внешний IP → backend долбит сторонний сервис без pool/backoff
- SYN на свой публичный IP → DNS резолвит внутренние домены наружу (классика)

## DNS и сетевая топология

```bash
# DNS-резолюция с хоста
dig +short api.scnative.space
getent hosts infra.scnative.space

# DNS изнутри контейнера + /etc/hosts
docker exec <name> sh -c '
  echo "=== /etc/hosts ==="
  cat /etc/hosts
  echo "=== resolve ==="
  for h in infra.scnative.space prx-internal.scnative.space; do
    echo "$h:"
    getent hosts $h
  done
'

# IP всех контейнеров
docker inspect $(docker ps -q) \
  --format '{{.Name}}: {{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'

# содержимое docker-сетей
docker network ls
docker network inspect <network-name>
```

Что искать:
- внутренний домен (`infra.scnative.space`) резолвится во внешний публичный IP → трафик уходит через интернет → лечить через `extra_hosts` в compose
- хост, на котором всё крутится, светится в SYN-таргетах → значит идём наружу и обратно

Лечение в `docker-compose.yml`:
```yaml
backend:
  extra_hosts:
    - "infra.scnative.space:host-gateway"
    # host-gateway = алиас Docker'а на IP хоста на bridge (172.17.0.1 обычно)
```

## CPU-профайлинг

```bash
# с perf на хосте (нужен root и kernel.perf_event_paranoid <= 2)
perf record -F 99 -p <PID> -g -- sleep 30
perf report --stdio | head -50
# или генерить flamegraph (нужен https://github.com/brendangregg/FlameGraph):
perf script | stackcollapse-perf.pl | flamegraph.pl > out.svg

# Node-специфичные способы:
# 1) Включить inspector в живом процессе:
kill -USR1 <PID>
# дальше через chrome://inspect снимать профиль

# 2) Запустить процесс с авто-дампом профиля при выходе:
NODE_OPTIONS='--cpu-prof --cpu-prof-dir=/tmp --cpu-prof-interval=100' node dist/main.js
# при graceful shutdown создастся /tmp/CPU.<date>.<pid>.<seq>.cpuprofile
# открыть в Chrome DevTools → Performance → Load profile
```

## Memory-диагностика

```bash
# RSS / VSZ по процессу
ps -o pid,rss,vsz,cmd -p <PID>

# подробная память: сколько чем
cat /proc/<PID>/status | grep -E "Vm|Rss"
cat /proc/<PID>/smaps_rollup

# heap dump в Node (нужен inspector):
kill -USR2 <PID>  # в некоторых конфигах создаёт .heapsnapshot

# Rust + jemalloc — встроенный профайлер jeprof
MALLOC_CONF=prof:true,prof_active:true,lg_prof_sample:19,prof_prefix:/tmp/jeprof ./backend
# дальше:
jeprof --show_bytes --pdf ./backend /tmp/jeprof.*.heap > heap.pdf

# heaptrack (универсально, для C/C++/Rust):
heaptrack ./target/release/backend
heaptrack_print --print-leaks heaptrack.backend.*.gz
```

## Docker

```bash
# что крутится
docker ps
docker ps -a   # включая stopped

# лог одного сервиса в compose
docker compose logs backend --tail=200
docker compose logs backend --since=2m
docker compose logs -f backend   # follow

# СКОЛЬКО строк лога за окно — детектор log-spam
docker compose logs backend --since=30s 2>&1 | wc -l

# фильтр по паттернам
docker compose logs backend --tail=500 | grep -E "DOWN|UP|stuck|timeout|error"

# rebuild + restart одного сервиса
docker compose up -d --force-recreate --build backend

# зайти внутрь контейнера shellom
docker exec -it <name> sh

# использование ресурсов всеми контейнерами в реальном времени
docker stats
```

## Postgres

```bash
# подключение к PG в compose
docker exec -it soundcloud-desktop-db-1 psql -U soundcloud soundcloud_desktop

# текущие коннекты (по pg)
docker exec soundcloud-desktop-db-1 psql -U soundcloud soundcloud_desktop \
  -c "SELECT pid, application_name, state, query_start, left(query, 100) FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;"

# самые долгие запросы прямо сейчас
docker exec soundcloud-desktop-db-1 psql -U soundcloud soundcloud_desktop \
  -c "SELECT pid, now() - query_start AS dur, state, left(query, 200) FROM pg_stat_activity WHERE state = 'active' ORDER BY dur DESC LIMIT 10;"

# advisory locks (миграции)
docker exec soundcloud-desktop-db-1 psql -U soundcloud soundcloud_desktop \
  -c "SELECT * FROM pg_locks WHERE locktype = 'advisory';"

# размеры таблиц
docker exec soundcloud-desktop-db-1 psql -U soundcloud soundcloud_desktop \
  -c "SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 20;"
```

## Redis

```bash
# подключение
docker exec -it soundcloud-desktop-api-redis-1 redis-cli

# инфо по памяти / коннектам
docker exec soundcloud-desktop-api-redis-1 redis-cli INFO memory | head -20
docker exec soundcloud-desktop-api-redis-1 redis-cli INFO clients

# сколько коннектов сейчас и от кого
docker exec soundcloud-desktop-api-redis-1 redis-cli CLIENT LIST | head -20

# сколько ключей по prefix'у
docker exec soundcloud-desktop-api-redis-1 redis-cli --scan --pattern "scd:*" | wc -l

# мониторинг команд в реальном времени (тяжёлая команда — не надолго!)
docker exec soundcloud-desktop-api-redis-1 redis-cli MONITOR

# slowlog — последние медленные команды
docker exec soundcloud-desktop-api-redis-1 redis-cli SLOWLOG GET 20
```

## NATS

```bash
# JetStream stats
docker exec soundcloud-desktop-nats-1 sh -c 'wget -q -O- http://localhost:8222/jsz?streams=true'
docker exec soundcloud-desktop-nats-1 sh -c 'wget -q -O- http://localhost:8222/connz?subs=true'

# через nats CLI (если установлен в контейнере с воркером)
nats stream ls
nats consumer ls <stream>
nats consumer info <stream> <consumer>
```

## Проверка живости внешних сервисов изнутри контейнера

```bash
docker exec <backend> sh -c '
  apt-get install -y curl 2>/dev/null
  echo "=== прямой к SC ==="
  time curl -sS -o /dev/null -w "code=%{http_code} total=%{time_total}s\n" \
    --max-time 15 https://secure.soundcloud.com/oauth/token \
    -H "Content-Type: application/x-www-form-urlencoded" -d "grant_type=test"

  echo "=== через прокси ==="
  TARGET=$(printf "https://secure.soundcloud.com/oauth/token" | base64 -w0)
  time curl -sS -o /dev/null -w "code=%{http_code} total=%{time_total}s\n" \
    --max-time 15 https://prx-internal.scnative.space \
    -H "X-Target: $TARGET" \
    -H "Content-Type: application/x-www-form-urlencoded" -d "grant_type=test"
'
```

## Шаблон: "процесс ест CPU/RAM, не пойму куда" — за 2 минуты

```bash
PID=$(pgrep -of "node dist/main.js")  # или другое имя

# 1. треды и кто грузит
top -H -p $PID -b -n 1 | head -25

# 2. что в системных вызовах за 10 сек
strace -c -p $PID -f -- sleep 10 2>&1 | tail -25

# 3. куда летят SYN
timeout 5 tcpdump -ni any 'tcp[tcpflags] & tcp-syn != 0 and not src net 127.0.0.0/8' -c 200 2>/dev/null \
  | awk '{print $5}' | cut -d. -f1-4 | sort | uniq -c | sort -rn | head -10

# 4. сокеты
lsof -p $PID -n -i 2>/dev/null | head -30

# 5. DNS с контейнера
docker exec <backend-name> sh -c 'cat /etc/hosts; for h in infra.scnative.space; do echo "$h:"; getent hosts $h; done'
```

По результатам:
- `futex` 95% + много `connect`/`sendto` + SYN-таргет = твой публичный IP → DNS-проблема, нужен `extra_hosts`
- `epoll_wait` доминирует, CPU низкий → нормально, ждёт I/O
- Куча `read`/`write` на одних и тех же fd → log spam, проверь что в `docker compose logs` много строк
- `madvise`/`mmap` доминирует + RSS растёт → memory leak / GC давление
