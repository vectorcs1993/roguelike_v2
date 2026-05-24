<template>
  <q-page class="q-pa-md dark-page" dark>
    <!-- Header with game title and controls -->
    <div class="row items-center justify-between q-mb-md">
      <div class="col-auto">
        <div class="text-h4 text-weight-bold text-primary">Samosbor Roguelike</div>
        <div class="text-subtitle1 text-grey-4">Тактическая пошаговая игра</div>
      </div>
      <div class="col-auto">
        <q-btn-group rounded>
          <q-btn color="primary" icon="play_arrow" label="Начать игру" @click="startGame" />
          <q-btn color="secondary" icon="settings" label="Настройки" @click="showSettings = true" />
          <q-btn color="orange" icon="help" label="Помощь" @click="showHelp = true" />
        </q-btn-group>
      </div>
    </div>

    <!-- Main game area -->
    <q-card class="q-mb-md" flat dark bordered>
      <q-card-section class="bg-dark text-white">
        <div class="row items-center justify-between">
          <div class="col-auto">
            <div class="text-h6">Игровое поле</div>
            <div class="text-caption text-grey-4">Локация: {{ locationName }}</div>
          </div>
          <div class="col-auto">
            <q-btn-group rounded>
              <q-btn color="orange" icon="refresh" label="Обновить уровень" @click="regenerateLevel" size="sm" />
              <q-btn color="purple" icon="map" label="Открыть карту" @click="revealFullMap" size="sm" />
              <q-btn color="green" icon="skip_next" label="Завершить ход" @click="endTurn" size="sm" :disable="!canEndTurn" v-if="isPlayerTurn" />
            </q-btn-group>
          </div>
        </div>
      </q-card-section>

      <q-separator dark />

      <q-card-section class="q-pa-none bg-grey-10">
        <div class="row no-wrap" style="min-height: 500px;">
          <!-- Canvas area -->
          <div class="col-6 relative-position">
            <canvas ref="canvasRef" class="full-width full-height" @touchstart.prevent="onTouchStart" @touchmove.prevent="onTouchMove"
              @touchend.prevent="onTouchEnd" @click.prevent="onCanvasClick" @mousemove="onMouseMove" @mouseleave="onMouseLeave"
              @contextmenu.prevent="onContextMenu" @mousedown="onMouseDown" @mouseup="onMouseUp" @wheel.prevent="onWheel">
            </canvas>
            <div class="absolute-bottom-right q-pa-sm">
              <q-chip color="dark" text-color="amber" icon="place">
                {{ locationName }}
              </q-chip>
            </div>
          </div>

          <!-- Console panel -->
          <q-separator vertical dark />

          <div class="col-6 bg-grey-9 text-white d-flex flex-column" style="min-height: 0; flex-shrink: 1;">
            <div class="q-pa-sm bg-grey-10 text-subtitle2 flex items-center">
              <q-icon name="terminal" size="16px" class="q-mr-sm" />
              <span>Консоль игры</span>
              <q-space />
              <q-btn flat dense round icon="delete_sweep" size="sm" @click="clearConsole" />
            </div>

            <div class="flex-grow min-h-0 d-flex flex-column" style="overflow: hidden;">
              <q-scroll-area ref="consoleScrollAreaRef" dark class="console-scroll-area" style="height: 400px;">
                <div class="q-pa-sm">
                  <div v-for="(log, idx) in consoleLogs" :key="idx" class="text-caption q-py-xs console-log-item">
                    <span class="text-grey-5 console-log-time">{{ log.time }}</span>
                    <span class="q-ml-sm console-log-text" :class="getMessageColorClass(log)">{{ log.text }}</span>
                  </div>
                  <div v-if="consoleLogs.length === 0" class="text-grey-5 text-center q-py-lg">
                    Готов к работе...
                  </div>
                </div>
              </q-scroll-area>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Character cards -->
    <q-card class="q-mb-md" flat dark bordered>
      <q-card-section class="bg-grey-9 text-white">
        <div class="row items-center justify-between">
          <div class="col-auto">
            <div class="text-h6 flex items-center">
              <q-icon name="groups" class="q-mr-sm" />
              <span>Отряд</span>
              <q-badge color="grey-7" :label="`${charactersList.length}`" class="q-ml-sm" />
            </div>
          </div>
          <div class="col-auto">
            <q-toggle v-model="showEnemies" label="Показывать врагов" color="primary" dark />
          </div>
        </div>
      </q-card-section>

      <q-separator dark />

      <q-card-section class="bg-grey-10">
        <q-scroll-area horizontal dark style="height: 220px;">
          <div class="row no-wrap q-gutter-xs">
            <q-card v-for="character in charactersList" :key="character.id"
              :class="[character.isActive ? 'bg-blue-10' : character.isSelectable ? 'bg-grey-8' : 'bg-grey-9']" flat dark bordered
              style="min-width: 280px;">
              <q-card-section class="q-pa-sm">
                <div class="row items-center q-gutter-sm">
                  <div class="col-auto">
                    <div class="character-symbol" :style="{ backgroundColor: character.teamColor, color: 'white' }">
                      {{ character.char }}
                    </div>
                  </div>
                  <div class="col">
                    <div class="text-subtitle2 text-weight-bold text-white">{{ character.name }}</div>
                    <q-chip :style="{ backgroundColor: character.teamColor }" size="sm" dense text-color="white" class="q-mt-xs" dark>
                      {{ character.teamName }}
                    </q-chip>
                    <div class="text-caption text-grey-4 q-mt-xs">
                      <q-icon name="favorite" size="12px" /> ОЗ: {{ character.hp }}/{{ character.maxHp }}
                      <q-icon name="bolt" size="12px" class="q-ml-sm" /> ОД: {{ character.ap }}/{{ character.maxAP }}
                    </div>
                  </div>
                  <div class="col-auto">
                    <q-btn flat dense round icon="center_focus_strong" size="sm" @click="centerOnCharacter(character)" dark>
                      <q-tooltip>Центрировать камеру</q-tooltip>
                    </q-btn>
                  </div>
                </div>

                <!-- Weapon display -->
                <div v-if="character.weapon" class="q-mt-sm">
                  <div class="text-caption text-grey-4">Оружие</div>
                  <div class="text-caption text-white">{{ character.weapon }}</div>
                </div>

                <!-- Combat Stats -->
                <div class="q-mt-xs">
                  <div class="row q-col-gutter-xs q-mt-xs">
                    <div class="col-6">
                      <div class="text-caption text-grey-5">Броня:</div>
                      <div class="text-caption text-white">{{ character.armor }}</div>
                    </div>
                    <div class="col-6">
                      <div class="text-caption text-grey-5">Урон:</div>
                      <div class="text-caption text-white">{{ character.damageMin }}-{{ character.damageMax }}</div>
                    </div>
                    <div class="col-6">
                      <div class="text-caption text-grey-5">Тип урона:</div>
                      <div class="text-caption text-white">{{ character.damageType }}</div>
                    </div>
                    <div class="col-6">
                      <div class="text-caption text-grey-5">Дальность:</div>
                      <div class="text-caption text-white">{{ character.attackRange }}</div>
                    </div>
                    <div class="col-6">
                      <div class="text-caption text-grey-5">Точность:</div>
                      <div class="text-caption text-white">{{ Math.round(character.accuracy * 100) }}%</div>
                    </div>
                    <div class="col-6">
                      <div class="text-caption text-grey-5">Инициатива:</div>
                      <div class="text-caption text-white">{{ character.initiative }}</div>
                    </div>
                  </div>
                </div>
              </q-card-section>
            </q-card>

            <div v-if="charactersList.length === 0" class="text-center q-pa-xl" style="min-width: 300px;">
              <q-icon name="person_off" size="xl" color="grey-6" />
              <div class="text-h6 text-grey-6 q-mt-md">Нет персонажей</div>
              <div class="text-caption text-grey-5">Начните игру, чтобы увидеть персонажей</div>
            </div>
          </div>
        </q-scroll-area>
      </q-card-section>
    </q-card>


    <!-- Dialogs -->
    <q-dialog v-model="showSettings">
      <q-card dark style="min-width: 500px;">
        <q-card-section class="bg-grey-9">
          <div class="text-h6 text-white">Настройки игры</div>
        </q-card-section>

        <q-card-section class="q-pt-none bg-grey-10">
          <q-toggle v-model="settings.sound" label="Звук" color="primary" dark />
          <q-toggle v-model="settings.music" label="Музыка" color="primary" class="q-mt-sm" dark />
          <q-toggle v-model="settings.animations" label="Анимации" color="primary" class="q-mt-sm" dark />

          <div class="q-mt-md">
            <div class="text-subtitle2 text-grey-4">Скорость игры</div>
            <q-slider v-model="settings.gameSpeed" :min="1" :max="10" :step="1" label dark />
          </div>
        </q-card-section>

        <q-card-actions align="right" class="bg-grey-9">
          <q-btn flat label="Отмена" color="primary" v-close-popup dark />
          <q-btn flat label="Сохранить" color="primary" @click="saveSettings" v-close-popup dark />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showHelp">
      <q-card dark style="min-width: 600px;">
        <q-card-section class="bg-grey-9">
          <div class="text-h6 text-white">Помощь по игре</div>
        </q-card-section>

        <q-card-section class="q-pt-none bg-grey-10 text-grey-4">
          <p><strong class="text-white">Samosbor Roguelike</strong> - тактическая пошаговая игра в жанре roguelike.</p>
          <p class="q-mt-sm">Цель игры: управляйте отрядом персонажей, исследуйте подземелья, сражайтесь с врагами и находите сокровища.</p>

          <div class="text-subtitle2 q-mt-md text-white">Основные правила:</div>
          <ul class="q-pl-md">
            <li>Каждый персонаж имеет очки здоровья (ОЗ) и очки действий (ОД)</li>
            <li>За один ход можно выполнить действия, тратя ОД</li>
            <li>Когда ОД заканчиваются, завершите ход кнопкой "Завершить ход"</li>
            <li>Враги атакуют в свой ход автоматически</li>
          </ul>

          <div class="text-subtitle2 q-mt-md text-white">Управление:</div>
          <div class="q-gutter-sm q-mt-sm">
            <q-chip icon="mouse" label="Клик - выбрать/переместить" color="blue" text-color="white" dark />
            <q-chip icon="zoom_in" label="Колесо мыши - масштаб" color="blue" text-color="white" dark />
            <q-chip icon="space_bar" label="Пробел - завершить ход" color="green" text-color="white" dark />
            <q-chip icon="refresh" label="R - обновить уровень" color="orange" text-color="white" dark />
            <q-chip icon="map" label="M - открыть карту" color="purple" text-color="white" dark />
          </div>
        </q-card-section>

        <q-card-actions align="right" class="bg-grey-9">
          <q-btn flat label="Закрыть" color="primary" v-close-popup dark />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, shallowRef, nextTick } from 'vue'
