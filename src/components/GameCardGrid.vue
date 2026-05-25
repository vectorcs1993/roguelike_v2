<template>
  <div class="grid-wrapper" ref="gridWrapper">
    <!-- Кастомный drag-образ -->
    <div v-if="dragImage.show" class="drag-preview" :style="{
      left: dragImage.x + 'px',
      top: dragImage.y + 'px',
      width: dragImage.width + 'px',
      height: dragImage.height + 'px',
    }">
      <div class="card-face player-face">
        <div class="card-icon">🧑</div>
        <div class="card-title">Вы</div>
        <div class="card-sub">❤️ {{ playerHP }}/100</div>
      </div>
    </div>

    <div v-for="(card, index) in cards" :key="card.id" class="card-cell" :class="cellClass(card, index)" @click="handleClick(card, index)"
      @dragover.prevent="onDragOver(card, index)" @dragleave="onDragLeave" @drop="onDrop(card, index)">
      <CardFace :card="card" :index="index" :player-h-p="playerHP" :icon="getIcon(card.topCard)" @dragstart="onDragStart" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import CardFace from 'src/components/CardFace.vue'

const props = defineProps({
  cards: { type: Array, required: true },
  playerHP: { type: Number, default: 100 }
})

const emit = defineEmits(['cell-click', 'player-move'])

const gridWrapper = ref(null)
const dragIndex = ref(null)
const overIndex = ref(null)
const isDragging = ref(false)

const dragImage = ref({
  show: false,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
})

let cardWidth = 0
let cardHeight = 0

const updateCardSize = () => {
  if (!gridWrapper.value) return
  const cells = gridWrapper.value.querySelectorAll('.card-cell')
  if (cells.length > 0) {
    const rect = cells[0].getBoundingClientRect()
    cardWidth = rect.width
    cardHeight = rect.height
  }
}

const onGlobalDrag = (e) => {
  if (!isDragging.value) return
  dragImage.value.x = e.clientX - cardWidth / 2
  dragImage.value.y = e.clientY - cardHeight / 2
}

const onGlobalDragEnd = () => {
  isDragging.value = false
  dragImage.value.show = false
  overIndex.value = null
  dragIndex.value = null
}

onMounted(() => {
  updateCardSize()
  window.addEventListener('resize', updateCardSize)
  document.addEventListener('dragover', onGlobalDrag)
  document.addEventListener('dragend', onGlobalDragEnd)
  document.addEventListener('drop', onGlobalDragEnd)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateCardSize)
  document.removeEventListener('dragover', onGlobalDrag)
  document.removeEventListener('dragend', onGlobalDragEnd)
  document.removeEventListener('drop', onGlobalDragEnd)
})

const getPlayerIndex = () => props.cards.findIndex(c => c.isPlayer)

const isNeighbor = (a, b) => {
  if (a === -1 || b === -1) return false
  const r1 = Math.floor(a / 3), c1 = a % 3
  const r2 = Math.floor(b / 3), c2 = b % 3
  return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1 && (r1 !== r2 || c1 !== c2)
}

const getIcon = (topCard) => {
  if (!topCard) return '?'
  return { item: '📦', weapon: '⚔️', enemy: '💀', trap: '⚠️', location: '🏚️', event: '📜' }[topCard.type] || '🃏'
}

const cellClass = (card, index) => {
  const pi = getPlayerIndex()
  return {
    'cell-player': card.isPlayer,
    'cell-closed': !card.revealed && !card.isEmpty && !card.isPlayer,
    'cell-revealed': card.revealed && !card.isEmpty,
    'cell-empty': card.isEmpty,
    'cell-neighbor': pi !== -1 && isNeighbor(pi, index) && !card.isPlayer,
    'cell-dragging': dragIndex.value === index,
    'cell-over': overIndex.value === index,
  }
}

const handleClick = (card, index) => {
  if (isDragging.value) return
  const pi = getPlayerIndex()
  if (!isNeighbor(pi, index) && !card.isPlayer) return
  emit('cell-click', { card, index })
}

const onDragStart = (e, index) => {
  updateCardSize()

  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, 1, 1)
  e.dataTransfer.setDragImage(canvas, 0, 0)

  dragIndex.value = index
  isDragging.value = true

  dragImage.value.show = true
  dragImage.value.x = e.clientX - cardWidth / 2
  dragImage.value.y = e.clientY - cardHeight / 2
  dragImage.value.width = cardWidth
  dragImage.value.height = cardHeight

  e.dataTransfer.effectAllowed = 'move'
}

const onDragOver = (card, index) => {
  if (dragIndex.value === null) return
  const pi = dragIndex.value
  if (card.topCard?.type === 'enemy' && card.enemyData?.hp > 0) return
  if (!isNeighbor(pi, index)) return
  overIndex.value = index
}

const onDragLeave = () => {
  overIndex.value = null
}

const onDrop = (card, index) => {
  overIndex.value = null
  const pi = dragIndex.value
  dragIndex.value = null
  isDragging.value = false
  dragImage.value.show = false

  if (pi === null || pi === -1) return
  if (!isNeighbor(pi, index)) return
  if (card.topCard?.type === 'enemy' && card.enemyData?.hp > 0) return

  emit('player-move', { from: pi, to: index })
}
</script>

<style scoped>
.grid-wrapper {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 8px;
  width: 100%;
  height: 100%;
  aspect-ratio: 2 / 3;
  margin: 0 auto;
  position: relative;
}

.card-cell {
  perspective: 800px;
  cursor: default;
  position: relative;
}

/* Drag states */
.cell-dragging .player-face {
  opacity: 0.3;
}

.cell-over .card-face {
  border-color: #2a2a2a;
}

/* Drag-превью */
.drag-preview {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  opacity: 0.85;
}

.drag-preview .player-face {
  border-color: #2a2a2a;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 6px;
  box-sizing: border-box;
  background: #1a1a1a;
}
</style>
