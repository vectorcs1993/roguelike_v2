import TileMap from './TileMap.js'
import Character from './Character.js'
import ItemTile from './ItemTile.js'
import Pathfinder from './Pathfinder.js'
import PlayerTeam from './PlayerTeam.js'
import EnemyTeam from './EnemyTeam.js'
import BiomeGenerator from './BiomeGenerator.js'
import TurnQueue from './TurnQueue.js'
import { ENEMIES } from './EnemyData.js'

export default class Location {
  constructor(config, pillars, teamConfigs = [], itemConfigs = [], biomeName = null, cratePositions = []) {
    this.config = config
    this.biomeName = biomeName || 'Неизвестная локация'
    this.name = this.biomeName

    this.map = new TileMap(config.cols, config.rows)
    this.map.fill()
    this.map.setWalls(pillars)

    // Добавляем ящики на карту
    if (cratePositions && cratePositions.length > 0) {
      this.map.setCrates(cratePositions)
    }

    this.pathfinder = new Pathfinder(this.map)

    this.teams = new Map()
    this.characters = []

    // Инициализация очереди ходов
    this.turnQueue = new TurnQueue()

    for (const teamConfig of teamConfigs) {
      let team

      switch (teamConfig.type) {
        case 'player':
          team = new PlayerTeam(teamConfig)
          break
        case 'enemy':
          team = new EnemyTeam(teamConfig)
          break
        default:
          console.warn(`Unknown team type: ${teamConfig.type}`)
          continue
      }

      for (const charConfig of teamConfig.characters) {

        const fovRadius = charConfig.fovRadius || 8

        const apConfig = charConfig.ap || {}
        const maxAP = apConfig.max || 12
        const moveAPCost = apConfig.moveCost !== undefined ? apConfig.moveCost : 1
        const pickupAPCost = apConfig.pickupCost !== undefined ? apConfig.pickupCost : 1

        // Создаем combatConfig из полей charConfig
        const combatConfig = {
          hp: charConfig.hp,
          maxHp: charConfig.maxHp || charConfig.hp,
          armor: charConfig.armor,
          damageMin: charConfig.damageMin,
          damageMax: charConfig.damageMax,
          damageType: charConfig.damageType,
          attackRange: charConfig.range,
          accuracy: charConfig.accuracy,
          initiative: charConfig.initiative
        }

        const character = new Character(
          charConfig.x, charConfig.y,
          charConfig.char,
          charConfig.id,
          charConfig.name,
          team,
          fovRadius,
          { maxAP, moveAPCost, pickupAPCost },
          combatConfig
        )
        team.addCharacter(character)
        this.characters.push(character)
      }

      this.teams.set(team.id, team)
    }

    this.items = []
    for (const itemConfig of itemConfigs) {
      const item = new ItemTile(itemConfig.x, itemConfig.y, itemConfig.itemType || 'generic')
      this.items.push(item)
      this.map.addItem(item)
    }

    // Инициализируем очередь ходов после создания всех персонажей
    this.initializeTurnQueue()
  }

  getAllCharacters() {
    return this.characters
  }

  getTeam(teamId) {
    return this.teams.get(teamId)
  }

  getAllTeams() {
    return Array.from(this.teams.values())
  }

  getActiveCharacter() {
    // Используем очередь ходов для определения активного персонажа
    const activeFromQueue = this.turnQueue.getCurrentCharacter()

    if (!activeFromQueue) {
      const fallback = this.characters.find(c => c.isActive) || null
      return fallback
    }

    return activeFromQueue
  }