import GameLoop from 'src/game/GameLoop.js'
import config from 'src/game/config.json'
import { logger, LOG_LEVEL } from 'src/game/Logger.js'

const canvasRef = ref(null)
const consoleScrollAreaRef = ref(null)
let game = null
let resizeTimeout = null

// Game state
const locationName = ref('Подземелье 1')
const consoleLogs = shallowRef([])
const charactersList = shallowRef([])
const turnQueue = shallowRef([])
const isPlayerTurn = ref(false)
const canEndTurn = ref(false)
const showEnemies = ref(true)
const showSettings = ref(false)
const showHelp = ref(false)
const activeCharacterName = ref('')
const remainingAP = ref(0)

// For throttled updates
let lastCharactersHash = ''
let updatePending = false
let updateScheduled = false
let updateInterval = null

const settings = ref({
  sound: true,
  music: true,
  animations: true,
  gameSpeed: 5
})

// Console functions
function addConsoleMessage(text, type = 'info', color = null) {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  const newLogs = [...consoleLogs.value, { time, text: String(text), type, color }]

  if (newLogs.length > 500) {
    newLogs.shift()
  }

  consoleLogs.value = newLogs

  // Автопрокрутка к новому сообщению
  scrollConsoleToBottom()
}

// Определение класса цвета для сообщения
function getMessageColorClass(log) {
  // Если указан явный цвет, используем его
  if (log.color) {
    return `text-${log.color}`
  }

  // Иначе используем цвет по типу сообщения
  switch (log.type) {
    case 'error':
      return 'text-red'
    case 'warning':
      return 'text-orange'
    case 'success':
      return 'text-green'
    case 'info':
      return 'text-blue-3'
    case 'debug':
      return 'text-cyan'
    case 'trace':
      return 'text-grey-5'
    default:
      return 'text-white'
  }
}

