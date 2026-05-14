<template>
  <q-page class="game-page">
    <canvas ref="canvasRef" class="game-canvas" @touchstart.prevent="onTouchStart" @touchmove.prevent="onTouchMove" @touchend.prevent="onTouchEnd"
      @click.prevent="onClick" @mousemove="onMouseMove" @mouseleave="onMouseLeave"></canvas>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import config from 'src/game/config.json'
import TileMap from 'src/game/TileMap.js'
import Player from 'src/game/Player.js'
import Npc from 'src/game/Npc.js'
import Item from 'src/game/Item.js'
import Camera from 'src/game/Camera.js'
import InputManager from 'src/game/InputManager.js'
import Renderer from 'src/game/Renderer.js'
import Pathfinder from 'src/game/Pathfinder.js'

// ============ КОЛОННЫ ============
const pillars = [
  [10, 8], [10, 9], [10, 10], [30, 15], [30, 16], [30, 17],
  [50, 25], [50, 26], [15, 30], [16, 30], [17, 30],
  [45, 7], [45, 8], [45, 9], [25, 20], [26, 20], [27, 20],
  [35, 10], [36, 10], [37, 10], [55, 32], [56, 32], [57, 32]
]

// ============ ИНИЦИАЛИЗАЦИЯ ============
const map = new TileMap(config.cols, config.rows)
map.fill()
map.setWalls(pillars)

const player = new Player(config.cols >> 1, config.rows >> 1, config)
const camera = new Camera(player.x, player.y, config.cameraSpeed)
const input = new InputManager(config.swipeThreshold)
const pathfinder = new Pathfinder(map)

const items = [
  new Item(15, 10, config), new Item(40, 20, config),
  new Item(25, 30, config), new Item(50, 15, config),
  new Item(35, 5, config)
]

const npcs = [
  new Npc(20, 12, config.symbols.npcStatic, config.colors.npcStatic, 'static', config),
  new Npc(45, 22, config.symbols.npcWander, config.colors.npcWander, 'wander', config)
]

// ============ CANVAS ============
const canvasRef = ref(null)
let ctx = null
let canvas = null
let renderer = null
let animationId = null
let lastTime = 0
let resizeTimeout = null

function resizeCanvas() {
  canvas = canvasRef.value
  if (!canvas) return

  const dpr = Math.min(window.devicePixelRatio || 1, config.dprCap)
  const rect = canvas.getBoundingClientRect()

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvas.style.width = rect.width + 'px'
  canvas.style.height = rect.height + 'px'

  ctx = canvas.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)

  if (!renderer) {
    renderer = new Renderer(ctx, config)
  }
  renderer.resize(rect.width, rect.height, dpr)
}

function onResize() {
  clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(resizeCanvas, config.resizeDebounce)
}

// ============ ИГРОВОЙ ЦИКЛ ============
function gameLoop(time) {
  const dt = lastTime ? Math.min((time - lastTime) * 0.001, config.dtCap) : 0.016
  lastTime = time

  // --- Обработка клика ---
  const click = input.consumeClick()
  if (click) {
    const worldX = (click.x - renderer.halfW) / renderer.tileSize + camera.x
    const worldY = (click.y - renderer.halfH) / renderer.tileSize + camera.y
    const tileX = worldX | 0
    const tileY = worldY | 0

    const blocked = npcs.map(n => ({ x: n.x | 0, y: n.y | 0 }))

    const path = pathfinder.find(
      player.x | 0, player.y | 0,
      tileX, tileY,
      blocked
    )

    if (path) {
      player.setPath(path)
    }
  }

  // --- Update ---
  player.update(dt, input, map, npcs)
  camera.update(dt, input)
  map.computeFov(player.x, player.y, config.fovRadius)

  for (const npc of npcs) npc.update(dt, map, player, npcs)

  for (const item of items) {
    if (!item.collected && item.occupies(player.x | 0, player.y | 0)) {
      item.collect()
    }
  }
  const hoverTile = input.getMouseTile(camera, renderer)
  let hoverTileX = null, hoverTileY = null
  if (hoverTile) {
    hoverTileX = hoverTile.x
    hoverTileY = hoverTile.y
  }

  // Передаём в renderer
  renderer.hoverTileX = hoverTileX
  renderer.hoverTileY = hoverTileY
  renderer.mouseScreenX = input.mouseX
  renderer.mouseScreenY = input.mouseY
  renderer._pathfinder = pathfinder
  renderer._blockedCache = npcs.map(n => ({ x: n.x | 0, y: n.y | 0 }))
  // --- Draw ---
  renderer.draw(map, player, npcs, items, camera)
  animationId = requestAnimationFrame(gameLoop)
}

// ============ СОБЫТИЯ ============
function onTouchStart(e) { input.handleTouchStart(e) }
function onTouchMove(e) { input.handleTouchMove(e) }
function onTouchEnd() { input.handleTouchEnd() }
function onClick(e) { input.handleClick(e) }
function onKeyDown(e) { input.handleKeyDown(e) }
function onKeyUp(e) { input.handleKeyUp(e) }
function onMouseMove(e) { input.handleMouseMove(e) }
function onMouseLeave() { input.handleMouseLeave() }

// ============ ЖИЗНЕННЫЙ ЦИКЛ ============
onMounted(() => {
  resizeCanvas()
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  lastTime = performance.now()
  gameLoop(lastTime)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  clearTimeout(resizeTimeout)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>