  /**
   * Инициализирует очередь ходов
   */
  initializeTurnQueue() {
    // Только персонажи, управляемые игроком (isPlayerControlled === true)
    const playerCharacters = this.characters.filter(char =>
      char.team && char.team.isPlayerControlled === true
    )

    if (playerCharacters.length === 0) {
      console.warn('[Location] Нет персонажей игрока для инициализации очереди!')
      // Не добавляем врагов в очередь - оставляем пустую очередь
      this.turnQueue.initialize([])
    } else {
      this.turnQueue.initialize(playerCharacters)
    }

    // Упрощенная система: добавляем всех врагов в очередь с самого начала
    // Простой способ: все персонажи, не управляемые игроком
    const enemyCharacters = this.characters.filter(char =>
      char.team && !char.team.isPlayerControlled
    )

    let addedCount = 0
    for (const enemy of enemyCharacters) {
      // Находим команду врага
      const enemyTeam = enemy.team
      if (enemyTeam && enemyTeam.aiInstances) {
        const ai = enemyTeam.aiInstances.get(enemy.id)
        if (ai) {
          this.turnQueue.addCharacter(enemy, true)
          addedCount++
        } else {
          // Если AI не найден, всё равно добавляем врага в очередь
          this.turnQueue.addCharacter(enemy, true)
          addedCount++
        }
      } else {
        // Если команда не имеет aiInstances, всё равно добавляем
        this.turnQueue.addCharacter(enemy, true)
        addedCount++
      }
    }

    if (addedCount > 0) {
      console.log(`[Location] Добавлено ${addedCount} врагов в очередь ходов`)
    } else {
      console.log('[Location] Врагов для добавления в очередь не найдено')
    }

    // Принудительно устанавливаем активного персонажа (первого в очереди)
    const firstCharacter = this.turnQueue.queue.length > 0 ? this.turnQueue.queue[0].character : null
    if (firstCharacter) {
      this.characters.forEach(c => {
        if (c.isActive) c.clearPath()
        c.isActive = false
      })
      firstCharacter.isActive = true
      firstCharacter.restoreFullAP()
    } else {
      console.warn('[Location] Нет активного персонажа после инициализации очереди')
    }
  }

  switchToCharacter(characterId) {
    const character = this.characters.find(c => String(c.id) === String(characterId))

    if (!character || !character.canSwitchTo) {
      console.warn(`Cannot switch to character ID: ${characterId}`)
      return null
    }

    // Запрещаем переключение на врагов
    if (character.team && !character.team.isPlayerControlled) {
      console.warn(`Cannot switch to enemy character: ${character.name}`)
      return null
    }

    this.characters.forEach(c => {
      if (c.isActive) c.clearPath()
      c.isActive = false
    })
    character.isActive = true
    character.restoreFullAP()

    return character
  }

  updateTeams(dt) {
    for (const team of this.teams.values()) {
      if (team.update && typeof team.update === 'function') {
        team.update(dt, this.map, this.characters)
      }
    }

    // Проверяем врагов и добавляем их в очередь ходов при обнаружении
    this.updateEnemiesInTurnQueue()

    // Удаляем мертвых персонажей и проверяем условие завершения игры
    return this.removeDeadCharacters()
  }

  /**
   * Удаляет мертвых персонажей из игры
   * Удаляет из: массива characters, команды, очереди ходов
   * @returns {boolean} true если все игроки мертвы (игра окончена)
   */
  removeDeadCharacters() {
    const deadCharacters = this.characters.filter(char => char.isDead)

    if (deadCharacters.length === 0) {
      return this.checkGameOver()
    }

    console.log(`[Location] Удаляем ${deadCharacters.length} мертвых персонажей`)

    for (const deadChar of deadCharacters) {
      // Удаляем из команды
      if (deadChar.team) {
        deadChar.team.removeCharacter(deadChar)
      }

      // Удаляем из очереди ходов
      this.turnQueue.removeCharacter(deadChar)

      // Удаляем из массива characters
      const index = this.characters.indexOf(deadChar)
      if (index !== -1) {
        this.characters.splice(index, 1)
      }

      console.log(`[Location] Удален мертвый персонаж: ${deadChar.name}`)
    }

    // Проверяем условие завершения игры
    return this.checkGameOver()
  }

  /**
   * Проверяет условие завершения игры
   * @returns {boolean} true если все игроки мертвы (игра окончена)
   */
  checkGameOver() {
    // Находим всех персонажей игрока (управляемых игроком)
    const playerCharacters = this.characters.filter(char =>
      char.team && char.team.isPlayerControlled === true
    )

    if (playerCharacters.length === 0) {
      console.log('[Location] ИГРА ОКОНЧЕНА: Все персонажи игрока мертвы!')
      return true
    }

    return false
  }