function clearConsole() {
  consoleLogs.value = []
}

// Автопрокрутка консоли к последнему сообщению
function scrollConsoleToBottom() {
  if (consoleScrollAreaRef.value) {
    nextTick(() => {
      const scrollArea = consoleScrollAreaRef.value
      if (scrollArea) {

        const target = scrollArea.getScrollTarget()
        if (target) target.scrollTop = target.scrollHeight
      }
    })
  }
}

// Callback для перехвата сообщений из логгера
function loggerCallback(level, logModule, message) {
  // Преобразуем уровень логгера в тип сообщения для консоли
  let messageType = 'info'
  let color = null

  switch (level) {
    case LOG_LEVEL.ERROR:
      messageType = 'error'
      color = 'red'
      break
    case LOG_LEVEL.WARN:
      messageType = 'warning'
      color = 'orange'
      break
    case LOG_LEVEL.INFO:
      messageType = 'info'
      // Назначаем цвет в зависимости от модуля
      if (logModule) {
        switch (logModule) {
          case 'combat':
            color = 'red-4'
            break
          case 'movement':
            color = 'blue-4'
            break
          case 'ai':
            color = 'purple-4'
            break
          case 'enemy':
            color = 'deep-orange'
            break
          case 'turn':
            color = 'teal'
            break
          case 'system':
            color = 'grey-5'
            break
          default:
            color = 'blue-3'
        }
      }
      break
    case LOG_LEVEL.DEBUG:
      messageType = 'debug'
      color = 'cyan'
      break
    case LOG_LEVEL.TRACE:
      messageType = 'trace'
      color = 'grey-6'
      break
  }

  // Добавляем сообщение в консоль игры
  addConsoleMessage(message, messageType, color)
}

