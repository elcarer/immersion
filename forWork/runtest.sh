#!/bin/bash
# runtest.sh <test.mjs> — запуск пробы с watchdog: если вывод не растёт 60с
# (3 проверки по 20с), процесс убивается как зависший. Лог: /tmp/test_out.log
T="$1"
LOG=/tmp/test_out.log
: > "$LOG"
node "$T" > "$LOG" 2>&1 &
PID=$!
LAST=0
STALL=0
while kill -0 $PID 2>/dev/null; do
  sleep 20
  SIZE=$(stat -c %s "$LOG" 2>/dev/null || echo 0)
  if [ "$SIZE" = "$LAST" ]; then STALL=$((STALL+1)); else STALL=0; fi
  LAST=$SIZE
  if grep -qE "ИТОГ|DONE|pass=[0-9]+ fail=[0-9]+|конец" "$LOG" 2>/dev/null; then
    kill -9 $PID 2>/dev/null
    taskkill //PID $PID //F 2>/dev/null
    break
  fi
  if [ $STALL -ge 3 ]; then
    echo "TIMEOUT: тест не пишет вывод 60с — убит watchdog-ом" >> "$LOG"
    kill -9 $PID 2>/dev/null
    taskkill //PID $PID //F 2>/dev/null
    break
  fi
done
wait $PID 2>/dev/null
tail -6 "$LOG"
