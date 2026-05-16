<template>
  <q-page class="game-page">
    <canvas ref="canvasRef" class="game-canvas" @touchstart.prevent="onTouchStart" @touchmove.prevent="onTouchMove" @touchend.prevent="onTouchEnd"
      @click.prevent="onClick" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @contextmenu.prevent="onContextMenu" @mousedown="onMouseDown"
      @mouseup="onMouseUp"></canvas>

    <!-- Название локации -->
    <div class="location-name" v-if="locationName">{{ locationName }}</div>

    <!-- Информация об активном персонаже -->
    <div class="active-character-info" v-if="activeCharacterInfo">
      <span class="active-char">{{ activeCharacterInfo.char }}</span>
      <span class="active-name">{{ activeCharacterInfo.name }}</span>
    </div>
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

const locationName = computed(() => game?.currentLocation?.name || '')
const activeCharacterInfo = computed(() => {
  if (!game?.currentLocation) return null
  const active = game.currentLocation.getActiveCharacter()
  if (!active) return null
  return { char: active.char, name: active.name }
})

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

function updateUi() {
  // Принудительно обновляем UI через рендер
  if (game && game.renderer) {
    // UI обновится в следующем кадре
  }
}

// Проброс событий
function onTouchStart(e) { game?.onTouchStart(e) }
function onTouchMove(e) { game?.onTouchMove(e) }
function onTouchEnd() { game?.onTouchEnd() }
function onClick(e) { game?.onClick(e) }
function onKeyDown(e) {
  game?.onKeyDown(e)
  // УДАЛЕНЫ клавиши для переключения локаций
}
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

  // Периодическое обновление UI для отображения активного персонажа
  updateInterval = setInterval(updateUi, 100)
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
}

.game-canvas:active {
  cursor: default;
}

.location-name {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: #ffd700;
  padding: 8px 16px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 14px;
  pointer-events: none;
  z-index: 10;
}

.active-character-info {
  position: absolute;
  bottom: 100px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: #ffffff;
  padding: 8px 16px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 16px;
  pointer-events: none;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
}

.active-char {
  font-size: 24px;
}

.active-name {
  font-size: 14px;
}
</style>
