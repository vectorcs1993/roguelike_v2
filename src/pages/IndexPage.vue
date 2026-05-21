<template>
  <q-page class="game-page">
    <div class="game-layout">
      <!-- Canvas wrapper -->
      <div class="canvas-wrapper">
        <canvas ref="canvasRef" class="game-canvas" @touchstart.prevent="onTouchStart" @touchmove.prevent="onTouchMove" @touchend.prevent="onTouchEnd"
          @click.prevent="onCanvasClick" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @contextmenu.prevent="onContextMenu"
          @mousedown="onMouseDown" @mouseup="onMouseUp">
        </canvas>
      </div>

      <!-- Название локации -->
      <q-chip class="location-name" color="dark" text-color="amber">
        <q-icon name="place" size="xs" />
        {{ locationNameValue }}
      </q-chip>

      <!-- НИЖНЯЯ ПАНЕЛЬ УПРАВЛЕНИЯ -->
      <div class="control-panel">
        <!-- Верхняя часть панели с кнопками меню -->
        <div class="panel-header">
          <div class="menu-buttons">
            <q-btn @click="regenerateLevel" color="orange" label="Обновить уровень" flat dense size="sm" />
            <q-btn @click="revealFullMap" color="purple" label="Открыть карту" flat dense size="sm" />
          </div>
          <div class="panel-title">
            <q-icon name="dashboard" size="16px" />
            <span>Управление</span>
          </div>
        </div>

        <!-- Основное содержимое панели: 2 колонки -->
        <div class="panel-content">
          <!-- ЛЕВАЯ КОЛОНКА: Список персонажей (горизонтальный) -->
          <div class="characters-section">
            <div class="section-header">
              <q-icon name="groups" size="16px" />
              <span>Отряд</span>
              <q-badge color="grey-7" :label="`${charactersList.length}`" class="q-ml-sm" />
            </div>
            <div class="characters-container">
              <div v-for="character in charactersList" :key="character.id" :class="['character-card', getCharacterCardClass(character)]"
                @click="onCharacterClick(character)">
                <div class="character-card-content">
                  <div class="character-symbol">{{ character.char }}</div>
                  <div class="character-name">{{ character.name }}</div>
                  <div class="character-team">
                    <q-chip :style="{ backgroundColor: character.teamColor }" size="sm" dense text-color="white" class="team-chip">
                      {{ character.teamName }}
                    </q-chip>
                  </div>
                  <div class="character-ap-section">
                    <div class="character-ap-label">
                      <q-icon name="bolt" size="12px" :color="getAPColor(character.apPercentage)" />
                      <span>AP</span>
                    </div>
                    <div class="character-ap-value" :class="getAPColor(character.apPercentage)">
                      {{ character.ap }}/{{ character.maxAP }}
                    </div>
                    <q-linear-progress :value="(character.apPercentage || 0) / 100" :color="getAPProgressColor(character.apPercentage)"
                      class="ap-progress" track-color="grey-8" />
                  </div>

                  <div class="character-hp-section">
                    <div class="character-hp-label">
                      <q-icon name="favorite" size="12px" :color="getHPColor(character.hpPercentage)" />
                      <span>HP</span>
                    </div>
                    <div class="character-hp-value" :class="getHPColor(character.hpPercentage)">
                      {{ character.hp }}/{{ character.maxHp }}
                    </div>
                    <q-linear-progress :value="(character.hpPercentage || 0) / 100" :color="getHPProgressColor(character.hpPercentage)"
                      class="hp-progress" track-color="grey-8" />
                  </div>
                </div>
              </div>
              <div v-if="charactersList.length === 0" class="empty-message">
                Нет персонажей
              </div>
            </div>

            <!-- Очередь ходов -->
            <!-- <div class="turn-queue-section" v-if="turnQueueList.length > 0">
              <div class="section-header">
                <q-icon name="schedule" size="14px" />
                <span>Очередь ходов</span>
              </div>
              <div class="turn-queue-container">
                <div v-for="(char, idx) in turnQueueList" :key="char.id"
                  :class="['turn-queue-item', { active: char.isActive, player: char.isPlayerControlled }]">
                  <span class="queue-index">{{ idx + 1 }}.</span>
                  <span class="queue-char">{{ char.char }}</span>
                  <span class="queue-name">{{ char.name }}</span>
                  <q-badge v-if="char.isActive" color="primary" label="активен" size="sm" />
                </div>
              </div>
            </div> -->
          </div>

          <!-- ПРАВАЯ КОЛОНКА: Текстовая консоль -->
          <div class="console-section">
            <div class="section-header">
              <q-icon name="terminal" size="16px" />
              <span>Консоль</span>
              <q-btn flat dense size="sm" icon="delete_sweep" @click="clearConsole" class="q-ml-auto" />
            </div>
            <div class="console-content" ref="consoleRef">
              <div v-for="(log, idx) in consoleLogs" :key="idx" class="console-line" :class="log.type">
                <span class="console-time">{{ log.time }}</span>
                <span class="console-text">{{ log.text }}</span>
              </div>
              <div v-if="consoleLogs.length === 0" class="empty-message">
                Готов к работе...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import config from 'src/game/config.json'
