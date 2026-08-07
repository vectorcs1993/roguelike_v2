<!-- src/pages/IndexPage.vue -->

<template>
  <q-page class="q-pa-xs q-pa-sm-sm q-pa-md-md text-h6 game-page"
    style="background: #121212; height: 100vh; height: 100dvh; display: flex; flex-direction: column;" ref="pageRef">

    <div class="row q-col-gutter-xs q-col-gutter-sm-md" style="flex: 1; min-height: 0;">

      <!-- Canvas -->
      <div class="col-12 col-md-8 col-lg-8 canvas-col" style="display: flex; flex-direction: column; min-height: 0;">
        <q-card flat square bordered dark class="full-height" style="display: flex; flex-direction: column; min-height: 0;">
          <q-card-section class="bg-grey-9 q-pa-xs q-pa-sm-sm">
            <div class="text-subtitle1 text-sm-h6 flex items-center flex-wrap" style="gap: 8px;">
              <q-icon name="fmd_good" class="q-mr-xs" />
              <div class="text-subtitle1 text-sm-h6 ellipsis">
                Этаж: [{{ locationNumber }}] [{{ locationName }}] Ход: {{ turnCount }}
              </div>
              <q-space />
              <q-btn-group class="q-mt-xs q-mt-sm-0">
                <q-btn label="Обновить" icon="refresh" @click="regenerateLevel" dark dense />
                <q-btn label="Карта" icon="map" @click="revealFullMap" dark dense />
              </q-btn-group>
            </div>
          </q-card-section>
          <q-card-section class="q-pa-none bg-dark" style="flex: 1; display: flex; min-height: 0;">
            <canvas ref="canvasRef" class="full-width" style="background: #0a0a0a; border-radius: 4px; width: 100%; height: 100%; outline: none;"
              @click="onCanvasClick" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @touchstart.prevent="onTouchStart"
              @touchmove.prevent="onTouchMove" @touchend.prevent="onTouchEnd">
            </canvas>
          </q-card-section>
          <div class="absolute-bottom full-width q-pa-xs q-pa-sm-sm">
            <q-card-section flat bordered class="row bg-grey-9 justify-center q-pa-xs q-pa-sm-sm">
              <div class="row q-gutter-xs q-gutter-sm-sm">
                Здесь инфа о предмете (тултип)
              </div>
            </q-card-section>
          </div>
        </q-card>
      </div>

      <!-- Правая панель -->
      <div class="col-12 col-md-4 col-lg-4 right-panel" style="display: flex; flex-direction: column; gap: 8px; min-height: 0;">

        <!-- Игрок - Управление -->
        <q-card v-if="playerStats" flat square bordered dark class="player-card" style="display: flex; flex-direction: column; min-height: 0;">
          <q-card-section class="bg-grey-9 q-pa-xs q-pa-sm-sm">
            <div class="text-subtitle1 text-sm-h6 flex items-center">
              <q-icon name="gamepad" class="q-mr-xs" />
              Управление
            </div>
          </q-card-section>
          <q-separator dark />
          <q-card-section class="q-pa-sm">
            <!-- Сетка перемещения -->
            <div class="row" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; max-width: 200px; margin: 0 auto;">
              <q-btn label="↖" @click="move(-1, -1)" class="full-width" dense />
              <q-btn label="⬆" @click="move(0, -1)" class="full-width" dense />
              <q-btn label="↗" @click="move(1, -1)" class="full-width" dense />
              <q-btn label="⬅" @click="move(-1, 0)" class="full-width" dense />
              <q-btn label="🖱" @click="interact" class="full-width" dense />
              <q-btn label="➡" @click="move(1, 0)" class="full-width" dense />
              <q-btn label="↙" @click="move(-1, 1)" class="full-width" dense />
              <q-btn label="⬇" @click="move(0, 1)" class="full-width" dense />
              <q-btn label="↘" @click="move(1, 1)" class="full-width" dense />
            </div>

            <!-- Действия -->
            <div class="row q-gutter-xs q-mt-sm">
              <q-btn label="Ждать" @click="waitTurn" class="col" dense />
              <q-btn label="Атака" @click="attack" class="col" dense />
              <q-btn label="Поднять" @click="pickup" class="col" dense />
            </div>
          </q-card-section>
        </q-card>

        <!-- Игрок - Статы -->
        <q-card v-if="playerStats" flat square bordered dark class="player-card" style="display: flex; flex-direction: column; min-height: 0;">
          <q-card-section class="bg-grey-9 q-pa-xs q-pa-sm-sm">
            <div class="text-subtitle1 text-sm-h6 flex items-center">
              <q-icon name="person" class="q-mr-xs" />
              {{ playerStats.name }}
            </div>
          </q-card-section>
          <q-separator dark />
          <q-scroll-area class="player-body" dark style="width: 100%;">
            <div class="row q-pa-xs q-pa-sm-sm">
              <div class="col-12 col-sm-6 col-md-6 q-pa-xs q-pa-sm-sm q-gutter-xs">
                <div class="row justify-between q-py-xs">
                  <span>Здоровье</span>
                  <span>{{ playerStats.hp }}/{{ playerStats.maxHp }}</span>
                </div>
                <div class="row justify-between q-py-xs">
                  <span>Энергия</span>
                  <span>{{ playerStats.energy }}/{{ playerStats.maxEnergy }}</span>
                </div>
                <div class="row justify-between q-py-xs">
                  <span>Голод</span>
                  <span>{{ playerStats.hunger }}/{{ playerStats.maxHunger }}</span>
                </div>
                <div class="row justify-between q-py-xs">
                  <span class="text-grey-5">Броня</span>
                  <span>{{ playerStats.armor }} ({{ playerStats.armorType }})</span>
                </div>
                <div class="row justify-between q-py-xs">
                  <span class="text-grey-5">Урон</span>
                  <span>{{ playerStats.damageMin }}-{{ playerStats.damageMax }} ({{ playerStats.damageType }})</span>
                </div>
                <div class="row justify-between q-py-xs">
                  <span class="text-grey-5">Точность</span>
                  <span>{{ Math.round(playerStats.accuracy * 100) }}%</span>
                </div>
                <div class="row justify-between q-py-xs">
                  <span class="text-grey-5">Дальность</span>
                  <span>{{ playerStats.attackRange }}</span>
                </div>
                <div class="row justify-between q-py-xs">
                  <span class="text-grey-5">Скорость</span>
                  <span>{{ playerStats.speed }}</span>
                </div>
                <div class="row justify-between q-py-xs">
                  <span class="text-grey-5">Инициатива</span>
                  <span>{{ playerStats.initiative }}</span>
                </div>
                <div class="row justify-between q-py-xs">
                  <span class="text-grey-5">Позиция</span>
                  <span>{{ playerStats.x }}, {{ playerStats.y }}</span>
                </div>
                <div class="row justify-between q-py-xs">
                  <span class="text-grey-5">Вес</span>
                  <span>{{ playerStats.totalWeight.toFixed(1) }} / {{ playerStats.maxCarryWeight }} кг</span>
                </div>
              </div>
            </div>
          </q-scroll-area>
        </q-card>

        <!-- Инвентарь -->
        <q-card v-if="playerStats" flat square bordered dark class="inventory-card" style="display: flex; flex-direction: column; min-height: 0;">
          <q-card-section class="bg-grey-9 q-pa-xs q-pa-sm-sm">
            <div class="text-subtitle1 text-sm-h6 flex items-center">
              <q-icon name="inventory" class="q-mr-xs" />
              Инвентарь
              <q-space />
              <q-btn dense @click="dropAllItems" label="Выбросить всё" />
            </div>
          </q-card-section>
          <q-separator dark />
          <q-card-section class="inventory-section" style="overflow-y: auto;" dark>
            <q-scroll-area v-if="inventoryItems.length > 0" dark style="width: 100%; height: 100%;">
              <q-item v-for="item in inventoryItems" :key="item.id" clickable dark>
                <q-item-section avatar>
                  <span :style="{ backgroundColor: item.bgColor, color: item.color }">
                    {{ item.char }}
                  </span>
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ item.name }}
                    <span v-if="item.count > 1"> ({{ item.count }})</span>
                  </q-item-label>
                  <q-item-label caption class="text-grey-6">Тип: {{ item.type }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <div class="row q-gutter-xs">
                    <q-btn v-if="item.usable" dense icon="play_arrow" label="Использовать" @click="useItem(item.id)" />
                    <q-btn dense icon="delete" label="Выбросить" @click="dropItem(item.id)" />
                  </div>
                </q-item-section>
              </q-item>
            </q-scroll-area>
            <div v-else class="text-center text-grey-5 q-py-md">Инвентарь пуст</div>
          </q-card-section>
        </q-card>

        <!-- Сущности -->
        <q-card flat square bordered dark class="entities-card" style="display: flex; flex-direction: column; min-height: 0;">
          <q-card-section class="bg-grey-9 q-pa-xs q-pa-sm-sm">
            <div class="text-subtitle1 text-sm-h6 flex items-center">
              <q-icon name="groups" class="q-mr-xs" />
              Сущности
              <q-badge color="grey-7" :label="entitiesList.length" class="q-ml-xs" />
            </div>
          </q-card-section>
          <q-separator dark />
          <q-card-section class="entities-section" style="overflow-y: auto;" dark>
            <q-scroll-area v-if="entitiesList.length > 0" dark style="width: 100%; height: 100%;">
              <q-item v-for="(ent) in entitiesList" :key="ent.id" :active="ent.id === selectedEntityId" clickable dark>
                <q-item-section avatar dark>
                  <q-chip :style="{ backgroundColor: ent.bgColor, color: ent.color }">
                    {{ ent.char }}
                  </q-chip>
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ ent.name }}
                    {{ ent.hp }}/{{ ent.maxHp }}
                    <q-badge :color="ent.isEnemy ? 'red' : 'grey'" flat>
                      {{ ent.isEnemy ? 'Враг' : ent.isEnvironment ? 'Окр.' : 'Предм.' }}
                    </q-badge>
                  </q-item-label>
                </q-item-section>
                <div class="row q-gutter-sm">
                  <q-btn label="Найти" dense @click.stop="highlightOnCharacter(ent.id)" dark />
                </div>
              </q-item>
            </q-scroll-area>
            <div v-else class="text-center text-grey-5 q-py-md">Нет сущностей</div>
          </q-card-section>
        </q-card>

        <!-- Лог игры -->
        <q-card flat square bordered dark class="log-card" style="display: flex; flex-direction: column; min-height: 0;">
          <q-card-section class="bg-grey-9 q-pa-xs q-pa-sm-sm">
            <div class="text-subtitle1 text-sm-h6 flex items-center">
              <q-icon name="terminal" class="q-mr-xs" />
              Лог игры
              <q-badge color="grey-7" :label="consoleLogs.length" class="q-ml-xs" />
              <q-space />
              <q-btn flat dense icon="delete_sweep" @click="clearConsole" />
            </div>
          </q-card-section>
          <q-separator dark />
          <q-scroll-area ref="consoleScrollAreaRef" dark style="flex: 1; background: #1e1e1e;">
            <div class="q-pa-sm">
              <div v-for="(log, idx) in consoleLogs" :key="idx" class="q-py-xs" :class="getMessageColorClass(log)">
                <span class="text-grey-5">[{{ log.time }}]</span> {{ log.text }}
              </div>
              <div v-if="consoleLogs.length === 0" class="text-grey-5 text-center q-py-lg">Ничего...</div>
            </div>
          </q-scroll-area>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import GameLoop from 'src/game/GameLoop.js'
