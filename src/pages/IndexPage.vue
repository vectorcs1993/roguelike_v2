<!-- src/pages/IndexPage.vue -->

<template>
  <q-page class="q-pa-md" style="background: #121212; height: 100vh; display: flex; flex-direction: column;" ref="pageRef">

    <div class="row q-col-gutter-md" style="flex: 1; min-height: 0;">
      <!-- Canvas -->
      <div class="col-8" style="display: flex; flex-direction: column;">
        <q-card flat square bordered dark class="full-height" style="display: flex; flex-direction: column;">
          <q-card-section class="bg-grey-9">
            <div class="text-h6 flex items-center">
              <q-icon name="fmd_good" class="q-mr-sm" />
              <div class="text-h6">Локация: {{ locationName }}</div>
              <q-space />
              <q-btn-group>
                <q-btn label="Обновить" icon="refresh" @click="regenerateLevel" dark />
                <q-btn label="Открыть карту" icon="map" @click="revealFullMap" dark />
              </q-btn-group>
              <q-btn-group class="q-ml-sm">
                <q-btn label="Загрузить контент" icon="file_upload" @click="loadContent" dark />
                <q-btn label="Валидация" icon="check_circle" @click="validateContent" dark />
                <q-btn label="Статистика" icon="info" @click="showEntityStats" dark />
              </q-btn-group>
            </div>
          </q-card-section>
          <q-card-section class="q-pa-none bg-dark" style="flex: 1; display: flex;">
            <canvas ref="canvasRef" class="full-width" style="background: #0a0a0a; border-radius: 4px; width: 100%; height: 100%; outline: none;"
              @click="onCanvasClick" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @touchstart.prevent="onTouchStart"
              @touchmove.prevent="onTouchMove" @touchend.prevent="onTouchEnd">
            </canvas>
          </q-card-section>
          <div class="absolute-bottom full-width q-pa-sm">
            <q-card-section flat bordered class="row bg-grey-9 justify-center">
              <div class="row q-gutter-sm">
                <q-btn label="⬆" @click="move(0, -1)" />
                <q-btn label="⬇" @click="move(0, 1)" />
                <q-btn label="⬅" @click="move(-1, 0)" />
                <q-btn label="➡" @click="move(1, 0)" />
                <q-btn label="Атака" @click="attack" />
                <q-btn label="Взаимодействие" @click="interact" />
                <q-btn label="Поднять" @click="pickup" />
              </div>
            </q-card-section>
          </div>
        </q-card>
      </div>

      <!-- Правая панель -->
      <div class="col-4" style="display: flex; flex-direction: column; gap: 16px; min-height: 0;">
        <!-- Игрок -->
        <q-card flat square bordered dark style="flex-shrink: 0;">
          <q-card-section class="bg-grey-9">
            <div class="text-h6 flex items-center">
              <q-icon name="person" class="q-mr-sm" />
              Игрок
              <q-badge color="blue" :label="playerStats?.name || '—'" class="q-ml-sm" />
            </div>
          </q-card-section>
          <q-separator dark />
          <q-card-section dark>
            <template v-if="playerStats">
              <!-- Здоровье -->
              <div class="q-mb-sm">
                <div class="row justify-between text-caption text-grey-5">
                  <span>❤️ Здоровье</span>
                  <span>{{ playerStats.hp }}/{{ playerStats.maxHp }}</span>
                </div>
                <q-linear-progress :value="playerStats.hpPercent" color="red" track-color="grey-8" size="12px" rounded />
              </div>

              <!-- Энергия -->
              <div class="q-mb-sm">
                <div class="row justify-between text-caption text-grey-5">
                  <span>⚡ Энергия</span>
                  <span>{{ playerStats.energy }}/{{ playerStats.maxEnergy }}</span>
                </div>
                <q-linear-progress :value="playerStats.energyPercent" color="amber" track-color="grey-8" size="12px" rounded />
              </div>

              <!-- Броня -->
              <div class="row justify-between text-caption q-mb-xs">
                <span class="text-grey-5">🛡️ Броня</span>
                <span>{{ playerStats.armor }} ({{ playerStats.armorType }})</span>
              </div>

              <!-- Атака -->
              <div class="row justify-between text-caption q-mb-xs">
                <span class="text-grey-5">⚔️ Урон</span>
                <span>{{ playerStats.damageMin }}-{{ playerStats.damageMax }} ({{ playerStats.damageType }})</span>
              </div>

              <!-- Точность -->
              <div class="row justify-between text-caption q-mb-xs">
                <span class="text-grey-5">🎯 Точность</span>
                <span>{{ Math.round(playerStats.accuracy * 100) }}%</span>
              </div>

              <!-- Дальность -->
              <div class="row justify-between text-caption q-mb-xs">
                <span class="text-grey-5">📏 Дальность</span>
                <span>{{ playerStats.attackRange }}</span>
              </div>

              <!-- Скорость -->
              <div class="row justify-between text-caption q-mb-xs">
                <span class="text-grey-5">⚡ Скорость</span>
                <span>{{ playerStats.speed }}</span>
              </div>

              <!-- Инициатива -->
              <div class="row justify-between text-caption q-mb-xs">
                <span class="text-grey-5">🔄 Инициатива</span>
                <span>{{ playerStats.initiative }}</span>
              </div>

              <!-- Позиция -->
              <div class="row justify-between text-caption q-mb-xs">
                <span class="text-grey-5">📍 Позиция</span>
                <span>{{ playerStats.x }}, {{ playerStats.y }}</span>
              </div>
            </template>
            <div v-else class="text-center text-grey-5 q-py-md">Игрок не найден</div>
          </q-card-section>
        </q-card>

        <!-- Сущности -->
        <q-card flat square bordered dark style="flex-shrink: 0;">
          <q-card-section class="bg-grey-9">
            <div class="text-h6 flex items-center">
              <q-icon name="groups" class="q-mr-sm" />
              Сущности
              <q-badge color="grey-7" :label="entitiesList.length" class="q-ml-sm" />
            </div>
          </q-card-section>
          <q-separator dark />
          <q-card-section style="height: 200px; overflow-y: auto;" dark>
            <q-scroll-area v-if="entitiesList.length > 0" dark style="width: 100%; height: 100%;">
              <q-item v-for="(ent) in entitiesList" :key="ent.id" :active="ent.id === selectedEntityId" clickable dark>
                <q-item-section avatar dark>
                  <q-chip :style="{ backgroundColor: ent.teamColor, color: 'white' }">
                    {{ ent.char }}
                  </q-chip>
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ ent.name }}
                    <q-badge :color="ent.isEnemy ? 'red' : 'grey'" flat>
                      {{ ent.isEnemy ? 'Враг' : ent.isEnvironment ? 'Окр.' : 'Предм.' }}
                    </q-badge>
                  </q-item-label>
                  <q-item-label>❤️ {{ ent.hp }}/{{ ent.maxHp }}</q-item-label>
                </q-item-section>
                <div class="row q-gutter-sm">
                  <q-btn icon="center_focus_strong" label="Центр" dense @click.stop="centerOnCharacter(ent.id)" dark />
                </div>
              </q-item>
            </q-scroll-area>
            <div v-else class="text-center text-grey-5 q-py-md">Нет сущностей</div>
          </q-card-section>
        </q-card>

        <!-- Инвентарь -->
        <q-card flat square bordered dark style="flex-shrink: 0;">
          <q-card-section class="bg-grey-9">
            <div class="text-h6 flex items-center">
              <q-icon name="inventory" class="q-mr-sm" />
              Инвентарь
              <q-badge color="grey-7" :label="totalItems" class="q-ml-sm" />
              <q-space />
              <q-btn flat dense icon="delete_sweep" @click="dropAllItems" label="Выбросить всё" />
            </div>
          </q-card-section>
          <q-separator dark />

          <q-card-section style="height: 150px; overflow-y: auto;" dark>
            <q-scroll-area v-if="inventoryItems.length > 0" dark style="width: 100%; height: 100%;">
              <q-item v-for="item in inventoryItems" :key="item.id" dark>
                <q-item-section avatar>
                  <q-chip :style="{ backgroundColor: item.color, color: 'white' }">
                    {{ item.char }}
                  </q-chip>
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ item.name }}
                    <span v-if="item.count > 1" class="text-grey-6">({{ item.count }})</span>
                  </q-item-label>
                  <q-item-label caption class="text-grey-6">Тип: {{ item.type }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <div class="row q-gutter-xs">
                    <q-btn v-if="item.usable" flat dense color="positive" icon="play_arrow" label="Использовать" @click="useItem(item.id)" />
                    <q-btn flat dense icon="delete" @click="dropItem(item.id)" />
                  </div>
                </q-item-section>
              </q-item>
            </q-scroll-area>
            <div v-else class="text-center text-grey-5 q-py-md">Инвентарь пуст</div>
          </q-card-section>
        </q-card>

        <!-- Лог игры -->
        <q-card flat square bordered dark style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
          <q-card-section class="bg-grey-9">
            <div class="text-h6 flex items-center">
              <q-icon name="terminal" class="q-mr-sm" />
              Лог игры
              <q-badge color="grey-7" :label="consoleLogs.length" class="q-ml-sm" />
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

    <!-- Диалог загрузки контента -->
    <q-dialog v-model="contentDialog" persistent>
      <q-card style="min-width: 500px;">
        <q-card-section>
          <div class="text-h6">Загрузка контента</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="contentUrl" label="URL или путь к JSON" placeholder="https://example.com/content.json или /content/mod.json" filled />
          <q-select v-model="contentType" :options="contentTypeOptions" label="Тип загрузки" filled class="q-mt-sm" />
          <q-file v-model="contentFile" label="Или выберите JSON файл" accept=".json" filled class="q-mt-sm" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Отмена" v-close-popup />
          <q-btn label="Загрузить" color="primary" @click="doLoadContent" :loading="contentLoading" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useQuasar } from 'quasar'
