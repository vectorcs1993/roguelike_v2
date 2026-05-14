<template>
  <q-page class="game-page">
    <canvas ref="canvasRef" class="game-canvas" @touchstart.prevent="handleTouchStart" @touchmove.prevent="handleTouchMove"
      @touchend.prevent="handleTouchEnd"></canvas>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// ============ НАСТРОЙКИ ============
const BASE_TILE_SIZE = 128
const COLS = 60
const ROWS = 40
const MOVE_INTERVAL = 0.2
const CAMERA_SMOOTH = 10
const NPC_MOVE_SPEED = 8
// ============ КАРТА ============
const mapTiles = Array.from({ length: ROWS }, (_, y) =>
  Array.from({ length: COLS }, (_, x) => {
    if (y === 0 || y === ROWS - 1 || x === 0 || x === COLS - 1) return 1 // стена
    return 0 // пол
  })
)

// Колонны (используем числа для быстрой проверки)
const pillars = [
  [10, 8], [10, 9], [10, 10],
  [30, 15], [30, 16], [30, 17],
  [50, 25], [50, 26],
  [15, 30], [16, 30], [17, 30],
  [45, 7], [45, 8], [45, 9],
  [25, 20], [26, 20], [27, 20],
  [35, 10], [36, 10], [37, 10],
  [55, 32], [56, 32], [57, 32]
]

// ============ ПРЕДМЕТЫ ============
// [x, y, символ, цвет]
const items = [
  { x: 15, y: 10, char: '$', color: '#ffd700', collected: false },
  { x: 40, y: 20, char: '$', color: '#ffd700', collected: false },
  { x: 25, y: 30, char: '$', color: '#ffd700', collected: false },
  { x: 50, y: 15, char: '$', color: '#ffd700', collected: false },
  { x: 35, y: 5, char: '$', color: '#ffd700', collected: false },
]

// ============ NPC ============
const npcs = [
  // Статичный
  {
    x: 20, y: 12, vx: 20, vy: 12,  // vx/vy — визуальная позиция (дробная)
    char: 'M', color: '#4af', type: 'static',
    moving: false, fromX: 20, fromY: 12, toX: 20, toY: 12, progress: 0
  },
  // Блуждающий
  {
    x: 45, y: 22, vx: 45, vy: 22,
    char: 'G', color: '#f84', type: 'wander', timer: 0, interval: 1.5,
    moving: false, fromX: 45, fromY: 22, toX: 45, toY: 22, progress: 0
  },
]

pillars.forEach(([x, y]) => {
  if (y > 0 && y < ROWS - 1 && x > 0 && x < COLS - 1) {
    mapTiles[y][x] = 1
  }
})

// ============ ИГРОК ============
let playerX = (COLS >> 1) + 0.5
let playerY = (ROWS >> 1) + 0.5
let moveTimer = 0

// ============ КАМЕРА ============
let cameraX = playerX
let cameraY = playerY

// ============ CANVAS ============
const canvasRef = ref(null)
let ctx = null
let canvas = null
let animationId = null
let lastTime = 0
let tileSize = BASE_TILE_SIZE

// Кешированные значения (чтобы не дёргать DOM каждый кадр)
let canvasW = 0
let canvasH = 0
let halfW = 0
let halfH = 0

// Предварительно созданные цвета (избегаем парсинга строк)
const COLORS = {
  wall: '#555',
  floor: '#000000',
  player: '#0f0'
}

// ============ ВВОД ============
const keys = {}

// ============ ТАЧ ============
let touchStartX = 0
let touchStartY = 0
let touchActive = false
const SWIPE_THRESHOLD = 10
let touchDirX = 0
let touchDirY = 0

function handleTouchStart(e) {
  const touch = e.touches[0]
  touchStartX = touch.clientX
  touchStartY = touch.clientY
  touchActive = true
  touchDirX = 0
  touchDirY = 0
}

function handleTouchMove(e) {
  if (!touchActive) return
  const touch = e.touches[0]
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY

  if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(dy) > SWIPE_THRESHOLD) {
    if (Math.abs(dx) > Math.abs(dy)) {
      touchDirX = Math.sign(dx)
      touchDirY = 0
    } else {
      touchDirX = 0
      touchDirY = Math.sign(dy)
    }
    touchStartX = touch.clientX
    touchStartY = touch.clientY
  }
}