import { ContentLoader, logger, LOG_LEVEL, isItemUsable, LOG_MODULES } from 'src/game/index.js'

import PositionComponent from 'src/engine/components/PositionComponent.js'
import RenderComponent from 'src/engine/components/RenderComponent.js'
import HealthComponent from 'src/engine/components/HealthComponent.js'
import HungerComponent from 'src/engine/components/HungerComponent.js'
import EnergyComponent from 'src/engine/components/EnergyComponent.js'
import PlayerComponent from 'src/engine/components/PlayerComponent.js'
import AIComponent from 'src/engine/components/AIComponent.js'
import InventoryComponent from 'src/engine/components/InventoryComponent.js'
import EnvironmentComponent from 'src/engine/components/EnvironmentComponent.js'
import CombatComponent from 'src/engine/components/CombatComponent.js'
import MovementComponent from 'src/engine/components/MovementComponent.js'


const canvasRef = ref(null)
const consoleScrollAreaRef = ref(null)
let game = null
let resizeTimeout = null
let updateInterval = null

const consoleLogs = ref([])
const entitiesList = ref([])
const inventoryItems = ref([])
const locationName = ref('')
const locationNumber = ref(1)
const turnCount = ref(0)
const selectedEntityId = ref(null)
const playerStats = ref(null)


