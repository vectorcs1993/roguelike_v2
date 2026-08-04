<template>
  <q-page class="q-pa-md" style="background: #121212; height: 100vh; display: flex; flex-direction: column;" ref="pageRef">

    <div class="row q-col-gutter-md" style="flex: 1; min-height: 0;">
      <!-- Canvas -->
      <div class="col-8" style="display: flex; flex-direction: column;">
        <q-card flat square bordered dark class="full-height" style="display: flex; flex-direction: column;">
          <q-card-section class="bg-grey-9">
            <div class="text-h6 flex items-center">
              <q-icon name="fmd_good" class="q-mr-sm" />
              <div class="text-h6">Локация: {{ locationName }}</div>
              <q-space />
              <q-btn label="Обновить" icon="refresh" @click="regenerateLevel" dark />
              <q-btn label="Открыть карту" icon="map" @click="revealFullMap" dark />
            </div>
          </q-card-section>
          <q-card-section class="q-pa-none bg-dark" style="flex: 1; display: flex;">
            <canvas ref="canvasRef" class="full-width" style="background: #0a0a0a; border-radius: 4px; width: 100%; height: 100%; outline: none;"
              @click="onCanvasClick" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @touchstart.prevent="onTouchStart"
              @touchmove.prevent="onTouchMove" @touchend.prevent="onTouchEnd">
            </canvas>
          </q-card-section>
          <div class="absolute-bottom full-width q-pa-sm">
            <q-card-section flat bordered class="row bg-grey-9 justify-center">
              <div class="row q-gutter-sm">
                <q-btn label="⬆" @click="move(0, -1)" />
                <q-btn label="⬇" @click="move(0, 1)" />
                <q-btn label="⬅" @click="move(-1, 0)" />
                <q-btn label="➡" @click="move(1, 0)" />
                <q-btn label="Атака" @click="attack" />
                <q-btn label="Взаимодействие" @click="interact" />
              </div>
            </q-card-section>
          </div>
        </q-card>
      </div>

      <!-- Правая панель -->
      <div class="col-4" style="display: flex; flex-direction: column; gap: 16px; min-height: 0;">
        <q-card flat square bordered dark style="flex-shrink: 0;">
          <q-card-section class="bg-grey-9">
            <div class="text-h6 flex items-center">
              <q-icon name="groups" class="q-mr-sm" />
              Отряд
              <q-badge color="grey-7" :label="charactersList.length" class="q-ml-sm" />
            </div>
          </q-card-section>
          <q-separator dark />
          <q-card-section style="height: 200px; overflow-y: auto;" dark>
            <q-scroll-area v-if="charactersList.length > 0" dark style="width: 100%; height: 100%;">
              <q-item v-for="(char, idx) in charactersList" :key="char.id" :active="char.id === selectedCharId" clickable dark
                @click="switchToCharacter(idx)">
                <q-item-section avatar dark>
                  <q-chip :style="{ backgroundColor: char.teamColor, color: 'white' }">
                    {{ char.char }}
                  </q-chip>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ char.name }}</q-item-label>
                  <q-item-label>❤️ {{ char.hp }}/{{ char.maxHp }}</q-item-label>
                </q-item-section>
                <div class="row q-gutter-sm">
                  <q-btn icon="center_focus_strong" label="Центр" dense @click.stop="centerOnCharacter(char.id)" dark />
                </div>
              </q-item>
            </q-scroll-area>
            <div v-else class="text-center text-grey-5 q-py-md">Нет персонажей</div>
          </q-card-section>
        </q-card>

        <q-card flat square bordered dark style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
          <q-card-section class="bg-grey-9">
            <div class="text-h6 flex items-center">
              <q-icon name="terminal" class="q-mr-sm" />
              Лог игры
              <q-badge color="grey-7" :label="consoleLogs.length" class="q-ml-sm" />
              <q-space />
              <q-btn flat dense icon="delete_sweep" @click="clearConsole" />
            </div>
          </q-card-section>
          <q-separator dark />
          <q-scroll-area ref="consoleScrollAreaRef" dark style="flex: 1; background: #1e1e1e;">
            <div class="q-pa-sm">
              <div v-for="(log, idx) in consoleLogs" :key="idx" class="q-py-xs" :class="getMessageColorClass(log)">
                <span class="text-grey-5">[{{ log.time }}]</span> {{ log.text }}
              </div>
              <div v-if="consoleLogs.length === 0" class="text-grey-5 text-center q-py-lg">Ничего...</div>
            </div>
          </q-scroll-area>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import GameLoop from 'src/game/GameLoop.js'
import config from 'src/game/config.json'
import { logger, LOG_LEVEL } from 'src/game/Logger.js'

const canvasRef = ref(null)
const consoleScrollAreaRef = ref(null)
const pageRef = ref(null)
let game = null
let resizeTimeout = null
let updateInterval = null

const consoleLogs = ref([])
const charactersList = ref([])
const locationName = ref('')
const selectedCharId = ref(null)

// ★★★ ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ КЛАВИАТУРЫ ★★★
function onGlobalKeyDown(event) {
  // Игнорируем если ввод в полях
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return
  }
  // Игнорируем если нажата кнопка на кнопке (чтобы не конфликтовать)
  if (event.target.tagName === 'BUTTON') {
    return
  }

  // Проксируем в GameLoop
  if (game?.onKeyDown) {
    game.onKeyDown(event)
  }
}

