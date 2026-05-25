<template>
  <q-slide-item v-if="card.revealed && !card.isEmpty && card.topCard" ref="slideItem" @right="onSwipeRight" right-color="transparent"
    class="card-slide" dark>
    <template v-slot:right>
      <div class="fit">
        {{ card.topCard?.description }}
      </div>
    </template>

    <div class="card-face card-front-style">
      <div class="card-icon">{{ icon }}</div>
      <div class="card-title">{{ card.topCard.title }}</div>
      <div class="card-sub">{{ card.topCard.description || '' }}</div>
      <div v-if="card.topCard.type === 'enemy'" class="card-badge enemy">
        ❤️ {{ card.enemyData?.hp }}/{{ card.enemyData?.maxHp }}
      </div>
      <div v-else-if="card.topCard.type === 'trap'" class="card-badge trap">⚠️ Ловушка</div>
      <div v-else-if="card.topCard.type === 'item'" class="card-badge item">📦 Предмет</div>
      <div v-else-if="card.topCard.type === 'weapon'" class="card-badge weapon">⚔️ Оружие</div>
      <div v-else-if="card.topCard.type === 'location'" class="card-badge location">🏚️ Локация</div>
      <div v-else-if="card.topCard.type === 'event'" class="card-badge event">📜 Событие</div>
    </div>
  </q-slide-item>

  <!-- ИГРОК -->
  <div v-else-if="card.isPlayer" class="card-face player-face" draggable="true" @dragstart="$emit('dragstart', $event, index)">
    <div class="card-icon">🧑</div>
    <div class="card-title">Вы</div>
    <div class="card-sub">❤️ {{ playerHP }}/100</div>
  </div>

  <!-- ЗАКРЫТАЯ -->
  <div v-else-if="!card.revealed && !card.isEmpty" class="card-flip-wrapper">
    <div class="card-flip-inner" :class="{ 'is-flipped': card._flipping }">
      <div class="card-face card-front card-back-style">
        <div class="card-pattern">
          <div class="back-icon">✦</div>
          <div class="back-count">{{ card.stack?.length || 0 }}</div>
        </div>
      </div>
      <div class="card-face card-back card-front-style">
        <div class="card-icon">{{ icon }}</div>
        <div class="card-title">{{ card.topCard?.title || '???' }}</div>
        <div class="card-sub">{{ card.topCard?.description || '' }}</div>
      </div>
    </div>
  </div>

  <!-- ПУСТАЯ -->
  <div v-else class="card-face card-empty">
    <div class="empty-icon"></div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  card: { type: Object, required: true },
  index: { type: Number, required: true },
  playerHP: { type: Number, default: 100 },
  icon: { type: String, default: '?' },
})

const emit = defineEmits(['dragstart', 'swipe-info'])
const slideItem = ref(null)

const onSwipeRight = () => {
  emit('swipe-info', { card: props.card })

  if (slideItem.value) {
    slideItem.value.reset()
  }
}
</script>

<style scoped>
/* Убираем лишнее от q-slide-item */
.card-slide {
  width: 100%;
  height: 100%;
  border-radius: 6px;
}

.card-slide :deep(.q-slide-item__content) {
  width: 100%;
  height: 100%;
}

.swipe-info-hint {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0 6px 6px 0;
}

.card-face {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  border: 1px solid #1a1a1a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 6px;
  box-sizing: border-box;
  user-select: none;
  background: #111;
}

/* Игрок */
.player-face {
  background: #1a1a1a;
  border-color: #2a2a2a;
  cursor: grab;
}

.player-face:active {
  cursor: grabbing;
}

/* Анимация переворота */
.card-flip-wrapper {
  width: 100%;
  height: 100%;
  perspective: 800px;
}

.card-flip-inner {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.5s ease;
}

.card-flip-inner.is-flipped {
  transform: rotateY(180deg);
}

.card-flip-inner .card-front,
.card-flip-inner .card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 6px;
  box-sizing: border-box;
}

.card-flip-inner .card-front {
  z-index: 2;
}

.card-flip-inner .card-back {
  transform: rotateY(180deg);
}

/* Рубашка */
.card-back-style {
  background: #0d0d0d;
  border: 1px solid #1a1a1a;
}

/* Открытая */
.card-front-style {
  background: #111;
  border: 1px solid #1a1a1a;
}

/* Пустая */
.card-empty {
  background: #0a0a0a;
  border: 1px dashed #1a1a1a;
}

/* Контент */
.card-pattern {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.back-icon {
  font-size: 1.5rem;
  color: #1a1a1a;
}

.back-count {
  font-size: 0.6rem;
  color: #222;
}

.card-icon {
  font-size: 1.5rem;
  margin-bottom: 2px;
  opacity: 0.8;
}

.card-title {
  font-size: 0.7rem;
  font-weight: 500;
  color: #ccc;
  line-height: 1.2;
}

.card-sub {
  font-size: 0.55rem;
  color: #555;
  margin-top: 2px;
}

/* Бейджи */
.card-badge {
  margin-top: 4px;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.55rem;
  font-weight: 500;
}

.enemy {
  background: #1a0000;
  color: #661111;
}

.trap {
  background: #1a1000;
  color: #664400;
}

.item {
  background: #001a00;
  color: #336633;
}

.weapon {
  background: #1a0000;
  color: #662222;
}

.location {
  background: #000a1a;
  color: #334466;
}

.event {
  background: #0d001a;
  color: #442266;
}
</style>
