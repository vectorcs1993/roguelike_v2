<template>
  <q-page class="game-page">
    <canvas ref="canvasRef" class="game-canvas" @touchstart.prevent="onTouchStart" @touchmove.prevent="onTouchMove" @touchend.prevent="onTouchEnd"
      @click.prevent="onCanvasClick" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @contextmenu.prevent="onContextMenu" @mousedown="onMouseDown"
      @mouseup="onMouseUp"></canvas>

    <!-- Название локации -->
    <q-chip class="location-name" color="dark" text-color="amber">
      <q-icon name="place" size="xs" />
      {{ locationNameValue }}
    </q-chip>

    <!-- Панель персонажей -->
    <div class="characters-panel">
      <div class="characters-container">
        <q-card v-for="character in charactersList" :key="character.id" :class="getCharacterCardClass(character)"
          :style="{ cursor: character.isSelectable ? 'pointer' : 'not-allowed' }" @click="onCharacterClick(character)" flat bordered>
          <div class="character-card-content">
            <div class="character-symbol">{{ character.char }}</div>
            <div class="character-name">{{ character.name }} id: {{ character.id }}</div>
            <div class="character-team">
              <q-chip :style="{ backgroundColor: character.teamColor, color: '#ffffff' }" size="sm" class="team-chip">
                {{ character.teamName }}
              </q-chip>
            </div>
            <div class="character-ap-section">
              <div class="character-ap-label">
                <q-icon name="bolt" size="12px" :color="getAPColor(character.apPercentage)" />
                <span>Очки действий</span>
              </div>
              <div class="character-ap-value" :class="getAPColor(character.apPercentage)">
                {{ character.ap }}/{{ character.maxAP }}
              </div>
              <q-linear-progress :value="(character.apPercentage || 0) / 100" :color="getAPProgressColor(character.apPercentage)" class="ap-progress"
                track-color="grey-8" />
            </div>
          </div>
        </q-card>
      </div>
    </div>

    <!-- Отладочная панель -->
    <q-card class="debug-panel" flat>
      <q-card-section class="q-pa-sm">
        <div class="text-caption text-green">Characters: {{ charactersCount }}</div>
        <div class="text-caption text-green">Selectable: {{ selectableCount }}</div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import config from 'src/game/config.json'
import GameLoop from 'src/game/GameLoop.js'
import Location from 'src/game/Location.js'

const startLocation = Location.createDefault(config)

const canvasRef = ref(null)
let game = null
let resizeTimeout = null
let updateInterval = null

// Реактивные данные
const charactersCount = ref(0)
const selectableCount = ref(0)
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
    charactersCount.value = 0
    selectableCount.value = 0
    charactersListData.value = []
    locationNameValue.value = ''
    return
  }

  locationNameValue.value = game.currentLocation.name || 'Неизвестная локация'
  const allCharacters = game.currentLocation.getAllCharacters()
  charactersCount.value = allCharacters.length
  selectableCount.value = allCharacters.filter(c => c.canSwitchTo === true).length

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

  console.log('Characters list updated:', charactersListData.value.map(c => ({ id: c.id, name: c.name, type: typeof c.id })))
}

async function onCharacterClick(character) {
  if (!game) return
  if (!character.isSelectable) return

  console.log(`Clicked on character: ${character.name} (ID: ${character.id}, Type: ${typeof character.id})`)

  if (character.isActive) {
    game.centerOnCharacter(character.id)
  } else {
    game.switchCharacter(character.id)
  }

  await updateCharactersList()
  requestAnimationFrame(() => updateCharactersList())
}

function onCanvasClick(e) {
  const panel = document.querySelector('.characters-panel')
  if (panel) {
    const rect = panel.getBoundingClientRect()
    if (e.clientY >= rect.top) return
  }
  game?.onClick(e)
}

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas || !game) return

  const dpr = Math.min(window.devicePixelRatio || 1, config.dprCap)
  const rect = canvas.getBoundingClientRect()

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
  game = new GameLoop(canvasRef.value, config, startLocation)
  resizeCanvas()

  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  game.start()

  setTimeout(() => updateCharactersList(), 50)

  updateInterval = setInterval(() => {
    updateCharactersList()
  }, 100)
})

onUnmounted(() => {
  game?.stop()
  clearTimeout(resizeTimeout)
  if (updateInterval) clearInterval(updateInterval)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<style scoped>
.game-page {
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  position: relative;
}

.game-canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: default;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

.location-name {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
  pointer-events: none;
  backdrop-filter: blur(4px);
}

.characters-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 16px 20px;
  overflow-x: auto;
  min-height: 180px;
}

.characters-container {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 20px;
  align-items: stretch;
}

.character-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  min-width: 140px;
  width: 140px;
  gap: 8px;
}

.character-symbol {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 4px;
}

.character-name {
  font-size: 14px;
  font-weight: bold;
  text-align: center;
  word-break: break-word;
}

.character-team {
  margin: 4px 0;
  width: 100%;
  display: flex;
  justify-content: center;
}

.team-chip {
  margin: 0 !important;
  font-size: 11px !important;
  min-height: 20px !important;
  font-weight: bold;
}

.character-ap-section {
  width: 100%;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.character-ap-label {
  font-size: 10px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.character-ap-value {
  font-size: 16px;
  font-weight: bold;
  text-align: center;
  margin: 4px 0;
}

.ap-progress {
  width: 100%;
  height: 4px;
  margin-top: 6px;
}

.active-character-card {
  background: rgba(68, 170, 255, 0.25) !important;
  border: 2px solid #44aaff !important;
  box-shadow: 0 0 12px rgba(68, 170, 255, 0.5) !important;
  transform: scale(1.02);
  transition: all 0.2s ease;
}

.friendly-character-card {
  background: rgba(68, 170, 255, 0.1) !important;
  border: 1px solid rgba(68, 170, 255, 0.4) !important;
}

.friendly-character-card:hover {
  background: rgba(68, 170, 255, 0.15) !important;
  transform: translateY(-2px);
  transition: all 0.2s ease;
}

.enemy-character-card {
  background: rgba(255, 68, 68, 0.1) !important;
  border: 1px solid rgba(255, 68, 68, 0.4) !important;
}

.enemy-character-card:hover {
  background: rgba(255, 68, 68, 0.15) !important;
  transform: translateY(-2px);
  transition: all 0.2s ease;
}

.debug-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 30;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(0, 255, 0, 0.3);
  pointer-events: none;
}

@media (max-width: 768px) {
  .characters-panel {
    padding: 12px 16px;
    min-height: 150px;
  }

  .character-card-content {
    padding: 12px;
    min-width: 110px;
    width: 110px;
  }

  .character-symbol {
    font-size: 36px;
  }

  .character-name {
    font-size: 11px;
  }

  .character-ap-value {
    font-size: 13px;
  }

  .characters-container {
    gap: 12px;
  }

  .team-chip {
    font-size: 9px !important;
  }
}
</style>