import GameLoop from 'src/game/GameLoop.js'

const canvasRef = ref(null)
const consoleRef = ref(null)
let game = null
let resizeTimeout = null
let updateInterval = null
let resizeObserver = null

const charactersListData = ref([])
const locationNameValue = ref('')
const consoleLogs = ref([])
const turnQueueList = ref([])

const charactersList = computed(() => charactersListData.value)

// Перехват console.log
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn
const originalConsoleError = console.error

function addConsoleMessage(text, type = 'info') {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  consoleLogs.value.push({ time, text: String(text), type })

  if (consoleLogs.value.length > 100) {
    consoleLogs.value.shift()
  }

  nextTick(() => {
    if (consoleRef.value) {
      consoleRef.value.scrollTop = consoleRef.value.scrollHeight
    }
  })
}

function clearConsole() {
  consoleLogs.value = []
}

function getCharacterCardClass(character) {
  if (character.isActive && character.isSelectable) {
    return 'active-character-card'
  }
  if (character.isSelectable) {
    return 'friendly-character-card'
  }
  return 'enemy-character-card'
}

function getAPColor(percentage) {
  if (!percentage && percentage !== 0) return 'text-grey'
  if (percentage < 25) return 'text-red'
  if (percentage < 50) return 'text-orange'
  if (percentage < 75) return 'text-yellow'
  return 'text-green'
}

function getAPProgressColor(percentage) {
  if (!percentage && percentage !== 0) return 'grey'
  if (percentage < 25) return 'red'
  if (percentage < 50) return 'orange'
  if (percentage < 75) return 'yellow'
  return 'green'
}

function getHPColor(percentage) {
  if (!percentage && percentage !== 0) return 'text-grey'
  if (percentage < 25) return 'text-red'
  if (percentage < 50) return 'text-orange'
  if (percentage < 75) return 'text-yellow'
  return 'text-green'
}

function getHPProgressColor(percentage) {
  if (!percentage && percentage !== 0) return 'grey'
  if (percentage < 25) return 'red'
  if (percentage < 50) return 'orange'
  if (percentage < 75) return 'yellow'
  return 'green'
}

function updateCharactersList() {
  if (!game?.currentLocation) {
    charactersListData.value = []
    locationNameValue.value = ''
    turnQueueList.value = []
    return
  }

  locationNameValue.value = game.currentLocation.name || 'Неизвестная локация'
  const allCharacters = game.currentLocation.getAllCharacters()

  charactersListData.value = allCharacters.map(char => ({
    id: char.id,
    name: char.name,
    char: char.char,
    isActive: char.isActive,
    isSelectable: char.canSwitchTo === true,
    teamColor: char.team?.color || '#666666',
    teamName: char.team?.name || 'Без команды',
    ap: char.currentAP,
    maxAP: char.maxAP,
    apPercentage: char.getAPPercentage ? char.getAPPercentage() : (char.currentAP / char.maxAP) * 100,
    hp: char.hp || 0,
    maxHp: char.maxHp || char.hp || 0,
    hpPercentage: char.hp && char.maxHp ? (char.hp / char.maxHp) * 100 : 100
  }))

  // Обновляем очередь ходов
  const queue = game.currentLocation.turnQueue?.getAllCharacters() || []
  turnQueueList.value = queue.map(char => ({
    id: char.id,
    name: char.name,
    char: char.char,
    isActive: char.isActive,
    isPlayerControlled: char.team?.isPlayerControlled || false
  }))
}

async function onCharacterClick(character) {
  if (!game) return
  if (!character.isSelectable) return

  // Запрещаем переключение активного персонажа (только центрирование)
  if (character.isActive) {
    game.centerOnCharacter(character.id)
    addConsoleMessage(`Центрирование на: ${character.name}`, 'info')
  } else {
    // Не переключаем на другого персонажа - игрок может управлять только активным по очереди
    addConsoleMessage(`Персонаж ${character.name} не активен (ход определяется очередью)`, 'warning')
    return
  }

  await updateCharactersList()
}

