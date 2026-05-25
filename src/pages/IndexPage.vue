<template>
  <q-page class="page-dark">
    <div class="game-layout">

      <!-- Верхняя панель -->
      <div class="top-bar">
        <q-badge class="stat-badge">❤️ {{ hp }}/100</q-badge>
        <q-badge class="stat-badge">⚡ {{ energy }}/100</q-badge>
        <q-badge class="stat-badge">Ход {{ turn }}</q-badge>
        <q-badge class="stat-badge">Рука {{ hand.length }}/{{ maxHand }}</q-badge>
      </div>

      <!-- Рука -->
      <div class="hand-row">
        <template v-if="hand.length > 0 || weapon">
          <!-- Экипированное оружие (слева, выделено) -->
          <q-chip v-if="weapon" :label="weapon.title" :icon="weapon.icon" color="negative" text-color="white" size="sm" dense class="equipped-chip">
            <q-tooltip>Экипировано: {{ weapon.description }}</q-tooltip>
          </q-chip>

          <!-- Разделитель -->
          <span v-if="weapon && hand.length > 0" class="hand-divider">|</span>

          <!-- Карты в руке -->
          <q-chip v-for="(c, i) in hand" :key="i" :label="c.title" :icon="c.icon"
            :color="c.type === 'weapon' ? 'warning' : c.type === 'item' ? 'positive' : 'primary'" text-color="white" size="sm" clickable
            @click="useCard(i)" dense>
            <q-tooltip>{{ c.description }}</q-tooltip>
          </q-chip>
        </template>
        <span v-else class="hand-empty">рука пуста</span>
      </div>

      <!-- Игровое поле -->
      <div class="field-container">
        <GameCardGrid :cards="field" :player-h-p="hp" @cell-click="onCellClick" @player-move="onPlayerMove" />
      </div>

      <!-- Лог -->
      <div class="log-area">
        <div v-for="(log, i) in logs" :key="i" class="log-line">{{ log }}</div>
        <div v-if="logs.length === 0" class="log-line log-dim">действий пока нет</div>
      </div>

    </div>

    <!-- ЭКРАН СМЕРТИ -->
    <q-dialog v-model="isDead" persistent>
      <q-card class="death-card">
        <q-card-section class="text-center">
          <div class="death-icon">💀</div>
          <div class="death-title">Вы погибли</div>
          <div class="death-sub">
            Выжил ходов: {{ turn }}<br>
            Собрано карт: {{ collectedCards }}
          </div>
        </q-card-section>
        <q-card-actions align="center">
          <q-btn label="Начать заново" color="dark" text-color="grey-4" @click="restartGame" unelevated />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, watch } from 'vue'
import GameCardGrid from 'src/components/GameCardGrid.vue'
import { DECK, GAME_CONFIG, buildStacks, createField, createEnemyData } from 'src/data/gameData'

// --- Состояние ---
const hp = ref(GAME_CONFIG.START_HP)
const energy = ref(GAME_CONFIG.START_ENERGY)
const turn = ref(1)
const hand = ref([])
const maxHand = ref(GAME_CONFIG.MAX_HAND_SIZE)
const logs = ref([])
const weapon = ref(null)
const isDead = ref(false)
const collectedCards = ref(0)

const addLog = (msg) => {
  logs.value.unshift(`[${turn.value}] ${msg}`)
  if (logs.value.length > GAME_CONFIG.LOG_MAX_LINES) logs.value.pop()
}

let stacks = buildStacks(DECK)
const field = ref(createField(stacks))

// --- Watch ---
watch(hp, (val) => {
  if (val <= 0) {
    hp.value = 0
    isDead.value = true
    addLog('💀 Вы погибли')
  }
})

watch(field, () => {
  if (!field.value) return
  const allEmpty = field.value.every(c => c.isEmpty || c.isPlayer)
  const noEnemies = field.value.every(c => !c.enemyData || c.enemyData.hp <= 0)
  if (allEmpty && noEnemies && turn.value > 1) {
    isDead.value = true
    addLog('🏆 Сектор зачищен!')
  }
}, { deep: true })

// --- Логика ---
const removeTopCard = (card) => {
  card.stack.shift()
  if (card.stack.length === 0) {
    card.revealed = false
    card.isEmpty = true
    card.topCard = null
    card.enemyData = null
  } else {
    const next = card.stack[0]
    card.topCard = { ...next }
    card.enemyData = createEnemyData(next)
  }
}