// Регистрируем callback в логгере
logger.addCallback(loggerCallback)

// Восстанавливаем оригинальные console методы при размонтировании компонента
onUnmounted(() => {
  // Удаляем callback из логгера
  logger.removeCallback(loggerCallback)
})

// Character list update functions
function getCharactersHash() {
  if (!game?.currentLocation) return ''
  const chars = game.currentLocation.getAllCharacters()
  return chars.map(c => `${c.id}:${c.isActive}:${c.currentAP}:${c.hp}`).join('|')
}

function updateTurnStatus() {
  if (!game?.currentLocation) {
    isPlayerTurn.value = false
    canEndTurn.value = false
    activeCharacterName.value = ''
    remainingAP.value = 0
    return
  }

  const activeChar = game.currentLocation.getActiveCharacter()
  if (activeChar) {
    activeCharacterName.value = activeChar.name
    remainingAP.value = activeChar.currentAP
    if (activeChar.team && activeChar.team.isPlayerControlled) {
      isPlayerTurn.value = true
      canEndTurn.value = activeChar.currentAP > 0
    } else {
      isPlayerTurn.value = false
      canEndTurn.value = false
    }
  } else {
    isPlayerTurn.value = false
    canEndTurn.value = false
    activeCharacterName.value = ''
    remainingAP.value = 0
  }
}

