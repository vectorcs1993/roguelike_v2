<template>
  <q-page class="game-page">
    <div class="game-layout">
      <!-- Canvas wrapper - занимает всё свободное место -->
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

      <!-- Панель персонажей внизу -->
      <div class="characters-panel">
        <div class="characters-header">
          <q-icon name="groups" size="18px" />
          <span>Отряд</span>
          <span class="characters-count">({{ charactersList.length }})</span>
        </div>
        <div class="characters-container">
          <q-card v-for="character in charactersList" :key="character.id" :class="getCharacterCardClass(character)" class="character-card"
            :style="{ cursor: character.isSelectable ? 'pointer' : 'not-allowed' }" @click="onCharacterClick(character)" flat bordered>
            <div class="character-card-content">
              <div class="character-symbol">{{ character.char }}</div>
              <div class="character-name">{{ character.name }}</div>
              <div class="character-team">
                <q-chip :style="{ backgroundColor: character.teamColor, color: '#ffffff' }" size="sm" class="team-chip">
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
            </div>
          </q-card>
          <q-btn @click="regenerateLevel" color="orange" label="Обновить уровень" flat dense />
          <q-btn @click="revealFullMap" color="purple" label="Открыть карту" flat dense />
        </div>
        вцф
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import config from 'src/game/config.json'
import GameLoop from 'src/game/GameLoop.js'


const canvasRef = ref(null)
let game = null
let resizeTimeout = null
let updateInterval = null
let resizeObserver = null

const charactersListData = ref([])
const locationNameValue = ref('')

const charactersList = computed(() => charactersListData.value)

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

function updateCharactersList() {
  if (!game?.currentLocation) {
    charactersListData.value = []
    locationNameValue.value = ''
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
    apPercentage: char.getAPPercentage ? char.getAPPercentage() : (char.currentAP / char.maxAP) * 100
  }))
}

async function onCharacterClick(character) {
  if (!game) return
  if (!character.isSelectable) return

  if (character.isActive) {
    game.centerOnCharacter(character.id)
  } else {
    game.switchCharacter(character.id)
  }

  await updateCharactersList()
}

function regenerateLevel() {
  if (!game) return
  game.regenerateLevel()
  setTimeout(() => {
    if (game) {
      game.centerOnActiveCharacter()
      updateCharactersList()
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

  console.log('Resize canvas:', rect.width, rect.height)

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
  game = new GameLoop(canvasRef.value, config)

  // Принудительно устанавливаем высоту после монтирования
  nextTick(() => {
    resizeCanvas()

    // Повторный вызов через небольшую задержку
    setTimeout(() => {
      resizeCanvas()
    }, 100)
  })

  // Наблюдатель за изменением размера wrapper
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

  updateInterval = setInterval(() => {
    updateCharactersList()
  }, 100)
})

onUnmounted(() => {
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
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* Важно: заставляем q-page занимать всю высоту */
.game-page {
  width: 100%;
  height: 100vh !important;
  overflow: hidden;
  background: #1a1a2e;
  position: relative;
}

/* Обертка для Quasar */
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

/* Canvas wrapper - занимает всё свободное место */
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

/* Панель персонажей - фиксированной высоты */
.characters-panel {
  height: 230px;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.characters-header {
  padding: 8px 16px;
  font-size: 14px;
  font-weight: bold;
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.characters-count {
  font-size: 12px;
  color: #888;
  font-weight: normal;
}

.characters-container {
  flex: 1;
  padding: 10px 16px;
  display: flex;
  flex-direction: row;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  align-items: center;
}

/* Стили скролла */
.characters-container::-webkit-scrollbar {
  height: 4px;
}

.characters-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
}

.characters-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

/* Карточка персонажа - вертикальная */
.character-card {
  min-width: 120px;
  width: 120px;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.character-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  gap: 6px;
}

.character-symbol {
  font-size: 40px;
  line-height: 1;
}

.character-name {
  font-size: 11px;
  font-weight: bold;
  text-align: center;
  word-break: break-word;
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
  font-size: 12px;
  font-weight: bold;
  text-align: center;
}

.ap-progress {
  width: 100%;
  height: 3px;
  margin-top: 4px;
}

/* Стили карточек */
.active-character-card {
  background: rgba(68, 170, 255, 0.25) !important;
  border: 2px solid #44aaff !important;
  box-shadow: 0 0 8px rgba(68, 170, 255, 0.5) !important;
}

.friendly-character-card {
  background: rgba(68, 170, 255, 0.1) !important;
  border: 1px solid rgba(68, 170, 255, 0.4) !important;
}

.friendly-character-card:hover {
  background: rgba(68, 170, 255, 0.2) !important;
  transform: translateY(-2px);
}

.enemy-character-card {
  background: rgba(255, 68, 68, 0.1) !important;
  border: 1px solid rgba(255, 68, 68, 0.4) !important;
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

.debug-buttons {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 20;
  display: flex;
  gap: 8px;
}

@media (max-width: 768px) {
  .characters-panel {
    height: 160px;
  }

  .character-card {
    min-width: 100px;
    width: 100px;
  }

  .character-symbol {
    font-size: 32px;
  }

  .character-name {
    font-size: 10px;
  }
}
</style>