function onGlobalKeyUp(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return
  }
  if (event.target.tagName === 'BUTTON') {
    return
  }

  if (game?.onKeyUp) {
    game.onKeyUp(event)
  }
}

// Лог
function addConsoleMessage(text, type = 'info') {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  consoleLogs.value.push({ time, text: String(text), type })
  if (consoleLogs.value.length > 500) consoleLogs.value.shift()
  nextTick(() => {
    if (consoleScrollAreaRef.value) {
      const target = consoleScrollAreaRef.value.getScrollTarget?.()
      if (target) target.scrollTop = target.scrollHeight
    }
  })
}

function clearConsole() { consoleLogs.value = [] }

function getMessageColorClass(log) {
  switch (log.type) {
    case 'error': return 'text-red'
    case 'warning': return 'text-orange'
    case 'success': return 'text-green'
    default: return 'text-white'
  }
}

function loggerCallback(level, module, message) {
  let type = 'info'
  if (level === LOG_LEVEL.ERROR) type = 'error'
  else if (level === LOG_LEVEL.WARN) type = 'warning'
  else if (level === LOG_LEVEL.INFO && (module === 'combat' || module === 'turn')) type = 'success'
  addConsoleMessage(message, type)
}
logger.addCallback(loggerCallback)
onUnmounted(() => logger.removeCallback(loggerCallback))

function updateCharactersList() {
  if (!game?.currentLocation) {
    charactersList.value = []
    return
  }
  locationName.value = game.currentLocation.name
  const all = game.currentLocation.getAllCharacters()
  const visible = all.filter(c => {
    const tile = game.currentLocation.getTile(Math.floor(c.x), Math.floor(c.y))
    return c.isPlayerControlled || (tile && tile.visible)
  })

  charactersList.value = visible.map(c => ({
    id: c.id,
    name: c.name,
    char: c.char,
    isActive: c.isActive,
    isPlayerControlled: c.isPlayerControlled,
    teamColor: c.team?.color || '#666',
    teamName: c.team?.name || '?',
    hp: c.hp,
    maxHp: c.maxHp,
  }))

  const selected = game.selectedCharacter
  if (selected) selectedCharId.value = selected.id
}

function move(dx, dy) { game?.moveCharacter(dx, dy) }

function attack() {
  const result = game?.attackNearestEnemy()
  if (result) addConsoleMessage('Атака выполнена!', 'success')
  else addConsoleMessage('Нет цели для атаки', 'warning')
}

function interact() { game?.interact() }

function initGame() {
  if (!canvasRef.value) return
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(rect.width * dpr, 100)
  canvas.height = Math.max(rect.height * dpr, 100)
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`

  try {
    game = new GameLoop(canvas, config)
    game.initRenderer(rect.width, rect.height, dpr)
    game.start()
    addConsoleMessage('Игра запущена', 'success')
    updateCharactersList()
    if (updateInterval) clearInterval(updateInterval)
    updateInterval = setInterval(updateCharactersList, 100)

    // ★★★ РЕГИСТРИРУЕМ ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ★★★
    document.addEventListener('keydown', onGlobalKeyDown)
    document.addEventListener('keyup', onGlobalKeyUp)

  } catch (e) {
    addConsoleMessage(`Ошибка: ${e.message}`, 'error')
  }
}

function regenerateLevel() {
  if (game?.reloadLocation) {
    game.reloadLocation()
    addConsoleMessage('Уровень обновлён', 'info')
  }
}

function revealFullMap() {
  if (!game?.currentLocation?.map) return
  const map = game.currentLocation.map
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      const tile = map.getTile(x, y)
      if (tile) tile.visible = tile.explored = true
    }
  }
  addConsoleMessage('Карта открыта', 'success')
}

function centerOnCharacter(characterId) { game?.centerOnCharacter(characterId) }
function switchToCharacter(index) { game?.switchToCharacter(index) }


function onCanvasClick(event) {
  game?.onClick?.(event)
}

function onMouseMove(event) {
  game?.onMouseMove?.(event)
}

function onMouseLeave(event) {
  game?.onMouseLeave?.(event)
}

function onTouchStart(event) {
  game?.onTouchStart?.(event)
}

function onTouchMove(event) {
  game?.onTouchMove?.(event)
}

function onTouchEnd(event) {
  game?.onTouchEnd?.(event)
}

// Жизненный цикл
onMounted(() => {
  nextTick(initGame)
  window.addEventListener('resize', () => {
    if (resizeTimeout) clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(() => {
      if (game && canvasRef.value) {
        const rect = canvasRef.value.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        canvasRef.value.width = rect.width * dpr
        canvasRef.value.height = rect.height * dpr
        canvasRef.value.style.width = `${rect.width}px`
        canvasRef.value.style.height = `${rect.height}px`
        game.resize?.(rect.width, rect.height, dpr)
      }
    }, 200)
  })
})

onUnmounted(() => {
  game?.stop?.()
  if (updateInterval) clearInterval(updateInterval)
  // ★★★ УДАЛЯЕМ ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ★★★
  document.removeEventListener('keydown', onGlobalKeyDown)
  document.removeEventListener('keyup', onGlobalKeyUp)
})
</script>

<style scoped>
canvas {
  display: block;
  border: 1px solid #333;
  outline: none;
}

:deep(.q-page) {
  outline: none;
}
</style>