function updateCharactersList() {
  if (!game?.currentLocation) {
    if (charactersList.value.length !== 0) {
      charactersList.value = []
      locationName.value = ''
    }
    updateTurnStatus()
    return
  }

  const newHash = getCharactersHash()
  if (newHash === lastCharactersHash && updatePending) {
    updateTurnStatus()
    return
  }

  lastCharactersHash = newHash
  locationName.value = game.currentLocation.name || 'Неизвестная локация'

  const allCharacters = game.currentLocation.getAllCharacters()
  const visibleCharacters = allCharacters.filter(char => {
    const tile = game.currentLocation.map.getTile(Math.floor(char.x), Math.floor(char.y))
    if (char.isPlayerControlled || char.canSwitchTo) return true
    return tile && tile.visible
  })


  let sortedVisibleCharacters = [...visibleCharacters]
  if (game.currentLocation.turnQueue) {
    const turnQueue = game.currentLocation.turnQueue
    const queueOrder = turnQueue.queue.map(item => item.character.id)

    // Создаем карту для быстрого поиска индекса в очереди
    const orderMap = new Map()
    queueOrder.forEach((id, index) => {
      orderMap.set(id, index)
    })

    // Сортируем видимых персонажей по их позиции в очереди
    // Персонажи, которых нет в очереди, идут в конце
    sortedVisibleCharacters.sort((a, b) => {
      const aIndex = orderMap.has(a.id) ? orderMap.get(a.id) : Infinity
      const bIndex = orderMap.has(b.id) ? orderMap.get(b.id) : Infinity
      return aIndex - bIndex
    })
  }

  const newList = new Array(sortedVisibleCharacters.length)
  for (let i = 0; i < sortedVisibleCharacters.length; i++) {
    const char = sortedVisibleCharacters[i]
    const hp = char.hp || 0
    const maxHp = char.maxHp || hp || 0
    const hpPercentage = maxHp ? (hp / maxHp) * 100 : 100

    newList[i] = {
      id: char.id,
      name: char.name,
      char: char.char,
      x: char.x,
      y: char.y,
      isActive: char.isActive,
      isSelectable: char.canSwitchTo === true,
      teamColor: char.team?.color || '#666666',
      teamName: char.team?.name || 'Без команды',
      ap: char.currentAP,
      maxAP: char.maxAP,
      hp: hp,
      maxHp: maxHp,
      hpPercentage: hpPercentage,
      armor: char.armor || 0,
      damageMin: char.damageMin || 0,
      damageMax: char.damageMax || 0,
      damageType: char.damageType || 'blunt',
      attackRange: char.attackRange || 1,
      accuracy: char.accuracy || 0,
      initiative: char.initiative || 0,
      weapon: char.weaponName || null
    }
  }

  charactersList.value = newList
  updateTurnStatus()

  // Update turn queue
  if (game.turnQueue?.getDebugInfo) {
    const queueInfo = game.turnQueue.getDebugInfo()
    turnQueue.value = queueInfo.queue || []
  } else {
    turnQueue.value = []
  }

  updatePending = false
}

function throttledUpdate() {
  if (updateScheduled) return
  updateScheduled = true
  updatePending = true
  requestAnimationFrame(() => {
    updateCharactersList()
    updateScheduled = false
  })
}

// Game functions
function startGame() {
  if (!game) {
    initGame()
  }
  addConsoleMessage('Игра начата!', 'success')
}