  /**
   * Обновляет очередь ходов, добавляя врагов при их обнаружении
   * В упрощенной системе все враги уже добавлены при инициализации,
   * но этот метод оставлен для совместимости
   */
  updateEnemiesInTurnQueue() {
    // В упрощенной системе все враги уже добавлены в очередь при инициализации
    // Этот метод теперь ничего не делает, но оставлен для совместимости
  }

  /**
   * Переходит к следующему ходу в очереди
   * @returns {Object|null} следующий персонаж
   */
  nextTurn() {
    const nextCharacter = this.turnQueue.next()
    if (!nextCharacter) {
      return null
    }

    // Активируем следующего персонажа (игроки и враги)
    const prevActive = this.getActiveCharacter()
    if (prevActive) {
      prevActive.currentAP = 0 // сбрасываем ОД предыдущего персонажа
    }
    this.characters.forEach(c => {
      if (c.isActive) c.clearPath()
      c.isActive = false
    })
    nextCharacter.isActive = true
    nextCharacter.restoreFullAP() // восстанавливаем полные ОД новому активному персонажу

    return nextCharacter
  }

  /**
   * Проверяет, нужно ли переходить к следующему ходу
   * (текущий персонаж израсходовал все AP)
   * @returns {boolean}
   */
  shouldAdvanceTurn() {
    const currentChar = this.getActiveCharacter()
    if (!currentChar) {
      return false
    }

    const shouldAdvance = currentChar.currentAP <= 0

    // Если у текущего персонажа закончились AP, переходим к следующему
    return shouldAdvance
  }

  /**
   * Принудительно завершает ход текущего персонажа и переходит к следующему
   * @returns {Object|null} следующий персонаж
   */
  endTurn() {
    const currentChar = this.getActiveCharacter()
    if (!currentChar) {
      return null
    }

    // Сбрасываем оставшиеся AP у текущего персонажа
    currentChar.currentAP = 0

    return this.nextTurn()
  }

  updateFov(centerX, centerY, radius, resetVisibility = true) {
    this.map.computeFov(centerX, centerY, radius, resetVisibility)
  }

  findPath(fromX, fromY, toX, toY, activeCharacter = null) {
    const blocked = this.getBlockedCells(activeCharacter)
    return this.pathfinder.find(fromX, fromY, toX, toY, blocked)
  }

  isWalkable(x, y, activeCharacter = null) {
    if (!this.map.isWalkable(x, y)) return false
    return !this.characters.some(char => char !== activeCharacter && char.occupies(x, y))
  }

  getBlockedCells(activeCharacter = null) {
    const blocked = []
    for (const team of this.teams.values()) {
      blocked.push(...team.getBlockedCells(activeCharacter))
    }
    return blocked
  }

  areAllies(character1, character2) {
    if (character1.id === character2.id) return true
    return character1.teamId === character2.teamId
  }

  isCharacterVisibleForActive(character) {
    const activeChar = this.getActiveCharacter()
    if (!activeChar) return false

    if (this.areAllies(activeChar, character)) {
      return true
    }

    const tileX = Math.floor(character.x)
    const tileY = Math.floor(character.y)
    const tile = this.map.getTile(tileX, tileY)

    return tile ? tile.visible : false
  }

  isCharacterVisibleForPlayerTeam(character) {
    // Находим команду игрока
    const playerTeam = Array.from(this.teams.values()).find(team => team.isPlayerControlled)
    if (!playerTeam) {
      const tileX = Math.floor(character.x)
      const tileY = Math.floor(character.y)
      const tile = this.map.getTile(tileX, tileY)
      return tile ? tile.visible : false
    }

    // Если персонаж из команды игрока - всегда виден
    if (character.team === playerTeam) {
      return true
    }

    // Для врагов - проверяем видимость через клетку (только visible!)
    const tileX = Math.floor(character.x)
    const tileY = Math.floor(character.y)
    const tile = this.map.getTile(tileX, tileY)
    return tile ? tile.visible : false
  }

