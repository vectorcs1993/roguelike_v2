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

    <!-- Информация об активном персонаже -->
    <q-card class="active-character-info" flat>
      <div class="row items-center q-pa-sm" style="gap: 8px">
        <div class="text-h5">{{ activeCharacterInfo?.char }}</div>
        <div>
          <div class="text-subtitle2">{{ activeCharacterInfo?.name }}</div>
          <div class="text-caption text-grey">Активный</div>
        </div>
      </div>
    </q-card>

    <!-- Панель персонажей -->
    <div class="characters-panel">
      <div class="row justify-center q-gutter-md">
        <q-card v-for="character in charactersList" :key="character.id"
          :class="{ 'active-character': character.isActive && character.isSelectable, 'enemy-character': !character.isSelectable }"
          :style="{ cursor: character.isSelectable ? 'pointer' : 'not-allowed', minWidth: '180px' }" @click="onCharacterClick(character)" flat
          bordered>
          <q-card-section horizontal>
            <q-card-section class="q-pa-sm">
              <div class="text-h4">{{ character.char }}</div>
            </q-card-section>
            <q-card-section>
              <div class="text-subtitle1">{{ character.name }}</div>
              <q-chip :color="getCharacterStatusColor(character)" size="sm" class="q-mt-xs">
                {{ getCharacterStatusText(character) }}
              </q-chip>
            </q-card-section>
          </q-card-section>
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

// Реактивные данные
const charactersCount = ref(0)
const selectableCount = ref(0)
const charactersListData = ref([])
const locationNameValue = ref('')

const activeCharacterInfo = computed(() => {
  if (!game?.currentLocation) return null
  const active = game.currentLocation.getActiveCharacter()
  if (!active) return null
  return { char: active.char, name: active.name }
})

const charactersList = computed(() => charactersListData.value)

function getCharacterStatusColor(character) {
  if (!character.isSelectable) return 'red'
  if (character.isActive) return 'positive'
  return 'primary'
}

function getCharacterStatusText(character) {
  if (!character.isSelectable) return '👹 Враг'
  if (character.isActive) return '● Управление'
  return '○ Ожидание'
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
    teamColor: char.team?.color || '#ffffff'
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

  // НЕМЕДЛЕННОЕ обновление UI после смены персонажа
  await updateCharactersList()
  // Дополнительное обновление в следующем кадре для гарантии
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

  // Первоначальное обновление
  setTimeout(() => updateCharactersList(), 50)
})

onUnmounted(() => {
  game?.stop()
  clearTimeout(resizeTimeout)
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

.active-character-info {
  position: absolute;
  bottom: 120px;
  right: 20px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(68, 170, 255, 0.3);
  pointer-events: none;
}

.characters-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px;
  overflow-x: auto;
}

.active-character {
  background: rgba(68, 170, 255, 0.15) !important;
  border: 1px solid #44aaff !important;
}

.enemy-character {
  background: rgba(255, 68, 68, 0.1) !important;
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
  .active-character-info {
    bottom: 100px;
  }

  .characters-panel {
    padding: 8px;
  }
}
</style>