import GameLoop from 'src/game/GameLoop.js'
import { ContentLoader, GameConfig, logger, LOG_LEVEL, isItemUsable } from 'src/game/index.js'

import PositionComponent from 'src/engine/components/PositionComponent.js'
import RenderComponent from 'src/engine/components/RenderComponent.js'
import HealthComponent from 'src/engine/components/HealthComponent.js'
import PlayerComponent from 'src/engine/components/PlayerComponent.js'
import AIComponent from 'src/engine/components/AIComponent.js'
import InventoryComponent from 'src/engine/components/InventoryComponent.js'
import EnvironmentComponent from 'src/engine/components/EnvironmentComponent'
import CombatComponent from 'src/engine/components/CombatComponent.js'
import MovementComponent from 'src/engine/components/MovementComponent.js'

const $q = useQuasar()

const canvasRef = ref(null)
const consoleScrollAreaRef = ref(null)
const pageRef = ref(null)
let game = null
let resizeTimeout = null
let updateInterval = null

const consoleLogs = ref([])
const entitiesList = ref([])
const inventoryItems = ref([])
const locationName = ref('')
const selectedEntityId = ref(null)
const playerStats = ref(null)

// Диалог загрузки контента
const contentDialog = ref(false)
const contentUrl = ref('')
const contentType = ref('json')
const contentFile = ref(null)
const contentLoading = ref(false)
const contentTypeOptions = [
  { label: 'JSON (URL)', value: 'json' },
  { label: 'JSON (Файл)', value: 'file' },
  { label: 'Мод (URL)', value: 'mod' }
]