  getTileInfo(tileX, tileY) {
    const tile = this.map.getTile(tileX, tileY)

    // Неизвестная клетка (не видна и не исследована)
    if (!tile || (!tile.visible && !tile.explored)) {
      return {
        type: 'unknown',
        name: '🌑 Туман войны'
      }
    }

    // Проверяем персонажей ТОЛЬКО если клетка видима (не explored!)
    if (tile.visible) {
      for (const character of this.characters) {
        if (character.occupies(tileX, tileY)) {
          // Для врагов показываем информацию только если они видны
          const isVisible = this.isCharacterVisibleForPlayerTeam(character)
          if (isVisible) {
            return character.getTooltipInfo()
          }
        }
      }
    }

    // Проверяем предметы (только на видимых клетках)
    if (tile.visible) {
      const item = this.map.getItemAt(tileX, tileY)
      if (item && !item.collected) {
        return item.getTooltipInfo()
      }
    }

    // Возвращаем информацию о тайле
    if (tile) {
      const tileInfo = tile.getTooltipInfo()
      tileInfo.pos = { x: tileX, y: tileY }
      if (!tile.visible && tile.explored) {
        tileInfo.name = '🌑 ' + tileInfo.name + ' (исследовано)'
      }
      return tileInfo
    }

    return {
      type: 'unknown',
      name: '❓ Неизвестно'
    }
  }

  reset() {
    this.map.fill()
    for (const item of this.items) {
      item.collected = false
    }

    // Инициализируем очередь ходов при сбросе локации
    this.initializeTurnQueue()
  }


