<template>
  <q-page class="game-page">
    <canvas ref="canvasRef" class="game-canvas" @touchstart.prevent="onTouchStart" @touchmove.prevent="onTouchMove" @touchend.prevent="onTouchEnd"
      @click.prevent="onClick" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @contextmenu.prevent="onContextMenu" @mousedown="onMouseDown"
      @mouseup="onMouseUp"></canvas>

    <!-- Опционально: отображение названия локации -->
    <div class="location-name" v-if="locationName">{{ locationName }}</div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import config from 'src/game/config.json'
import GameLoop from 'src/game/GameLoop.js'
import Location from 'src/game/Location.js'

// Выбор стартовой локации (можно сделать переключение по кнопке)
const startLocation = Location.createForest(config)
// const startLocation = Location.createDungeon(config)
// const startLocation = Location.createDesert(config)

const canvasRef = ref(null)
let game = null
let resizeTimeout = null

// Реактивное название локации
const locationName = computed(() => game?.currentLocation?.name || '')

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

// Пример переключения локации (можно повесить на кнопку)
function switchToDungeon() {
  if (game) {
    game.changeLocation(Location.createDungeon(config))
  }
}

// Проброс событий
function onTouchStart(e) { game?.onTouchStart(e) }
function onTouchMove(e) { game?.onTouchMove(e) }
function onTouchEnd() { game?.onTouchEnd() }
function onClick(e) { game?.onClick(e) }
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

  // Пример: переключение локации по нажатию клавиши L (для теста)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyL') {
      switchToDungeon()
    }
  })
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
</style>