function handleTouchEnd() {
  touchActive = false
  touchDirX = 0
  touchDirY = 0
}

// ============ РЕСАЙЗ (один раз, кешируем размеры) ============
let resizeTimeout = null

function resizeCanvas() {
  canvas = canvasRef.value
  if (!canvas) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const rect = canvas.getBoundingClientRect()

  canvasW = rect.width
  canvasH = rect.height
  halfW = canvasW / 2
  halfH = canvasH / 2

  canvas.width = canvasW * dpr
  canvas.height = canvasH * dpr
  canvas.style.width = canvasW + 'px'
  canvas.style.height = canvasH + 'px'

  ctx = canvas.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)

  tileSize = Math.max(12, Math.min(BASE_TILE_SIZE, Math.floor(Math.min(canvasW, canvasH) / 15)))

  // Шрифт для всех ASCII-символов
  ctx.font = `bold ${tileSize}px "Courier New", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
}

function onResize() {
  clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(resizeCanvas, 100)
}

// ============ ПРОВЕРКА ПРОХОДИМОСТИ ============
function isWalkable(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false
  return mapTiles[y][x] === 0 // 0 = пол, 1 = стена (быстрее чем !== '#')
}

// ============ ОБНОВЛЕНИЕ ============
function update(deltaTime) {
  const dt = deltaTime < 0.1 ? deltaTime : 0.1

  let moveX = 0
  let moveY = 0
  if (keys['ArrowUp'] || keys['KeyW']) moveY = -1
  if (keys['ArrowDown'] || keys['KeyS']) moveY = 1
  if (keys['ArrowLeft'] || keys['KeyA']) moveX = -1
  if (keys['ArrowRight'] || keys['KeyD']) moveX = 1

  if (touchActive && (touchDirX !== 0 || touchDirY !== 0)) {
    moveX = touchDirX
    moveY = touchDirY
  }
  moveTimer += dt
  // --- Обновление NPC ---
  for (const npc of npcs) {
    // Анимация перемещения
    if (npc.moving) {
      npc.progress += NPC_MOVE_SPEED * dt
      if (npc.progress >= 1) {
        npc.vx = npc.toX
        npc.vy = npc.toY
        npc.moving = false
        npc.progress = 0
      } else {
        const t = npc.progress < 0.5
          ? 2 * npc.progress * npc.progress
          : 1 - Math.pow(-2 * npc.progress + 2, 2) / 2
        npc.vx = npc.fromX + (npc.toX - npc.fromX) * t
        npc.vy = npc.fromY + (npc.toY - npc.fromY) * t
      }
    }

    // Блуждающий NPC выбирает новое направление
    if (npc.type === 'wander' && !npc.moving) {
      npc.timer += dt
      if (npc.timer >= npc.interval) {
        npc.timer = 0
        const dir = Math.random() * 4 | 0
        let dx = 0, dy = 0
        if (dir === 0) dy = -1
        else if (dir === 1) dy = 1
        else if (dir === 2) dx = -1
        else dx = 1

        const newX = npc.x + dx
        const newY = npc.y + dy
        const blocked =
          !isWalkable(newX, newY) ||
          (newX === (playerX | 0) && newY === (playerY | 0)) ||
          npcs.some(other => other !== npc && other.x === newX && other.y === newY)

        if (!blocked) {
          npc.fromX = npc.vx
          npc.fromY = npc.vy
          npc.toX = newX
          npc.toY = newY
          npc.x = newX
          npc.y = newY
          npc.moving = true
          npc.progress = 0
        }
      }
    }
  }
  if ((moveX !== 0 || moveY !== 0) && moveTimer >= MOVE_INTERVAL) {
    moveTimer = 0
    const newX = playerX + moveX
    const newY = playerY + moveY
    const tileX = newX | 0
    const tileY = newY | 0

    // Проверяем, не занята ли клетка NPC
    const npcBlocking = npcs.some(n => n.x === tileX && n.y === tileY)

    if (isWalkable(tileX, tileY) && !npcBlocking) {
      playerX = tileX + 0.5
      playerY = tileY + 0.5

      for (const item of items) {
        if (!item.collected && item.x === tileX && item.y === tileY) {
          item.collected = true
          break
        }
      }
    }
  }

  if (moveX === 0 && moveY === 0) {
    moveTimer = MOVE_INTERVAL
  }

  const smooth = CAMERA_SMOOTH * dt
  cameraX += (playerX - cameraX) * (smooth < 1 ? smooth : 1)
  cameraY += (playerY - cameraY) * (smooth < 1 ? smooth : 1)
}

// ============ ОТРИСОВКА (оптимизированная) ============
function draw() {
  const w = canvasW
  const h = canvasH

  // Очистка
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, w, h)

  // Смещение камеры
  const offsetX = halfW - cameraX * tileSize
  const offsetY = halfH - cameraY * tileSize

  // Границы видимости
  const invTileSize = 1 / tileSize
  const startCol = ((cameraX - (w * invTileSize * 0.5)) | 0) - 1
  const startRow = ((cameraY - (h * invTileSize * 0.5)) | 0) - 1
  const endCol = startCol + ((w * invTileSize) | 0) + 3
  const endRow = startRow + ((h * invTileSize) | 0) + 3

  const c0 = Math.max(0, startCol)
  const r0 = Math.max(0, startRow)
  const c1 = Math.min(COLS, endCol)
  const r1 = Math.min(ROWS, endRow)

  const ts = tileSize

  // Отрисовка тайлов
  for (let row = r0; row < r1; row++) {
    const rowOffset = row * ts + offsetY
    const tilesRow = mapTiles[row]

    for (let col = c0; col < c1; col++) {
      const x = col * ts + offsetX
      const y = rowOffset
      const cx = x + ts * 0.5
      const cy = y + ts * 0.5

      if (tilesRow[col] === 1) {
        ctx.fillStyle = COLORS.wall
        ctx.fillText('#', cx, cy)
      }
    }
  }



  // --- СЕТКА (после тайлов, перед игроком) ---
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'  // едва заметная белая
  ctx.lineWidth = 1

  const gridStartX = c0 * ts + offsetX
  const gridStartY = r0 * ts + offsetY
  const gridW = (c1 - c0) * ts
  const gridH = (r1 - r0) * ts

  // Вертикальные линии
  for (let col = c0; col <= c1; col++) {
    const x = col * ts + offsetX
    ctx.beginPath()
    ctx.moveTo(x, gridStartY)
    ctx.lineTo(x, gridStartY + gridH)
    ctx.stroke()
  }


  // Горизонтальные линии
  for (let row = r0; row <= r1; row++) {
    const y = row * ts + offsetY
    ctx.beginPath()
    ctx.moveTo(gridStartX, y)
    ctx.lineTo(gridStartX + gridW, y)
    ctx.stroke()
  }

  // --- NPC ---
  for (const npc of npcs) {
    const nx = npc.vx * ts + offsetX + ts * 0.5
    const ny = npc.vy * ts + offsetY + ts * 0.5
    ctx.fillStyle = npc.color
    ctx.fillText(npc.char, nx, ny)
  }

  // --- ПРЕДМЕТЫ ---
  for (const item of items) {
    if (item.collected) continue
    const ix = item.x * ts + offsetX + ts * 0.5
    const iy = item.y * ts + offsetY + ts * 0.5
    ctx.fillStyle = item.color
    ctx.fillText(item.char, ix, iy)
  }

  // Игрок всегда в центре экрана
  const px = halfW
  const py = halfH

  // Символ (без свечения)
  ctx.fillStyle = COLORS.player
  ctx.fillText('@', px, py)
}

// ============ ГЛАВНЫЙ ЦИКЛ ============
function gameLoop(time) {
  const deltaTime = lastTime ? (time - lastTime) * 0.001 : 0.016
  lastTime = time

  update(deltaTime)
  draw()
  animationId = requestAnimationFrame(gameLoop)
}

// ============ КЛАВИАТУРА ============
function handleKeyDown(e) {
  keys[e.code] = true
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
    e.preventDefault()
  }
}

function handleKeyUp(e) {
  keys[e.code] = false
}

// ============ ЖИЗНЕННЫЙ ЦИКЛ ============
onMounted(() => {
  resizeCanvas()
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  lastTime = performance.now()
  gameLoop(lastTime)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  clearTimeout(resizeTimeout)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})
</script>

<style lang="scss" scoped>
.game-page {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: #0a0a12;
  display: flex;
  justify-content: center;
  align-items: center;
}

.game-canvas {
  display: block;
  width: 100vw;
  width: 100dvw;
  height: 100vh;
  height: 100dvh;
  image-rendering: auto;
  touch-action: none;
}
</style>