const onCellClick = ({ card }) => {
  if (isDead.value) return

  if (card.isPlayer) {
    if (!card.revealed && !card.isEmpty && card.stack?.length > 0) {
      card._flipping = true
      const top = card.stack[0]
      card.topCard = { ...top }
      card.enemyData = createEnemyData(top)
      setTimeout(() => {
        card.revealed = true
        card._flipping = false
      }, GAME_CONFIG.FLIP_ANIMATION_MS)
      addLog(`Открыто: ${top.title}`)
      endTurn()
    } else {
      addLog('Это вы')
    }
    return
  }

  if (!card.revealed && !card.isEmpty && card.stack?.length > 0) {
    card._flipping = true
    const top = card.stack[0]
    card.topCard = { ...top }
    card.enemyData = createEnemyData(top)
    setTimeout(() => {
      card.revealed = true
      card._flipping = false
    }, GAME_CONFIG.FLIP_ANIMATION_MS)
    addLog(`Открыто: ${top.title}`)
    endTurn()
    return
  }

  if (card.revealed && !card.isEmpty && card.topCard) {
    const top = card.topCard

    if (top.type === 'item' || top.type === 'weapon') {
      if (hand.value.length >= maxHand.value) { addLog('Рука полна!'); return }
      hand.value.push(top)
      collectedCards.value++
      if (top.type === 'weapon') {
        if (weapon.value) hand.value.push(weapon.value)
        weapon.value = top
        addLog(`Взято и экипировано: ${top.title}`)
      } else {
        addLog(`Взято: ${top.title}`)
      }
      removeTopCard(card)
      endTurn()
      return
    }

    if (top.type === 'enemy') {
      const playerIndex = field.value.findIndex(c => c.isPlayer)
      const enemyIndex = field.value.indexOf(card)
      const isRangedWeapon = weapon.value?.ranged === true
      const isAdjacent = isAdjacentToPlayer(enemyIndex)
      const canCounter = card.enemyData.counterAttack !== false
      const aoe = weapon.value?.aoe || null

      // Дальнее оружие с AoE (обрез, автомат)
      if (isRangedWeapon && isAdjacent && playerIndex !== enemyIndex) {
        if (aoe === 'cone') {
          const coneTargets = getConeTargets(playerIndex, enemyIndex)
          dealAoEDamage(coneTargets, weapon.value, 'Обрез')
        } else if (aoe === 'line') {
          const lineTargets = getLineTargets(playerIndex, enemyIndex)
          dealAoEDamage(lineTargets, weapon.value, 'Автомат')
        } else {
          // Обычный выстрел
          const [min, max] = weapon.value.dmg
          const dmg = min + Math.floor(Math.random() * (max - min + 1))
          card.enemyData.hp -= dmg
          addLog(`Выстрел: -${dmg} HP врагу`)
          if (card.enemyData.hp <= 0) {
            addLog('Враг убит!')
            removeTopCard(card)
          }
        }
        endTurn()
        return
      }

      // Ближний бой (монтировка с оглушением)
      let dmg = GAME_CONFIG.FIST_DAMAGE
      if (weapon.value?.dmg) {
        const [min, max] = weapon.value.dmg
        dmg = min + Math.floor(Math.random() * (max - min + 1))
      }
      card.enemyData.hp -= dmg

      // Оглушение монтировкой
      if (weapon.value?.stun && card.enemyData.hp > 0) {
        card.enemyData.stunned = true
        card.enemyData._skipThisTurn = true  // ← сразу пропускает этот ход
        addLog(`Атака монтировкой: -${dmg} HP. Враг оглушён!`)
      } else {
        addLog(`Атака: -${dmg} HP врагу`)
      }

      // Ответный удар — только если не оглушён
      if (card.enemyData.hp > 0 && canCounter && !card.enemyData.stunned) {
        const [min, max] = card.enemyData.dmg
        const edmg = min + Math.floor(Math.random() * (max - min + 1))
        hp.value -= edmg
        addLog(`Враг бьёт в ответ: -${edmg} HP`)
      } else if (card.enemyData.hp <= 0) {
        addLog('Враг убит!')
        removeTopCard(card)
      }

      endTurn()
      return
    }

    if (top.type === 'trap') {
      if (Math.random() < GAME_CONFIG.TRAP_DISARM_CHANCE) {
        addLog('Ловушка обезврежена')
      } else {
        hp.value -= top.damage
        addLog(`Ловушка! -${top.damage} HP`)
      }
      removeTopCard(card)
      endTurn()
      return
    }

    if (top.type === 'location') {
      if (top.title === 'Распределитель') {
        const rnd = DECK.filter(c => c.type === 'item')
        if (rnd.length && hand.value.length < maxHand.value) {
          hand.value.push({ ...rnd[Math.floor(Math.random() * rnd.length)] })
          collectedCards.value++
          addLog('Получен предмет!')
        }
      } else if (top.title === 'Гермобункер') {
        hp.value = Math.min(GAME_CONFIG.START_HP, hp.value + 50)
        addLog('+50 HP от отдыха')
      } else {
        addLog(`${top.title}: использовано`)
      }
      removeTopCard(card)
      endTurn()
      return
    }

    if (top.type === 'event') {
      addLog(`Событие: ${top.title}`)
      removeTopCard(card)
      endTurn()
      return
    }
  }
}