function initGame() {
  if (!canvasRef.value) {
    addConsoleMessage('Canvas элемент не найден', 'error')
    return
  }

  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1

  // Устанавливаем внутренние размеры canvas с учетом DPR для четкости
  const displayWidth = Math.floor(rect.width * dpr)
  const displayHeight = Math.floor(rect.height * dpr)

  // Проверяем, нужно ли установить размеры по умолчанию
  if (rect.width === 0 || rect.height === 0) {
    canvas.width = 800
    canvas.height = 500
  } else {
    canvas.width = displayWidth
    canvas.height = displayHeight
  }

  // Устанавливаем CSS размеры для отображения
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`

  try {
    game = new GameLoop(canvas, config)

    // Инициализируем Renderer с размерами canvas и DPR
    game.initRenderer(canvas.width, canvas.height, dpr)

    game.start()
    addConsoleMessage('Игровой движок инициализирован', 'success')

    // Start update loop
    throttledUpdate()

    // Set up periodic updates
    updateInterval = setInterval(throttledUpdate, 100)
  } catch (error) {
    addConsoleMessage(`Ошибка инициализации игры: ${error.message}`, 'error')
    console.error('GameLoop error:', error)
    console.error('Config used:', config)
  }
}


function regenerateLevel() {
  if (game) {
    if (typeof game.reloadLocation === 'function') {
      game.reloadLocation()
      addConsoleMessage('Уровень перегенерирован', 'info')
    } else {
      addConsoleMessage('Ошибка: метод reloadLocation не найден', 'error')
      console.error('game.reloadLocation is not a function', game)
    }
  } else {
    addConsoleMessage('Игра не инициализирована', 'error')
  }
}

// IndexPage.vue - исправленный метод revealFullMap

function revealFullMap() {
  if (!game?.currentLocation) {
    console.error('revealFullMap: нет текущей локации!')
    addConsoleMessage('❌ Не удалось открыть карту: локация не загружена', 'error')
    return
  }

  const map = game.currentLocation.map
  if (!map) {
    console.error('revealFullMap: нет объекта map!')
    addConsoleMessage('❌ Не удалось открыть карту: объект карты отсутствует', 'error')
    return
  }

  let revealedCount = 0

  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      const tile = map.getTile(x, y)
      if (tile) {
        // Устанавливаем видимость и исследованность
        if (!tile.visible) {
          tile.visible = true
          revealedCount++
        }
        if (!tile.explored) {
          tile.explored = true
        }
      }
    }
  }

  console.log(`Открыто ${revealedCount} новых клеток`)
  addConsoleMessage(`🗺️ Карта полностью открыта (${revealedCount} клеток)`, 'success')

  // Принудительно перерисовываем
  if (game.renderer) {
    game.renderer.hoverTileX = null
    game.renderer.hoverTileY = null
  }
}

function endTurn() {
  if (!game?.currentLocation || !canEndTurn.value) return

  const activeChar = game.currentLocation.getActiveCharacter?.()
  if (activeChar && activeChar.team?.isPlayerControlled) {
    game.currentLocation.endTurn?.()
    addConsoleMessage(`Ход завершен: ${activeChar.name}`, 'info')
  }
}

function centerOnCharacter(character) {
  if (game) {
    game.centerOnCharacter?.(character.id)
    addConsoleMessage(`Камера центрирована на ${character.name}`, 'info')
  }
}

function onTouchStart(event) {
  if (game) {
    game.onTouchStart?.(event)
  }
}

function onTouchMove(event) {
  if (game) {
    game.onTouchMove?.(event)
  }
}

function onTouchEnd(event) {
  if (game) {
    game.onTouchEnd?.(event)
  }
}

function onCanvasClick(event) {
  if (game) {
    game.onClick?.(event)
  }
}

function onMouseMove(event) {
  if (game) {
    game.onMouseMove?.(event)
  }
}

function onMouseLeave(event) {
  if (game) {
    game.onMouseLeave?.(event)
  }
}

function onContextMenu(event) {
  if (game) {
    game.onContextMenu?.(event)
  }
}

function onMouseDown(event) {
  if (game) {
    game.onMouseDown?.(event)
  }
}

function onMouseUp(event) {
  if (game) {
    game.onMouseUp?.(event)
  }
}

function onWheel(event) {
  if (game) {
    game.onWheel?.(event)
    event.preventDefault()
  }
}

function saveSettings() {
  addConsoleMessage('Настройки сохранены', 'success')
}

// Lifecycle
onMounted(() => {
  // Initialize game after DOM is ready
  nextTick(() => {
    initGame()
  })

  // Handle window resize
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (game) {
    game.stop?.()
  }
  window.removeEventListener('resize', handleResize)
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
  if (updateInterval) {
    clearInterval(updateInterval)
    updateInterval = null
  }
})

function handleResize() {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
  resizeTimeout = setTimeout(() => {
    if (game && canvasRef.value) {
      const canvas = canvasRef.value
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1

      // Update canvas internal dimensions
      const displayWidth = Math.floor(rect.width * dpr)
      const displayHeight = Math.floor(rect.height * dpr)

      if (rect.width > 0 && rect.height > 0) {
        canvas.width = displayWidth
        canvas.height = displayHeight
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`

        // Call game resize with new dimensions
        game.resize?.(canvas.width, canvas.height, dpr)
      }
    }
  }, 250)
}
</script>

<style lang="scss" scoped>
// Minimal custom styles
.dark-page {
  background-color: #121212;
}

.character-symbol {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
  text-transform: uppercase;
}

canvas {
  background-color: #0a0a0a;
  display: block;
  border: 1px solid #333;
  border-radius: 4px;
}

// Ensure canvas container has proper dimensions
.col-grow.relative-position {
  min-height: 500px;

  canvas {
    width: 100%;
    height: 100%;
  }
}

// Console scroll area styles
.console-scroll-area {
  // QScrollArea will handle scrollbar styling
  // Make it fill available space
  height: 100%;
}

.console-log-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  &:last-child {
    border-bottom: none;
  }
}

.console-log-time {
  font-family: monospace;
  font-size: 0.75rem;
}

.console-log-text {
  word-break: break-word;
  line-height: 1.4;
}
</style>
