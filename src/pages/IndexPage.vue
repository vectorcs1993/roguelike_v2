<template>
  <q-page class="game-page">
    <div class="game-layout">
      <!-- Основная область: Canvas + Консоль -->
      <div class="main-area">
        <!-- Canvas область -->
        <div class="canvas-area" ref="wrapperRef">
          <canvas ref="canvasRef" class="game-canvas" @touchstart.prevent="onTouchStart"
            @touchmove.prevent="onTouchMove" @touchend.prevent="onTouchEnd" @click.prevent="onCanvasClick"
            @mousemove="onMouseMove" @mouseleave="onMouseLeave" @contextmenu.prevent="onContextMenu"
            @mousedown="onMouseDown" @mouseup="onMouseUp">
          </canvas>
        </div>

        <!-- Консоль справа -->
        <div class="console-area">
          <div class="console-header">
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

      <!-- Нижняя панель: Карточки персонажей + Кнопка завершения -->
      <div class="cards-area">
        <div class="cards-header">
          <div class="cards-header-left">
            <q-icon name="groups" size="14px" />
            <span>Отряд</span>
            <q-badge color="grey-7" :label="`${charactersList.length}`" class="q-ml-sm" />
          </div>
          <div class="cards-header-right">
            <q-btn v-if="isPlayerTurn" @click="endTurn" color="primary" icon="skip_next" label="Завершить ход" flat
              dense size="sm" :disable="!canEndTurn">
              <q-tooltip>Завершить ход (Space)</q-tooltip>
            </q-btn>
          </div>
        </div>
        <div class="cards-container">
          <q-card dark v-for="character in charactersList" :key="character.id"
            :class="['character-card', getCharacterCardClass(character)]" flat bordered
            @click="() => onCharacterClick(character)">
            <q-card-section class="q-pa-sm">
              <div class="row items-center q-gutter-sm">
                <div class="col-auto">
                  <div class="character-symbol">{{ character.char }}</div>
                </div>
                <div class="col">
                  <div class="text-subtitle2 text-weight-bold">{{ character.name }}</div>
                  <q-chip :style="{ backgroundColor: character.teamColor }" size="sm" dense text-color="white"
                    class="q-mt-xs">
                    {{ character.teamName }}
                  </q-chip>
                </div>
                <div class="col-auto">
                  <q-badge v-if="character.isActive" color="primary" label="АКТИВЕН" />
                </div>
                <div class="col-auto">
                  <q-btn flat dense round size="sm" icon="center_focus_strong"
                    @click.stop="() => centerOnCharacter(character)">
                    <q-tooltip>Центрировать камеру</q-tooltip>
                  </q-btn>
                </div>
              </div>

              <div class="row q-mt-sm q-gutter-sm">
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-caption text-grey">
                      <q-icon name="favorite" size="12px" /> HP
                    </div>
                    <div class="text-caption text-weight-bold" :class="getHPColor(character.hpPercentage)">
                      {{ character.hp }}/{{ character.maxHp }}
                    </div>
                  </div>
                  <q-linear-progress :value="(character.hpPercentage || 0) / 100"
                    :color="getHPProgressColor(character.hpPercentage)" size="sm" track-color="grey-8" />
                </div>
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-caption text-grey">
                      <q-icon name="bolt" size="12px" /> AP
                    </div>
                    <div class="text-caption text-weight-bold" :class="getAPColor(character.apPercentage)">
                      {{ character.ap }}/{{ character.maxAP }}
                    </div>
                  </div>
                  <q-linear-progress :value="(character.apPercentage || 0) / 100"
                    :color="getAPProgressColor(character.apPercentage)" size="sm" track-color="grey-8" />
                </div>
              </div>

              <div class="row q-mt-sm q-gutter-sm">
                <div v-if="character.armor" class="col">
                  <div class="row items-center justify-between">
                    <div class="text-caption text-grey">
                      <q-icon name="shield" size="12px" /> Броня
                    </div>
                    <div class="text-caption">{{ character.armor }}</div>
                  </div>
                </div>
                <div v-if="character.damage" class="col">
                  <div class="row items-center justify-between">
                    <div class="text-caption text-grey">
                      <q-icon name="swords" size="12px" /> Урон
                    </div>
                    <div class="text-caption">{{ character.damage }}</div>
                  </div>
                </div>
                <div v-if="character.initiative" class="col">
                  <div class="row items-center justify-between">
                    <div class="text-caption text-grey">
                      <q-icon name="speed" size="12px" /> Инициатива
                    </div>
                    <div class="text-caption">{{ character.initiative }}</div>
                  </div>
                </div>
              </div>

              <div v-if="character.weapon" class="row q-mt-sm">
                <div class="col">
                  <div class="text-caption text-grey">
                    <q-icon name="weapon" size="12px" /> {{ character.weapon }}
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>

          <div v-if="charactersList.length === 0" class="empty-message">
            Нет персонажей
          </div>
        </div>
      </div>

      <q-chip class="location-name" color="dark" text-color="amber" icon="place">
        {{ locationNameValue }}
      </q-chip>

      <div class="control-buttons">
        <q-btn @click="regenerateLevel" color="orange" icon="refresh" label="Обновить" flat dense size="sm" />
        <q-btn @click="revealFullMap" color="purple" icon="map" label="Открыть карту" flat dense size="sm" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, shallowRef } from 'vue'