  static generateProcedural(config, biomeType = null) {
    // Если биом не указан - выбираем случайный
    const selectedBiome = biomeType || (() => {
      const biomes = ['residential', 'factory', 'technical']
      return biomes[Math.floor(Math.random() * biomes.length)]
    })()

    // Базовые настройки генератора
    let generatorConfig = {
      roomCount: 60,
      minRoomSize: 3,
      maxRoomSize: 6,
      corridorWidth: 1,
      roomSpacing: 2,
      maxAttempts: 200,        // уменьшил для скорости
      gridSize: 40,            // увеличил для лучшего размещения
    }

    let biomeName

    // Настройки в зависимости от типа биома
    switch (selectedBiome) {
      case 'residential':
        biomeName = 'Жилой этаж'
        generatorConfig.roomCount = 20
        generatorConfig.minRoomSize = 4
        generatorConfig.maxRoomSize = 8
        generatorConfig.roomSpacing = 1
        generatorConfig.corridorWidth = 1
        break

      case 'factory':
        biomeName = 'Фабрика'
        generatorConfig.roomCount = 25
        generatorConfig.minRoomSize = 5
        generatorConfig.maxRoomSize = 10
        generatorConfig.corridorWidth = 1
        generatorConfig.roomSpacing = 3
        break

      case 'technical':
        biomeName = 'Технический этаж'
        generatorConfig.roomCount = 30
        generatorConfig.minRoomSize = 3
        generatorConfig.maxRoomSize = 6
        generatorConfig.corridorWidth = 1
        generatorConfig.roomSpacing = 4
        break

      default:
        biomeName = 'Зараженная зона'
        break
    }

    // 1. ГЕНЕРАЦИЯ КАРТЫ (только стены, комнаты, коридоры, двери)
    const generator = new BiomeGenerator(generatorConfig)
    const { walls, width, height, rooms, doors } = generator.generate()

    // ========== 2. ГЕНЕРАЦИЯ ЯЩИКОВ (упрощённая, без сложных проверок) ==========
    const crates = []
    const crateCells = new Set()
    const wallSet = new Set(walls.map(w => `${w[0]},${w[1]}`))

    // Собираем все клетки внутри комнат
    const roomCells = new Set()
    for (const room of rooms) {
      for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
        for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
          roomCells.add(`${x},${y}`)
        }
      }
    }

    const availableForCrates = Array.from(roomCells)
    // Перемешиваем
    for (let i = availableForCrates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[availableForCrates[i], availableForCrates[j]] = [availableForCrates[j], availableForCrates[i]]
    }

    const crateCount = Math.min(15, availableForCrates.length)
    for (let i = 0; i < crateCount; i++) {
      const [x, y] = availableForCrates[i].split(',').map(Number)
      crates.push([x, y])
      crateCells.add(`${x},${y}`)
    }

    // ========== 3. ГЕНЕРАЦИЯ ПРЕДМЕТОВ ==========
    const items = []
    const availableForItems = []

    for (const cell of availableForCrates) {
      if (!crateCells.has(cell)) {
        availableForItems.push(cell)
      }
    }

    const itemCount = Math.min(20, availableForItems.length)
    const itemTypes = ['generic', 'health', 'mana', 'weapon', 'armor']

    for (let i = 0; i < itemCount; i++) {
      const [x, y] = availableForItems[i].split(',').map(Number)
      const randomType = itemTypes[Math.floor(Math.random() * itemTypes.length)]
      items.push({ x, y, itemType: randomType })
    }

    // ========== 4. ПОИСК ПОЗИЦИЙ ДЛЯ ИГРОКА И СПУТНИКА ==========
    const isPositionFree = (x, y) => {
      const key = `${x},${y}`
      return !wallSet.has(key) && !crateCells.has(key) && !items.some(i => i.x === x && i.y === y)
    }

    const playerStart = Location.findEmptyTile(width, height, isPositionFree)
    const allyStart = Location.findEmptyTile(width, height, isPositionFree, [playerStart])

    // ========== 5. ГЕНЕРАЦИЯ ВРАГОВ (упрощённая) ==========
    const enemies = []
    const enemyTypes = ['groaner', 'crawler', 'runner', 'mold', 'sticker']
    const availableForEnemies = availableForCrates.filter(cell => {
      const [x, y] = cell.split(',').map(Number)
      const distToPlayer = Math.abs(x - playerStart.x) + Math.abs(y - playerStart.y)
      return !crateCells.has(cell) && distToPlayer > 5
    })

    const enemyCount = Math.min(10, availableForEnemies.length)
    for (let i = 0; i < enemyCount; i++) {
      const [x, y] = availableForEnemies[i].split(',').map(Number)
      const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)]
      const enemyData = ENEMIES[type] // нужно импортировать ENEMIES
      if (enemyData) {
        enemies.push({
          x, y,
          type: type,
          name: enemyData.name,
          char: enemyData.char,
          color: enemyData.color,
          hp: enemyData.hp,
          armor: enemyData.armor,
          damageMin: enemyData.damageMin,
          damageMax: enemyData.damageMax,
          damageType: enemyData.damageType,
          range: enemyData.range,
          initiative: enemyData.initiative,
          accuracy: enemyData.accuracy,
          fovRadius: enemyData.fovRadius,
          ap: { max: 10, moveCost: 1 }
        })
      }
    }

    // ========== 6. ФОРМИРОВАНИЕ КОНФИГОВ ==========
    let nextId = 1
    const generateId = () => nextId++

    const playerTeamConfig = {
      type: 'player',
      id: 'liquidators',
      name: 'Ликвидаторы',
      color: '#44aaff',
      characters: [
        {
          x: playerStart.x, y: playerStart.y,
          char: '@',
          color: '#44ffaa',
          id: generateId(),
          name: 'Командир',
          fovRadius: 12,
          ap: { max: 12, moveCost: 1, pickupCost: 2 },
          hp: 25, armor: 1, damageMin: 3, damageMax: 6,
          damageType: 'blunt', range: 1, accuracy: 0.75, initiative: 6
        },
        {
          x: allyStart.x, y: allyStart.y,
          char: '@',
          color: '#44ffaa',
          id: generateId(),
          name: 'Спутник',
          fovRadius: 10,
          ap: { max: 10, moveCost: 2, pickupCost: 4 },
          hp: 20, armor: 0, damageMin: 2, damageMax: 4,
          damageType: 'blunt', range: 1, accuracy: 0.70, initiative: 4
        }
      ]
    }

    const enemyTeamConfig = {
      type: 'enemy',
      id: 'creatures',
      name: 'Твари',
      color: '#ff4444',
      characters: enemies.map((enemy) => ({
        x: enemy.x, y: enemy.y,
        char: enemy.char, color: enemy.color,
        id: generateId(), name: enemy.name,
        fovRadius: enemy.fovRadius || 8,
        ap: enemy.ap || { max: 10, moveCost: 1 },
        hp: enemy.hp, armor: enemy.armor,
        damageMin: enemy.damageMin, damageMax: enemy.damageMax,
        damageType: enemy.damageType, range: enemy.range,
        initiative: enemy.initiative, accuracy: enemy.accuracy,
        features: enemy.features || []
      }))
    }

    const itemConfigs = items.map(item => ({
      x: item.x, y: item.y,
      itemType: item.itemType,
      apRestore: 2 + Math.floor(Math.random() * 8)
    }))

    const updatedConfig = { ...config, cols: width, rows: height }

    // 7. СОЗДАНИЕ ЛОКАЦИИ
    const location = new Location(
      updatedConfig,
      walls,
      [playerTeamConfig, enemyTeamConfig],
      itemConfigs,
      biomeName,
      crates
    )

    // Добавляем двери на карту
    if (doors && doors.length > 0) {
      for (const door of doors) {
        if (door.y >= 0 && door.y < location.map.rows &&
          door.x >= 0 && door.x < location.map.cols) {
          location.map.grid[door.y][door.x] = door
        }
      }
      console.log(`[Location] Добавлено ${doors.length} дверей на карту`)
    }

    console.log(`[Location] Сгенерирована локация: ${biomeName}, размер ${width}x${height}`)
    console.log(`  - Комнат: ${rooms.length}, дверей: ${doors?.length || 0}`)
    console.log(`  - Ящиков: ${crates.length}, предметов: ${items.length}, врагов: ${enemies.length}`)

    return location
  }

  static findEmptyTile(width, height, isPositionFree, occupied = []) {
    const occupiedSet = new Set(occupied.map(o => `${o.x},${o.y}`))

    // Собираем все возможные позиции
    const candidates = []
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const key = `${x},${y}`
        if (isPositionFree(x, y) && !occupiedSet.has(key)) {
          // Даем предпочтение клеткам подальше от стен
          let wallDistance = 0
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              if (!isPositionFree(x + dx, y + dy)) wallDistance++
            }
          }
          candidates.push({ x, y, wallDistance })
        }
      }
    }

    if (candidates.length === 0) {
      // Если нет свободных клеток, ищем хотя бы какую-нибудь
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (isPositionFree(x, y) && !occupiedSet.has(`${x},${y}`)) {
            console.warn(`Использована запасная позиция (${x}, ${y})`)
            return { x, y }
          }
        }
      }
      console.error(`НЕТ СВОБОДНЫХ ПОЗИЦИЙ! Возвращаем (10, 10)`)
      return { x: 10, y: 10 }
    }

    // Сортируем по удаленности от стен (чем дальше, тем лучше)
    candidates.sort((a, b) => b.wallDistance - a.wallDistance)

    // Берем случайную из топ-10 лучших позиций
    const topCandidates = candidates.slice(0, Math.min(10, candidates.length))
    const randomIndex = Math.floor(Math.random() * topCandidates.length)

    return { x: topCandidates[randomIndex].x, y: topCandidates[randomIndex].y }
  }

  // Вывод карты с видимостью (туман войны)
  debugPrintMapWithVisibility() {
    const map = this.currentLocation.map
    if (!map) {
      console.log('Карта не инициализирована')
      return
    }

    const activeChar = this.currentLocation.getActiveCharacter()


    console.log(`\n=== КАРТА С ВИДИМОСТЬЮ (активный: ${activeChar?.name || 'нет'}) ===`)

    let output = ''

    for (let y = 0; y < map.rows; y++) {
      let row = ''
      for (let x = 0; x < map.cols; x++) {
        const tile = map.getTile(x, y)

        if (!tile) {
          row += '?'
          continue
        }

        let symbol

        if (tile.visible) {
          // Видимая клетка
          if (tile.constructor?.name === 'Door') {
            symbol = tile.char
          } else if (tile.isWalkable) {
            symbol = '.'
          } else {
            symbol = '#'
          }
        } else if (tile.explored) {
          // Исследованная, но невидимая
          if (tile.constructor?.name === 'Door') {
            symbol = '░'  // тёмная дверь
          } else if (tile.isWalkable) {
            symbol = '░'
          } else {
            symbol = '▓'
          }
        } else {
          // Неизвестная клетка
          symbol = '?'
        }

        row += symbol
      }
      output += row + '\n'
    }

    console.log(output)
    console.log(`Легенда: #=стена .=пол +=закрытая дверь /=открытая дверь ?=неизвестно ░=исследовано ▓=исследованная стена\n`)
  }
  // Старый метод createDefault оставляем для совместимости
  static createDefault(config) {
    return Location.generateProcedural(config)
  }
}