function onGlobalKeyDown(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return
  if (event.target.tagName === 'BUTTON') return
  if (game?.onKeyDown) game.onKeyDown(event)
}

function onGlobalKeyUp(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return
  if (event.target.tagName === 'BUTTON') return
  if (game?.onKeyUp) game.onKeyUp(event)
}

function addConsoleMessage(text, type = 'info') {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  consoleLogs.value.push({ time, text: String(text), type })
  if (consoleLogs.value.length > 500) consoleLogs.value.shift()
  nextTick(() => {
    if (consoleScrollAreaRef.value) {
      const target = consoleScrollAreaRef.value.getScrollTarget?.()
      if (target) target.scrollTop = target.scrollHeight
    }
  })
}

function clearConsole() { consoleLogs.value = [] }

function getMessageColorClass(log) {
  switch (log.type) {
    case 'error': return 'text-red'
    case 'warning': return 'text-orange'
    case 'success': return 'text-green'
    default: return 'text-white'
  }
}

function loggerCallback(level, module, message) {
  let type = 'info'
  if (level === LOG_LEVEL.ERROR) type = 'error'
  else if (level === LOG_LEVEL.WARN) type = 'warning'
  else if (level === LOG_LEVEL.INFO && (module === 'combat' || module === 'turn')) type = 'success'
  addConsoleMessage(message, type)
}
logger.addCallback(loggerCallback)
onUnmounted(() => logger.removeCallback(loggerCallback))