const onPlayerMove = ({ from, to }) => {
  if (isDead.value) return

  const fromCard = field.value[from]
  const toCard = field.value[to]

  if (toCard.topCard?.type === 'enemy' && toCard.enemyData?.hp > 0) {
    addLog('Нельзя перейти на клетку с врагом')
    return
  }

  fromCard.isPlayer = false
  toCard.isPlayer = true

  addLog(`Перемещение: ${from + 1} → ${to + 1}`)

  // Автовскрытие только врагов на соседних клетках
  field.value.forEach((card, i) => {
    if (!card.isPlayer && !card.revealed && !card.isEmpty && card.stack?.length > 0 && isAdjacentToPlayer(i)) {
      const top = card.stack[0]
      if (top.type === 'enemy') {
        card.revealed = true
        card.topCard = { ...top }
        card.enemyData = createEnemyData(top)
        addLog(`Замечен враг: ${top.title}`)
      }
    }
  })

  endTurn()
}

const useCard = (i) => {
  if (isDead.value) return
  const c = hand.value[i]
  if (c.type === 'item' && c.heal) {
    hp.value = Math.min(GAME_CONFIG.START_HP, hp.value + c.heal)
    addLog(`+${c.heal} HP`)
    hand.value.splice(i, 1)
    endTurn()
  } else if (c.type === 'weapon') {
    // Снять текущее — положить в руку
    if (weapon.value) {
      hand.value.push(weapon.value)
    }
    // Экипировать новое
    weapon.value = c
    hand.value.splice(i, 1)
    addLog(`Экипировано: ${c.title}`)
    endTurn()
  }
}

// ИИ врагов
const isAdjacentToPlayer = (index) => {
  const pi = field.value.findIndex(c => c.isPlayer)
  if (pi === -1) return false
  const r1 = Math.floor(index / 3), c1 = index % 3
  const r2 = Math.floor(pi / 3), c2 = pi % 3
  return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1
}

const hasLineOfSight = (fromIndex) => {
  const pi = field.value.findIndex(c => c.isPlayer)
  if (pi === -1) return false
  const r1 = Math.floor(fromIndex / 3), c1 = fromIndex % 3
  const r2 = Math.floor(pi / 3), c2 = pi % 3

  if (r1 !== r2 && c1 !== c2) return false

  const minR = Math.min(r1, r2), maxR = Math.max(r1, r2)
  const minC = Math.min(c1, c2), maxC = Math.max(c1, c2)

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const idx = r * 3 + c
      if (idx === fromIndex || idx === pi) continue
      if (field.value[idx].enemyData && field.value[idx].enemyData.hp > 0) return false
    }
  }
  return true
}

const getNeighborsToPlayer = (fromIndex) => {
  const pi = field.value.findIndex(c => c.isPlayer)
  if (pi === -1) return []
  const r1 = Math.floor(fromIndex / 3), c1 = fromIndex % 3
  const r2 = Math.floor(pi / 3), c2 = pi % 3

  const result = []
  if (r1 < r2) result.push(fromIndex + 3)
  if (r1 > r2) result.push(fromIndex - 3)
  if (c1 < c2) result.push(fromIndex + 1)
  if (c1 > c2) result.push(fromIndex - 1)
  if (r1 < r2 && c1 < c2) result.push(fromIndex + 4)
  if (r1 < r2 && c1 > c2) result.push(fromIndex + 2)
  if (r1 > r2 && c1 < c2) result.push(fromIndex - 2)
  if (r1 > r2 && c1 > c2) result.push(fromIndex - 4)

  const all = [fromIndex - 4, fromIndex - 3, fromIndex - 2, fromIndex - 1, fromIndex + 1, fromIndex + 2, fromIndex + 3, fromIndex + 4]
  for (const n of all) {
    if (!result.includes(n) && n >= 0 && n < 9) result.push(n)
  }
  return result.filter(n => n >= 0 && n < 9)
}