function regenerateLevel() {
  if (!game) return
  addConsoleMessage('🔄 Перегенерация уровня...', 'warning')
  game.regenerateLevel()
  setTimeout(() => {
    if (game) {
      game.centerOnActiveCharacter()
      updateCharactersList()
      addConsoleMessage('✅ Уровень обновлён', 'success')
    }
  }, 100)
}

function revealFullMap() {
  if (!game?.currentLocation) return
  const map = game.currentLocation.map
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      const tile = map.getTile(x, y)
      if (tile) {
        tile.visible = true
        tile.explored = true
      }
    }
  }
  addConsoleMessage('🗺️ Карта полностью открыта', 'info')
}

function onCanvasClick(e) {
  game?.onClick(e)
}

function resizeCanvas() {
  const canvas = canvasRef.value
  const wrapper = canvas?.parentElement
  if (!canvas || !wrapper || !game) return

  const dpr = Math.min(window.devicePixelRatio || 1, config.dprCap)
  const rect = wrapper.getBoundingClientRect()

  if (rect.width <= 0 || rect.height <= 0) return

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvas.style.width = rect.width + 'px'
  canvas.style.height = rect.height + 'px'

  const ctx = canvas.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)

  if (!game.renderer) {
    game.initRenderer(rect.width, rect.height, dpr)
  } else {
    game.resize(rect.width, rect.height, dpr)
  }
}

function onResize() {
  clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(resizeCanvas, config.resizeDebounce)
}

// Проброс событий
function onTouchStart(e) { game?.onTouchStart(e) }
function onTouchMove(e) { game?.onTouchMove(e) }
function onTouchEnd() { game?.onTouchEnd() }
function onKeyDown(e) { game?.onKeyDown(e) }
function onKeyUp(e) { game?.onKeyUp(e) }
function onMouseMove(e) { game?.onMouseMove(e) }
function onMouseLeave() { game?.onMouseLeave() }
function onContextMenu(e) { game?.onContextMenu(e) }
function onMouseDown(e) { game?.onMouseDown(e) }
function onMouseUp(e) { game?.onMouseUp(e) }

onMounted(() => {
  // Перехват консоли игры
  console.log = (...args) => {
    originalConsoleLog.apply(console, args)
    addConsoleMessage(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '), 'info')
  }
  console.warn = (...args) => {
    originalConsoleWarn.apply(console, args)
    addConsoleMessage(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '), 'warning')
  }
  console.error = (...args) => {
    originalConsoleError.apply(console, args)
    addConsoleMessage(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '), 'error')
  }

  game = new GameLoop(canvasRef.value, config)

  nextTick(() => {
    resizeCanvas()
    setTimeout(() => {
      resizeCanvas()
    }, 100)
  })

  const wrapper = document.querySelector('.canvas-wrapper')
  if (wrapper) {
    resizeObserver = new ResizeObserver(() => {
      resizeCanvas()
    })
    resizeObserver.observe(wrapper)
  }

  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  game.start()
  updateCharactersList()

  addConsoleMessage('🎮 Игра запущена', 'success')
  addConsoleMessage(`📍 Локация: ${locationNameValue.value || 'генерация...'}`, 'info')

  updateInterval = setInterval(() => {
    updateCharactersList()
  }, 100)
})

onUnmounted(() => {
  console.log = originalConsoleLog
  console.warn = originalConsoleWarn
  console.error = originalConsoleError

  game?.stop()
  clearTimeout(resizeTimeout)
  if (updateInterval) clearInterval(updateInterval)
  if (resizeObserver) resizeObserver.disconnect()
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<style scoped>
.game-page {
  width: 100%;
  height: 100vh !important;
  overflow: hidden;
  background: #0a0a0f;
  position: relative;
}

:deep(.q-page) {
  min-height: 100vh !important;
  height: 100vh !important;
}

.game-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.canvas-wrapper {
  flex: 1 1 auto;
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: #000;
}

.game-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  cursor: default;
}

.location-name {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 20;
  pointer-events: none;
  backdrop-filter: blur(4px);
  font-size: 12px;
}

/* ПАНЕЛЬ УПРАВЛЕНИЯ */
.control-panel {
  height: 30vh;
  background: rgba(10, 10, 15, 0.95);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.menu-buttons {
  display: flex;
  gap: 8px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #888;
  font-size: 12px;
}

.panel-content {
  flex: 1;
  display: flex;
  gap: 1px;
  background: rgba(255, 255, 255, 0.05);
  min-height: 0;
  overflow: hidden;
}

/* Левая колонка - персонажи (горизонтальный скролл) */
.characters-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.3);
  min-width: 0;
}

/* Правая колонка - консоль */
.console-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.3);
  min-width: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 12px;
  color: #aaa;
  flex-shrink: 0;
}

/* Горизонтальный контейнер для карточек */
.characters-container {
  flex: 1;
  padding: 10px 12px;
  display: flex;
  flex-direction: row;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  align-items: center;
}

/* Карточка персонажа - вертикальная, фиксированная ширина */
.character-card {
  min-width: 120px;
  width: 120px;
  flex-shrink: 0;
  transition: all 0.15s ease;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.character-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.1);
}