function updateEntitiesList() {
  if (!game?.currentLocation) {
    entitiesList.value = []
    inventoryItems.value = []
    playerStats.value = null
    return
  }

  const engine = game.currentLocation.engine
  locationName.value = game.currentLocation.name
  locationNumber.value = (game.currentLocation.levelIndex || 0) + 1
  turnCount.value = game.turnCount ?? 0

  const entities = engine.getEntitiesWithComponents([
    PositionComponent,
    RenderComponent,
    HealthComponent
  ])

  const list = []
  let playerFound = null

  for (const entity of entities) {
    const render = entity.getComponent(RenderComponent)
    const health = entity.getComponent(HealthComponent)
    const player = entity.getComponent(PlayerComponent)
    const ai = entity.getComponent(AIComponent)
    const env = entity.getComponent(EnvironmentComponent)

    if (!render || !health) continue

    if (player) {
      const combat = entity.getComponent(CombatComponent)
      const movement = entity.getComponent(MovementComponent)
      const position = entity.getComponent(PositionComponent)
      const playerConfig = ContentLoader.getPlayer()

      const energyComp = entity.getComponent(EnergyComponent)
      const maxEnergy = energyComp ? energyComp.maxEnergy : 100
      const energy = energyComp ? energyComp.energy : maxEnergy

      const hungerComp = entity.getComponent(HungerComponent)
      const hunger = hungerComp ? hungerComp.hunger : 0
      const maxHunger = hungerComp ? hungerComp.maxHunger : 100

      const inventory = entity.getComponent(InventoryComponent)
      const totalWeight = inventory ? inventory.totalWeight : 0
      const maxCarryWeight = inventory ? inventory.maxWeight : 50

      playerFound = {
        id: entity.id,
        name: playerConfig.name || 'Игрок',
        char: render.char,
        hp: health.hp,
        maxHp: health.maxHp,
        hpPercent: health.hpPercent,
        energy: energy,
        maxEnergy: maxEnergy,
        energyPercent: maxEnergy > 0 ? energy / maxEnergy : 0,
        hunger: hunger,
        maxHunger: maxHunger,
        hungerPercent: maxHunger > 0 ? hunger / maxHunger : 0,
        armor: health.armor,
        armorType: health.armorType,
        damageMin: combat?.damageMin ?? 1,
        damageMax: combat?.damageMax ?? 3,
        damageType: combat?.damageType || 'physical',
        accuracy: combat?.accuracy ?? 0.75,
        attackRange: combat?.attackRange ?? 1,
        initiative: combat?.initiative ?? 5,
        speed: movement?.speed ?? 12,
        totalWeight: totalWeight,
        maxCarryWeight: maxCarryWeight,
        x: position?.tileX ?? 0,
        y: position?.tileY ?? 0
      }
      continue
    }

    if (!render.visible) continue

    let color = '#666666'
    let bgColor = '#666666'
    let teamName = 'Нейтральный'
    let displayName

    if (ai) {
      color = entity.enemyData?.color || '#ff4444'
      bgColor = entity.enemyData?.bgColor || '#2a0a0a'
      teamName = 'Враг'
      if (entity.enemyData?.name) {
        displayName = entity.enemyData.name
      } else if (entity.enemyType) {
        const enemyData = ContentLoader.getEnemy(entity.enemyType)
        displayName = enemyData?.name || entity.tag || 'Враг'
      } else {
        displayName = entity.tag || 'Враг'
      }
    } else if (env) {
      bgColor = '#888888'
      teamName = 'Окружение'
      displayName = env.name || entity.tag || 'Объект'
    } else {
      if (entity.itemData?.name) {
        displayName = entity.itemData.name
      } else if (entity.itemType) {
        const itemData = ContentLoader.getItem(entity.itemType)
        displayName = itemData?.name || entity.tag || 'Предмет'
      } else {
        displayName = entity.tag || 'Сущность'
      }
    }

    list.push({
      id: entity.id,
      name: displayName,
      char: render.char,
      bgColor: bgColor,
      color: color,
      teamName: teamName,
      hp: health.hp,
      maxHp: health.maxHp,
      isPlayer: false,
      isEnemy: !!ai,
      isEnvironment: !!env,
      isItem: entity.tag === 'item'
    })
  }

  list.sort((a, b) => {
    if (a.isEnemy && !b.isEnemy) return -1
    if (!a.isEnemy && b.isEnemy) return 1
    return 0
  })

  entitiesList.value = list
  playerStats.value = playerFound

  const selected = game.selectedEntity
  if (selected) {
    selectedEntityId.value = selected.id
    const inv = selected.getComponent(InventoryComponent)
    if (inv) {
      const displayItems = inv.getDisplayItems()
      inventoryItems.value = displayItems.map((item) => ({
        id: item.id,
        name: item.name || 'Предмет',
        char: item.char || '?',
        color: item.color || '#ffffff',
        bgColor: item.bgColor || 'black',
        type: item.type || 'generic',
        count: item.count || 1,
        usable: isItemUsable(item)
      }))
    } else {
      inventoryItems.value = []
    }
  } else {
    selectedEntityId.value = null
    inventoryItems.value = []
  }
}