// Получить все клетки в конусе от игрока в сторону цели
const getConeTargets = (playerIndex, targetIndex) => {
  const pr = Math.floor(playerIndex / 3), pc = playerIndex % 3
  const tr = Math.floor(targetIndex / 3), tc = targetIndex % 3

  const targets = [targetIndex]

  // Направление от игрока к цели
  const dr = Math.sign(tr - pr)  // -1, 0, 1
  const dc = Math.sign(tc - pc)

  // Добавляем клетки за целью (если есть)
  const beyond1 = (tr + dr) * 3 + (tc + dc)
  if (beyond1 >= 0 && beyond1 < 9 && Math.abs((tr + dr) - pr) <= 2 && Math.abs((tc + dc) - pc) <= 2) {
    targets.push(beyond1)
  }

  // Добавляем боковые клетки рядом с целью
  if (dr === 0) {
    // Горизонтальный выстрел
    const side1 = tr * 3 + (tc - 1)
    const side2 = tr * 3 + (tc + 1)
    if (side1 >= 0 && side1 < 9 && Math.floor(side1 / 3) === tr) targets.push(side1)
    if (side2 >= 0 && side2 < 9 && Math.floor(side2 / 3) === tr) targets.push(side2)
  } else if (dc === 0) {
    // Вертикальный выстрел
    const side1 = (tr - 1) * 3 + tc
    const side2 = (tr + 1) * 3 + tc
    if (side1 >= 0 && side1 < 9) targets.push(side1)
    if (side2 >= 0 && side2 < 9) targets.push(side2)
  }

  return [...new Set(targets)]
}

// Получить все клетки в линии от игрока до края поля
const getLineTargets = (playerIndex, targetIndex) => {
  const pr = Math.floor(playerIndex / 3), pc = playerIndex % 3
  const tr = Math.floor(targetIndex / 3), tc = targetIndex % 3

  const targets = []

  if (pr === tr) {
    // Горизонталь — вся строка
    for (let c = 0; c < 3; c++) {
      targets.push(pr * 3 + c)
    }
  } else if (pc === tc) {
    // Вертикаль — весь столбец
    for (let r = 0; r < 3; r++) {
      targets.push(r * 3 + pc)
    }
  } else {
    // Диагональ не простреливается линией
    targets.push(targetIndex)
  }

  return targets
}

// Нанести урон по области
const dealAoEDamage = (targets, weapon, sourceName) => {
  const [min, max] = weapon.dmg

  for (const ti of targets) {
    const targetCard = field.value[ti]
    if (targetCard.enemyData && targetCard.enemyData.hp > 0) {
      const dmg = min + Math.floor(Math.random() * (max - min + 1))
      targetCard.enemyData.hp -= dmg
      addLog(`${sourceName}: -${dmg} HP врагу на клетке ${ti + 1}`)

      if (targetCard.enemyData.hp <= 0) {
        addLog(`Враг на клетке ${ti + 1} убит!`)
        removeTopCard(targetCard)
      }
    }
  }
}

const canEnemyMoveTo = (targetCard, targetIndex) => {
  if (!targetCard) return false
  if (targetIndex < 0 || targetIndex > 8) return false
  const pi = field.value.findIndex(c => c.isPlayer)
  if (targetIndex === pi) return false
  if (targetCard.isPlayer) return false
  if (targetCard.enemyData && targetCard.enemyData.hp > 0) return false
  return true
}

const moveEnemy = (sourceCard, fromIndex, toIndex) => {
  const targetCard = field.value[toIndex]

  targetCard.enemyData = { ...sourceCard.enemyData }
  targetCard.topCard = { ...sourceCard.topCard }
  targetCard.revealed = true
  targetCard.isEmpty = false

  sourceCard.enemyData = null
  sourceCard.topCard = null

  if (sourceCard.stack && sourceCard.stack.length > 0) {
    sourceCard.revealed = false
    sourceCard.isEmpty = false
    sourceCard.topCard = null
    sourceCard.enemyData = null
  } else {
    sourceCard.isEmpty = true
    sourceCard.revealed = false
  }
}