import config from 'src/game/config.json'
import GameLoop from 'src/game/GameLoop.js'

const canvasRef = ref(null)
const wrapperRef = ref(null)
const consoleRef = ref(null)
let game = null
let resizeTimeout = null
let updateInterval = null

const charactersListData = shallowRef([])
const locationNameValue = ref('')
const consoleLogs = shallowRef([])
const isPlayerTurn = ref(false)
const canEndTurn = ref(false)

const charactersList = computed(() => charactersListData.value)

let lastCharactersHash = ''
let updatePending = false

function getCharactersHash() {
  if (!game?.currentLocation) return ''
  const chars = game.currentLocation.getAllCharacters()
  return chars.map(c => `${c.id}:${c.isActive}:${c.currentAP}:${c.hp}`).join('|')
}

const originalConsoleLog = console.log
const originalConsoleWarn = console.warn
const originalConsoleError = console.error

function addConsoleMessage(text, type = 'info') {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  const newLogs = [...consoleLogs.value, { time, text: String(text), type }]

  if (newLogs.length > 500) {
    newLogs.shift()
  }

  consoleLogs.value = newLogs

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

function updateTurnStatus() {
  if (!game?.currentLocation) {
    isPlayerTurn.value = false
    canEndTurn.value = false
    return
  }

  const activeChar = game.currentLocation.getActiveCharacter()
  if (activeChar && activeChar.team && activeChar.team.isPlayerControlled) {
    isPlayerTurn.value = true
    canEndTurn.value = activeChar.currentAP > 0
  } else {
    isPlayerTurn.value = false
    canEndTurn.value = false
  }
}

function endTurn() {
  if (!game) return

  const activeChar = game.currentLocation.getActiveCharacter()
  if (!activeChar || !activeChar.team?.isPlayerControlled) {
    addConsoleMessage('Нельзя завершить ход врага!', 'warning')
    return
  }

  if (activeChar.currentAP <= 0) {
    addConsoleMessage('У персонажа нет очков действий для завершения хода', 'warning')
    return
  }

  addConsoleMessage(`⚡ Принудительное завершение хода: ${activeChar.name}`, 'info')

  const nextChar = game.currentLocation.endTurn()
  if (nextChar && nextChar.team?.isPlayerControlled) {
    game.centerOnCharacter(nextChar.id)
  }

  updateTurnStatus()
  throttledUpdate()
}

function updateCharactersList() {
  if (!game?.currentLocation) {
    if (charactersListData.value.length !== 0) {
      charactersListData.value = []
      locationNameValue.value = ''
    }
    updateTurnStatus()
    return
  }

  const newHash = getCharactersHash()
  if (newHash === lastCharactersHash && updatePending) {
    updateTurnStatus()
    return
  }

  lastCharactersHash = newHash
  locationNameValue.value = game.currentLocation.name || 'Неизвестная локация'

  const allCharacters = game.currentLocation.getAllCharacters()
  const visibleCharacters = allCharacters.filter(char => {
    const tile = game.currentLocation.map.getTile(Math.floor(char.x), Math.floor(char.y))
    if (char.isPlayerControlled || char.canSwitchTo) return true
    return tile && tile.visible
  })

  const newList = new Array(visibleCharacters.length)
  for (let i = 0; i < visibleCharacters.length; i++) {
    const char = visibleCharacters[i]
    const hp = char.hp || 0
    const maxHp = char.maxHp || hp || 0
    const hpPercentage = maxHp ? (hp / maxHp) * 100 : 100

    newList[i] = {
      id: char.id,
      name: char.name,
      char: char.char,
      x: char.x,
      y: char.y,
      isActive: char.isActive,
      isSelectable: char.canSwitchTo === true,
      teamColor: char.team?.color || '#666666',
      teamName: char.team?.name || 'Без команды',
      ap: char.currentAP,
      maxAP: char.maxAP,
      apPercentage: char.getAPPercentage ? char.getAPPercentage() : (char.currentAP / char.maxAP) * 100,
      hp: hp,
      maxHp: maxHp,
      hpPercentage: hpPercentage,
      armor: char.armor || 0,
      damage: char.damageMin && char.damageMax ? `${char.damageMin}-${char.damageMax}` : null,
      initiative: char.initiative || null,
      weapon: char.weaponName || null
    }
  }

  charactersListData.value = newList
  updateTurnStatus()
  updatePending = false
}

let updateScheduled = false
function throttledUpdate() {
  if (updateScheduled) return
  updateScheduled = true
  updatePending = true
  requestAnimationFrame(() => {
    updateCharactersList()
    updateScheduled = false
  })
}

function centerOnCharacter(character) {
  if (!game || !character) return
  game.centerOnCharacter(character.id)
}

function onCharacterClick(character) {
  if (!game || !character) return
  centerOnCharacter(character)
}

function regenerateLevel() {
  if (!game) return
  addConsoleMessage('🔄 Перегенерация уровня...', 'warning')
  game.regenerateLevel()
  setTimeout(() => {
    if (game) {
      game.centerOnActiveCharacter()
      throttledUpdate()
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
  // Обновляем статус после клика (возможно, потратили AP)
  setTimeout(() => updateTurnStatus(), 50)
}

function resizeCanvas() {
  const canvas = canvasRef.value
  const wrapper = wrapperRef.value

  if (!canvas || !wrapper || !game) return

  const rect = wrapper.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return

  const dpr = Math.min(window.devicePixelRatio || 1, config.dprCap)

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
  if (resizeTimeout) clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(() => {
    resizeCanvas()
  }, 100)
}

function onTouchStart(e) { game?.onTouchStart(e) }
function onTouchMove(e) { game?.onTouchMove(e) }
function onTouchEnd() { game?.onTouchEnd() }
function onKeyDown(e) {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault()
    endTurn()
  }
  game?.onKeyDown(e)
}
function onKeyUp(e) { game?.onKeyUp(e) }
function onMouseMove(e) { game?.onMouseMove(e) }
function onMouseLeave() { game?.onMouseLeave() }
function onContextMenu(e) { game?.onContextMenu(e) }
function onMouseDown(e) { game?.onMouseDown(e) }
function onMouseUp(e) { game?.onMouseUp(e) }

const UPDATE_INTERVAL = 250

onMounted(() => {
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
  })

  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  game.start()
  throttledUpdate()

  addConsoleMessage('🎮 Игра запущена', 'success')
  addConsoleMessage(`📍 Локация: ${locationNameValue.value || 'генерация...'}`, 'info')

  updateInterval = setInterval(() => {
    throttledUpdate()
  }, UPDATE_INTERVAL)
})

onUnmounted(() => {
  console.log = originalConsoleLog
  console.warn = originalConsoleWarn
  console.error = originalConsoleError

  game?.stop()
  if (resizeTimeout) clearTimeout(resizeTimeout)
  if (updateInterval) clearInterval(updateInterval)
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

.main-area {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.canvas-area {
  flex: 1;
  position: relative;
  background: #000;
  overflow: hidden;
}

.game-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  cursor: default;
  image-rendering: crisp-edges;
  image-rendering: pixelated;
}

.console-area {
  width: 25vw;
  display: flex;
  flex-direction: column;
  background: rgba(10, 10, 15, 0.95);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.console-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 12px;
  color: #aaa;
  flex-shrink: 0;
}

.console-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 14px;
}

.cards-area {
  height: auto;
  min-height: 180px;
  max-height: 220px;
  background: rgba(10, 10, 15, 0.95);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.cards-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 12px;
  color: #aaa;
  flex-shrink: 0;
}

.cards-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cards-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cards-container {
  flex: 1;
  padding: 10px 12px;
  display: flex;
  flex-direction: row;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  align-items: stretch;
}

.character-card {
  min-width: 260px;
  width: 260px;
  flex-shrink: 0;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.05);
}

.character-symbol {
  font-size: 32px;
  font-family: monospace;
  line-height: 1;
  text-align: center;
}

.location-name {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 20;
  pointer-events: none;
  font-size: 12px;
}

.control-buttons {
  position: absolute;
  bottom: calc(200px + 12px);
  right: calc(25vw + 12px);
  z-index: 20;
  display: flex;
  gap: 8px;
}

.console-line {
  padding: 4px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  display: flex;
  gap: 14px;
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
  font-size: 12px;
  min-width: 70px;
}

.console-text {
  flex: 1;
  word-break: break-word;
  font-size: 14px;
}

.empty-message {
  color: #555;
  text-align: center;
  padding: 20px;
  font-size: 12px;
}

.active-character-card {
  border: 2px solid #44aaff !important;
  background: rgba(68, 170, 255, 0.1) !important;
}

.friendly-character-card {
  border: 1px solid rgba(68, 170, 255, 0.4) !important;
}

.enemy-character-card {
  border: 1px solid rgba(255, 68, 68, 0.4) !important;
}

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

.cards-container::-webkit-scrollbar {
  height: 4px;
}

.cards-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.cards-container::-webkit-scrollbar-thumb {
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

@media (max-width: 768px) {
  .console-area {
    width: 30vw;
  }

  .character-card {
    min-width: 220px;
    width: 220px;
  }

  .character-symbol {
    font-size: 24px;
  }

  .control-buttons {
    bottom: calc(200px + 8px);
    right: calc(30vw + 8px);
  }

  .cards-area {
    min-height: 160px;
    max-height: 180px;
  }
}
</style>