.character-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  gap: 6px;
}

.character-symbol {
  font-size: 36px;
  line-height: 1;
  font-family: monospace;
}

.character-name {
  font-size: 11px;
  font-weight: bold;
  text-align: center;
  word-break: break-word;
  color: #ddd;
}

.character-team {
  width: 100%;
  display: flex;
  justify-content: center;
}

.team-chip {
  margin: 0 !important;
  font-size: 9px !important;
  min-height: 18px !important;
}

.character-ap-section {
  width: 100%;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.character-ap-label {
  font-size: 9px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 3px;
  justify-content: center;
  margin-bottom: 2px;
}

.character-ap-value {
  font-size: 11px;
  font-weight: bold;
  text-align: center;
}

.ap-progress {
  width: 100%;
  height: 3px;
  margin-top: 4px;
}

.character-hp-section {
  width: 100%;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.character-hp-label {
  font-size: 9px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 3px;
  justify-content: center;
  margin-bottom: 2px;
}

.character-hp-value {
  font-size: 11px;
  font-weight: bold;
  text-align: center;
}

.hp-progress {
  width: 100%;
  height: 3px;
  margin-top: 4px;
}

/* Стили карточек */
.active-character-card {
  background: rgba(68, 170, 255, 0.25) !important;
  border: 2px solid #44aaff !important;
  box-shadow: 0 0 8px rgba(68, 170, 255, 0.3) !important;
}

.friendly-character-card {
  background: rgba(68, 170, 255, 0.1) !important;
  border: 1px solid rgba(68, 170, 255, 0.4) !important;
}

.enemy-character-card {
  background: rgba(255, 68, 68, 0.1) !important;
  border: 1px solid rgba(255, 68, 68, 0.4) !important;
}

/* Консоль */
.console-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 11px;
}

.console-line {
  padding: 3px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  display: flex;
  gap: 10px;
  font-family: monospace;
}

.console-line.info {
  color: #aaa;
}

.console-line.success {
  color: #5f5;
}

.console-line.warning {
  color: #fa0;
}

.console-line.error {
  color: #f55;
}

.console-time {
  color: #666;
  flex-shrink: 0;
  font-size: 10px;
}

.console-text {
  flex: 1;
  word-break: break-word;
}

.empty-message {
  color: #555;
  text-align: center;
  padding: 20px;
  font-size: 12px;
}

/* Стили скролла */
.characters-container::-webkit-scrollbar {
  height: 4px;
}

.characters-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.characters-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.console-content::-webkit-scrollbar {
  width: 4px;
}

.console-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.console-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

/* Текстовые цвета */
.text-red {
  color: #f55;
}

.text-orange {
  color: #fa0;
}

.text-yellow {
  color: #ff5;
}

.text-green {
  color: #5f5;
}

.text-grey {
  color: #888;
}

/* Очередь ходов */
.turn-queue-section {
  margin-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 8px;
}

.turn-queue-section .section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #aaa;
  margin-bottom: 6px;
}

.turn-queue-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 120px;
  overflow-y: auto;
}

.turn-queue-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 11px;
  color: #ccc;
}

.turn-queue-item.active {
  background: rgba(0, 100, 255, 0.2);
  border-left: 3px solid #4af;
}

.turn-queue-item.player {
  color: #8cf;
}

.queue-index {
  color: #888;
  min-width: 16px;
}

.queue-char {
  font-weight: bold;
  min-width: 12px;
}

.queue-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .control-panel {
    height: 200px;
  }

  .character-card {
    min-width: 100px;
    width: 100px;
  }

  .character-symbol {
    font-size: 28px;
  }

  .character-name {
    font-size: 10px;
  }

  .console-content {
    font-size: 10px;
  }
}
</style>