const totalItems = computed(() => {
  if (!game?.selectedEntity) return 0
  const inv = game.selectedEntity.getComponent(InventoryComponent)
  return inv ? inv.count : 0
})

function onGlobalKeyDown(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return
  if (event.target.tagName === 'BUTTON') return

  if (game?.onKeyDown) {
    game.onKeyDown(event)
  }
}

function onGlobalKeyUp(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return
  if (event.target.tagName === 'BUTTON') return

  if (game?.onKeyUp) {
    game.onKeyUp(event)
  }
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

    // Игрок обрабатывается отдельно в блоке статов
    if (player) {
      const combat = entity.getComponent(CombatComponent)
      const movement = entity.getComponent(MovementComponent)
      const position = entity.getComponent(PositionComponent)
      const playerConfig = GameConfig.getPlayer()

      const maxEnergy = entity.maxEnergy ?? 100
      const energy = entity.energy ?? maxEnergy

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
        armor: health.armor,
        armorType: health.armorType,
        damageMin: combat?.damageMin ?? 1,
        damageMax: combat?.damageMax ?? 3,
        damageType: combat?.damageType || 'physical',
        accuracy: combat?.accuracy ?? 0.75,
        attackRange: combat?.attackRange ?? 1,
        initiative: combat?.initiative ?? 5,
        speed: movement?.speed ?? 12,
        x: position?.tileX ?? 0,
        y: position?.tileY ?? 0
      }
      continue
    }

    // Показываем только сущности, видимые игроку
    if (!render.visible) continue

    let teamColor = '#666666'
    let teamName = 'Нейтральный'
    let displayName

    // Определяем имя
    if (ai) {
      teamColor = '#ff4444'
      teamName = 'Враг'
      // Берем имя из enemyData или из конфига
      if (entity.enemyData?.name) {
        displayName = entity.enemyData.name
      } else if (entity.enemyType) {
        const enemyData = GameConfig.getEnemy(entity.enemyType)
        displayName = enemyData?.name || entity.tag || 'Враг'
      } else {
        displayName = entity.tag || 'Враг'
      }
    } else if (env) {
      // Для окружения (пол, стена, дверь, ящик)
      teamColor = '#888888'
      teamName = 'Окружение'
      displayName = env.name || entity.tag || 'Объект'
    } else {
      // Для предметов
      if (entity.itemData?.name) {
        displayName = entity.itemData.name
      } else if (entity.itemType) {
        const itemData = GameConfig.getItem(entity.itemType)
        displayName = itemData?.name || entity.tag || 'Предмет'
      } else {
        displayName = entity.tag || 'Сущность'
      }
    }

    list.push({
      id: entity.id,
      name: displayName,
      char: render.char,
      teamColor: teamColor,
      teamName: teamName,
      hp: health.hp,
      maxHp: health.maxHp,
      isPlayer: false,
      isEnemy: !!ai,
      isEnvironment: !!env,
      isItem: entity.tag === 'item'
    })
  }

  // Сортируем: сначала враги, потом остальные
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
      inventoryItems.value = displayItems.map(item => ({
        id: item.id,
        name: item.name || 'Предмет',
        char: item.char || '?',
        color: item.color || '#ffffff',
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

function attack() {
  const result = game?.attackNearestEnemy()
  if (result) addConsoleMessage('Атака выполнена!', 'success')
  else addConsoleMessage('Нет цели для атаки', 'warning')
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

  // Загружаем Core контент перед инициализацией игры
  addConsoleMessage('Загрузка Core контента...', 'info')
  const coreLoaded = await ContentLoader.loadCore()

  if (coreLoaded) {
    addConsoleMessage('Core контент загружен успешно!', 'success')
    const enemies = Object.keys(GameConfig.getAllEnemies()).length
    const items = Object.keys(GameConfig.getAllItems()).length
    const biomes = Object.keys(GameConfig.getAllBiomes()).length
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

    // Сохраняем в window для отладки
    window.gameInstance = game
    window.ContentLoader = ContentLoader
    window.GameConfig = GameConfig

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
  if (!game?.currentLocation?.map) return
  const map = game.currentLocation.map
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      const tile = map.getTile(x, y)
      if (tile) tile.visible = tile.explored = true
    }
  }
  addConsoleMessage('Карта открыта', 'success')
}

function centerOnCharacter(entityId) { game?.centerOnCharacter(entityId) }

function showEntityStats() {
  const stats = {
    enemies: Object.keys(GameConfig.getAllEnemies()).length,
    items: Object.keys(GameConfig.getAllItems()).length,
    biomes: Object.keys(GameConfig.getAllBiomes()).length,
    environment: Object.keys(GameConfig.getAllEnvironment()).length,
    mods: ContentLoader.getLoadedMods().length,
    coreLoaded: ContentLoader.isCoreLoaded()
  }

  $q.dialog({
    title: 'Статистика контента',
    message: `
      <div style="font-family: monospace; line-height: 1.8;">
        <div>Врагов: <strong>${stats.enemies}</strong></div>
        <div>Предметов: <strong>${stats.items}</strong></div>
        <div>Биомов: <strong>${stats.biomes}</strong></div>
        <div>Окружение: <strong>${stats.environment}</strong></div>
        <div>Загружено модов: <strong>${stats.mods}</strong></div>
        <div>Core загружен: <strong>${stats.coreLoaded ? '✅' : '❌'}</strong></div>
      </div>
    `,
    html: true
  })
}

// ===== ЗАГРУЗКА КОНТЕНТА =====

function loadContent() {
  contentDialog.value = true
  contentUrl.value = ''
  contentFile.value = null
  contentType.value = 'json'
}

async function doLoadContent() {
  contentLoading.value = true

  try {
    let success = false
    const type = contentType.value

    if (type === 'json' && contentUrl.value) {
      addConsoleMessage(`Загрузка контента из URL: ${contentUrl.value}`, 'info')
      success = await ContentLoader.loadFromURL(contentUrl.value)
    } else if (type === 'file' && contentFile.value) {
      addConsoleMessage(`Загрузка контента из файла: ${contentFile.value.name}`, 'info')
      const text = await contentFile.value.text()
      const data = JSON.parse(text)
      success = ContentLoader.loadFromJSON(data)
    } else if (type === 'mod' && contentUrl.value) {
      addConsoleMessage(`Загрузка мода из: ${contentUrl.value}`, 'info')
      success = await ContentLoader.loadFromModule(contentUrl.value)
    } else {
      addConsoleMessage('Пожалуйста, укажите источник контента', 'warning')
      contentLoading.value = false
      return
    }

    if (success) {
      addConsoleMessage('Контент успешно загружен!', 'success')

      // Проверяем валидацию
      const validation = GameConfig.validate()
      if (validation.errors.length > 0) {
        addConsoleMessage(`Ошибки валидации: ${validation.errors.length}`, 'warning')
        for (const err of validation.errors) {
          addConsoleMessage(`  - ${err}`, 'error')
        }
      }

      // Перезагружаем локацию с обновленным контентом
      if (game) {
        const biomeIds = GameConfig.getBiomeIds()
        const biome = biomeIds[Math.floor(Math.random() * biomeIds.length)]
        game.reloadWithBiome(biome)
        addConsoleMessage(`Локация перезагружена с биомом: ${biome}`, 'info')
      }

      contentDialog.value = false
    } else {
      addConsoleMessage('Не удалось загрузить контент', 'error')
    }
  } catch (error) {
    addConsoleMessage(`Ошибка загрузки: ${error.message}`, 'error')
    console.error(error)
  }

  contentLoading.value = false
}

function validateContent() {
  const result = GameConfig.validate()

  if (result.errors.length === 0 && result.warnings.length === 0) {
    addConsoleMessage('✅ Конфиг валиден! Ошибок и предупреждений нет.', 'success')
    return
  }

  if (result.errors.length > 0) {
    addConsoleMessage(`❌ Найдено ${result.errors.length} ошибок:`, 'error')
    for (const err of result.errors) {
      addConsoleMessage(`  - ${err}`, 'error')
    }
  }

  if (result.warnings.length > 0) {
    addConsoleMessage(`⚠️ Найдено ${result.warnings.length} предупреждений:`, 'warning')
    for (const warn of result.warnings) {
      addConsoleMessage(`  - ${warn}`, 'warning')
    }
  }
}

function onCanvasClick(event) { game?.onClick?.(event) }
function onMouseMove(event) { game?.onMouseMove?.(event) }
function onMouseLeave(event) { game?.onMouseLeave?.(event) }
function onTouchStart(event) { game?.onTouchStart?.(event) }
function onTouchMove(event) { game?.onTouchMove?.(event) }
function onTouchEnd(event) { game?.onTouchEnd?.(event) }

onMounted(() => {
  nextTick(initGame)

  window.addEventListener('resize', () => {
    if (resizeTimeout) clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(() => {
      if (game && canvasRef.value) {
        const rect = canvasRef.value.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        canvasRef.value.width = rect.width * dpr
        canvasRef.value.height = rect.height * dpr
        canvasRef.value.style.width = `${rect.width}px`
        canvasRef.value.style.height = `${rect.height}px`
        game.resize?.(rect.width, rect.height, dpr)
      }
    }, 200)
  })
})

onUnmounted(() => {
  game?.stop?.()
  if (updateInterval) clearInterval(updateInterval)
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
</style>