const endTurn = () => {
  turn.value++

  // Сбрасываем stunned у врагов, которые не были оглушены в этом ходу
  field.value.forEach(card => {
    if (card.enemyData && card.enemyData.stunned && !card.enemyData._skipThisTurn) {
      card.enemyData.stunned = false
    }
  })

  const enemies = []
  field.value.forEach((card, i) => {
    if (card.enemyData && card.enemyData.hp > 0) {
      enemies.push({ card, index: i })
    }
  })

  for (const { card, index } of enemies) {
    if (!card.enemyData || card.enemyData.hp <= 0) continue

    // Пропускаем оглушённых (метка поставлена при ударе монтировкой)
    if (card.enemyData._skipThisTurn) {
      card.enemyData._skipThisTurn = false
      card.enemyData.stunned = false
      addLog(`${card.topCard?.title || 'Враг'} оглушён и пропускает ход`)
      continue
    }

    const ed = card.enemyData
    const isRanged = ed.ranged === true
    const enemyName = card.topCard?.title || 'Враг'

    if (isRanged) {
      if (isAdjacentToPlayer(index) || hasLineOfSight(index)) {
        const [min, max] = ed.dmg
        const dmg = min + Math.floor(Math.random() * (max - min + 1))
        hp.value -= dmg
        addLog(`${enemyName} стреляет: -${dmg} HP`)
      } else {
        const toward = getNeighborsToPlayer(index)
        for (const ti of toward) {
          if (canEnemyMoveTo(field.value[ti], ti)) {
            moveEnemy(card, index, ti)
            break
          }
        }
      }
    } else {
      if (isAdjacentToPlayer(index) && ed.aggro) {
        const [min, max] = ed.dmg
        const dmg = min + Math.floor(Math.random() * (max - min + 1))
        hp.value -= dmg
        addLog(`${enemyName} атакует: -${dmg} HP`)
      } else if (ed.aggro && !isAdjacentToPlayer(index)) {
        const toward = getNeighborsToPlayer(index)
        for (const ti of toward) {
          if (canEnemyMoveTo(field.value[ti], ti)) {
            moveEnemy(card, index, ti)
            break
          }
        }
      }
    }
  }

  // Финальный сброс всех флагов
  field.value.forEach(card => {
    if (card.enemyData) {
      card.enemyData._skipThisTurn = false
    }
  })
}

const restartGame = () => {
  hp.value = GAME_CONFIG.START_HP
  energy.value = GAME_CONFIG.START_ENERGY
  turn.value = 1
  hand.value = []
  weapon.value = null
  logs.value = []
  isDead.value = false
  collectedCards.value = 0

  stacks = buildStacks(DECK)
  field.value = createField(stacks)

  addLog('Новая игра')
}
</script>

<style scoped>
.page-dark {
  background: #121212;
  display: flex;
  justify-content: center;
  align-items: stretch;
  padding: 0;
  margin: 0;
}

.game-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 500px;
  height: 100vh;
  padding: 8px 12px;
  box-sizing: border-box;
  gap: 6px;
}

.top-bar {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-shrink: 0;
}

.stat-badge {
  font-size: 0.7rem;
  padding: 4px 8px;
  background: #1e1e1e;
  color: #ccc;
}

.hand-row {
  display: flex;
  gap: 4px;
  justify-content: center;
  flex-wrap: wrap;
  flex-shrink: 0;
  min-height: 28px;
}

.hand-empty {
  color: #555;
  font-size: 0.7rem;
}

.field-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.log-area {
  flex-shrink: 0;
  max-height: 90px;
  overflow-y: auto;
}

.log-line {
  font-size: 0.65rem;
  color: #777;
  padding: 1px 0;
}

.log-dim {
  color: #444;
}

.death-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  min-width: 280px;
}

.death-icon {
  font-size: 3rem;
  margin-bottom: 8px;
}

.death-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: #ccc;
  margin-bottom: 4px;
}

.death-sub {
  font-size: 0.8rem;
  color: #666;
  line-height: 1.6;
}

.equipped-chip {
  border: 1px solid #f44336;
  box-shadow: 0 0 6px rgba(244, 67, 54, 0.3);
}

.hand-divider {
  color: #444;
  font-size: 0.8rem;
  margin: 0 2px;
  user-select: none;
}
</style>