function move(dx, dy) { game?.moveCharacter(dx, dy) }

function waitTurn() {
  const result = game?.wait()
  if (result) addConsoleMessage('Ход пропущен', 'info')
}

function attack() {
  const result = game?.attackNearestEnemy()
  if (result) addConsoleMessage('Атака выполнена!', 'success')
  else logger.info(LOG_MODULES.COMBAT, 'Нет цели для атаки')
}

function interact() { game?.interact() }
function pickup() { game?.pickupItem() }

function useItem(itemId) {
  const result = game?.useItem(itemId)
  if (result) addConsoleMessage('Предмет использован', 'success')
  else addConsoleMessage('Не удалось использовать предмет', 'warning')
}

function dropItem(itemId) {
  const result = game?.dropItem(itemId)
  if (result) addConsoleMessage('Предмет выброшен', 'success')
  else addConsoleMessage('Не удалось выбросить предмет', 'warning')
}

function dropAllItems() {
  const result = game?.dropAllItems()
  if (result) addConsoleMessage('Все предметы выброшены', 'success')
  else addConsoleMessage('Не удалось выбросить предметы', 'warning')
}

async function initGame() {
  if (!canvasRef.value) return

  addConsoleMessage('Загрузка Core контента...', 'info')
  const coreLoaded = await ContentLoader.loadCore()

  if (coreLoaded) {
    addConsoleMessage('Core контент загружен успешно!', 'success')
    const enemies = Object.keys(ContentLoader.getAllEnemies()).length
    const items = Object.keys(ContentLoader.getAllItems()).length
    const biomes = Object.keys(ContentLoader.getAllBiomes()).length
    addConsoleMessage(`Статистика: ${enemies} врагов, ${items} предметов, ${biomes} биомов`, 'info')
  } else {
    addConsoleMessage('Core контент не загружен, используется встроенный', 'warning')
  }

  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(rect.width * dpr, 100)
  canvas.height = Math.max(rect.height * dpr, 100)
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`

  try {
    game = new GameLoop(canvas)
    game.initRenderer(rect.width, rect.height, dpr)
    game.start()
    addConsoleMessage('Игра запущена', 'success')
    updateEntitiesList()

    if (updateInterval) clearInterval(updateInterval)
    updateInterval = setInterval(updateEntitiesList, 100)

    document.addEventListener('keydown', onGlobalKeyDown)
    document.addEventListener('keyup', onGlobalKeyUp)

    window.gameInstance = game
    window.ContentLoader = ContentLoader

  } catch (e) {
    addConsoleMessage(`Ошибка: ${e.message}`, 'error')
    console.error(e)
  }
}

function regenerateLevel() {
  if (game?.reloadLocation) {
    game.reloadLocation()
    addConsoleMessage('Уровень обновлён', 'info')
  }
}

function revealFullMap() {
  if (!game?.currentLocation) return
  game.currentLocation.revealAll()
  addConsoleMessage('Карта открыта', 'success')
}

function highlightOnCharacter(entityId) {
  game?.highlightOnCharacter(entityId)
}

function onCanvasClick(event) { game?.onClick?.(event) }
function onMouseMove(event) { game?.onMouseMove?.(event) }
function onMouseLeave(event) { game?.onMouseLeave?.(event) }
function onTouchStart(event) { game?.onTouchStart?.(event) }
function onTouchMove(event) { game?.onTouchMove?.(event) }
function onTouchEnd(event) { game?.onTouchEnd?.(event) }

let resizeObserver = null

function resizeCanvas() {
  if (!game || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const w = Math.max(rect.width, 50)
  const h = Math.max(rect.height, 50)
  canvasRef.value.width = w * dpr
  canvasRef.value.height = h * dpr
  canvasRef.value.style.width = `${w}px`
  canvasRef.value.style.height = `${h}px`
  game.resize?.(w, h, dpr)
}

onMounted(() => {
  nextTick(initGame)

  if (canvasRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(resizeCanvas, 100)
    })
    resizeObserver.observe(canvasRef.value)
  }

  window.addEventListener('resize', () => {
    if (resizeTimeout) clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(resizeCanvas, 100)
  })
})

onUnmounted(() => {
  game?.stop?.()
  if (updateInterval) clearInterval(updateInterval)
  if (resizeObserver) resizeObserver.disconnect()
  document.removeEventListener('keydown', onGlobalKeyDown)
  document.removeEventListener('keyup', onGlobalKeyUp)
})
</script>

<style scoped>
canvas {
  display: block;
  border: 1px solid #333;
  outline: none;
}

:deep(.q-page) {
  outline: none;
}

@media (max-width: 1023px) {
  .game-page {
    overflow-y: auto;
    overflow-x: hidden;
  }

  .game-page :deep(.canvas-col) {
    height: 60vh;
    min-height: 320px;
    flex-shrink: 0;
  }

  .inventory-section {
    height: 120px;
  }

  .entities-section {
    height: 160px;
  }

  .log-card {
    flex: 0 0 auto;
    height: 220px;
  }

  .player-card {
    flex: 0 0 auto;
  }

  .player-body {
    flex: 0 0 auto;
    height: 320px;
  }
}

@media (max-width: 599px) {
  .game-page :deep(.canvas-col) {
    height: 55vh;
    min-height: 280px;
  }
}

@media (min-width: 1024px) {
  .game-page {
    overflow: hidden;
  }

  .game-page :deep(.right-panel) {
    height: 100%;
  }

  .player-card {
    flex: 2 1 0;
  }

  .inventory-card {
    flex: 2 1 0;
  }

  .entities-card {
    flex: 2 1 0;
  }

  .log-card {
    flex: 3 1 0;
  }

  .inventory-section,
  .entities-section {
    flex: 1 1 0;
    min-height: 0;
  }

  .player-body {
    flex: 1 1 0;
    min-height: 0;
  }
}
</style>
