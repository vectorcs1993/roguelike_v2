import Floor from './Floor.js'
import Wall from './Wall.js'
import Crate from './Crate.js'
import Fov from './Fov.js'
import Character from './Character.js'
import Door from './Door.js'
import ItemTile from './ItemTile.js'
import Pathfinder from './Pathfinder.js'
import PlayerTeam from './PlayerTeam.js'
import EnemyTeam from './EnemyTeam.js'
import BiomeGenerator from './BiomeGenerator.js'
import TurnQueue from './TurnQueue.js'
import { ENEMIES } from './EnemyData.js'

export default class Location {
  /**
   * @type  {import('./GameLoop.js').default}
   */
  #gameLoop = null

  constructor(config, walls, teamConfigs = [], itemConfigs = [], biomeName = null, cratePositions = []) {
    this.config = config

    this.biomeName = biomeName || 'Неизвестная локация'
    this.name = this.biomeName

    // TileMap fields
    this.cols = config.cols
    this.rows = config.rows
    this.grid = []
    this.itemsMap = new Map() // Отдельное хранилище для предметов
    this.doorsMap = new Map() // Отдельное хранилище для дверей
    this.fov = new Fov(this)

    this.fill()
    this.setWalls(walls)

    // Добавляем ящики на карту
    if (cratePositions && cratePositions.length > 0) {
      this.setCrates(cratePositions)
    }

    this.pathfinder = new Pathfinder(this)

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
      team.setLocation(this);

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
      this.addItem(item)
    }


    // Инициализируем очередь ходов после создания всех персонажей
    this.initializeTurnQueue()
  }

  // ========== TileMap methods ==========

  get map() {
    return this;
  }

  fill() {
    this.grid = Array.from({ length: this.rows }, (_, y) =>
      Array.from({ length: this.cols }, (_, x) => {
        const isBorder = y === 0 || y === this.rows - 1 || x === 0 || x === this.cols - 1
        return isBorder ? new Wall() : new Floor()
      })
    )
  }

  setWalls(pillars) {
    for (const [x, y] of pillars) {
      if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
        this.grid[y][x] = new Wall()
      }
    }
  }

  setCrates(cratePositions) {
    for (const [x, y] of cratePositions) {
      if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
        const tile = this.getTile(x, y)
        if (tile && tile.isWalkable) {
          this.grid[y][x] = new Crate()
        }
      }
    }
  }

  // Добавление предмета на карту
  addItem(item) {
    const key = `${item.x},${item.y}`
    this.itemsMap.set(key, item)
  }

  // Получение предмета на клетке
  getItemAt(x, y) {
    const key = `${x},${y}`
    return this.itemsMap.get(key)
  }

  // Удаление предмета (при подборе)
  removeItemAt(x, y) {
    const key = `${x},${y}`
    const item = this.itemsMap.get(key)
    if (item) {
      this.itemsMap.delete(key)
      return item
    }
    return null
  }

  // Проверка, есть ли предмет на клетке
  hasItemAt(x, y) {
    const key = `${x},${y}`
    return this.itemsMap.has(key)
  }

  getTile(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return null
    return this.grid[y][x]
  }

  isTileWalkable(x, y) {
    const tile = this.getTile(x, y)
    return tile ? tile.isWalkable : false
  }

  blocksSight(x, y) {
    const tile = this.getTile(x, y)
    return tile ? tile.blocksSight : true
  }

  setDoors(doors) {
    for (const door of doors) {
      const x = door.x, y = door.y
      if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
        const tile = this.getTile(x, y)
        // Дверь можно ставить только на пол (не на стену и не на ящик)
        if (tile && tile.isWalkable && !(tile instanceof Crate)) {
          this.grid[y][x] = door
        }
      }
    }
  }

  addDoor(door) {
    const key = `${door.x},${door.y}`
    this.doorsMap.set(key, door)
  }

  getDoorAt(x, y) {
    const key = `${x},${y}`
    return this.doorsMap.get(key)
  }

  hasDoorAt(x, y) {
    const key = `${x},${y}`
    return this.doorsMap.has(key)
  }

  removeDoorAt(x, y) {
    const key = `${x},${y}`
    this.doorsMap.delete(key)
  }

  getDoors() {
    return this.doorsMap.values()
  }

  getDoorCount() {
    return this.doorsMap.size
  }

  computeFov(originX, originY, radius, resetVisibility = true) {
    if (resetVisibility) {
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const tile = this.getTile(x, y)
          if (tile) tile.visible = false
        }
      }
    }

    this.fov.compute(originX | 0, originY | 0, radius)

    // Mark explored for visible tiles
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.getTile(x, y)
        if (tile && tile.visible) {
          tile.explored = true
        }
      }
    }
  }

  setGameLoop(gameLoop) {
    this.#gameLoop = gameLoop
  }
  getGameLoop() {
    return this.#gameLoop
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

    // Обновляем очередь ходов
    const switchedInQueue = this.turnQueue.setCurrentCharacter(characterId)
    if (!switchedInQueue) {
      console.warn(`Персонаж ${character.name} (ID: ${characterId}) не найден в очереди ходов`)
    }

    this.characters.forEach(c => {
      if (c.isActive) c.clearPath()
      c.isActive = false
    })
    character.isActive = true
    character.restoreFullAP()

    console.log(`Переключен на персонажа: ${character.name} (ID: ${characterId})`)
    return character
  }

  updateTeams(dt) {
    for (const team of this.teams.values()) {
      if (team.update && typeof team.update === 'function') {
        team.update(dt, this.map, this.characters)
      }
    }

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
   * Переходит к следующему ходу в очереди
   * @returns {import('./Character.js').default} следующий персонаж
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

    if (nextCharacter.isPlayerControlled) this.getGameLoop().centerOnCharacter(nextCharacter.id);
    return nextCharacter
  }

  /**
   * Проверяет, нужно ли переходить к следующему ходу
   * (текущий персонаж израсходовал все AP)
   * @returns {boolean}
   */
  shouldAdvanceTurn() {
    const currentChar = this.getActiveCharacter();
    if (!currentChar) return false;

    // Если у персонажа ещё есть AP – ход не заканчиваем
    if (currentChar.currentAP > 0) return false;

    // Если персонаж игрока и нет врагов – не переключаем ход, а восстанавливаем AP
    if (currentChar.team?.isPlayerControlled) {
      const hasEnemies = this.getGameLoop() ? this.getGameLoop().hasEnemiesInQueue() : true;
      if (!hasEnemies) {
        currentChar.restoreFullAP();  // Вне боя: восстанавливаем AP и остаёмся с тем же персонажем
        console.log(`${currentChar.name} AP восстановлены, ход продолжается`);
        return false; // ход не переключается
      }
    }

    // В бою или для врагов – переключаем ход
    return true;
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

    return this.nextTurn();
  }

  updateFov(centerX, centerY, radius, resetVisibility = true) {
    this.computeFov(centerX, centerY, radius, resetVisibility)
  }

  findPath(fromX, fromY, toX, toY, activeCharacter = null) {
    const blocked = this.getBlockedCells(activeCharacter)
    return this.pathfinder.find(fromX, fromY, toX, toY, blocked)
  }

  isWalkable(x, y, activeCharacter = null) {
    if (!this.isTileWalkable(x, y)) return false
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
    const tile = this.getTile(tileX, tileY)

    return tile ? tile.visible : false
  }

  isCharacterVisibleForPlayerTeam(character) {
    // Находим команду игрока
    const playerTeam = Array.from(this.teams.values()).find(team => team.isPlayerControlled)
    if (!playerTeam) {
      const tileX = Math.floor(character.x)
      const tileY = Math.floor(character.y)
      const tile = this.getTile(tileX, tileY)
      return tile ? tile.visible : false
    }

    // Если персонаж из команды игрока - всегда виден
    if (character.team === playerTeam) {
      return true
    }

    // Для врагов - проверяем видимость через клетку (только visible!)
    const tileX = Math.floor(character.x)
    const tileY = Math.floor(character.y)
    const tile = this.getTile(tileX, tileY)
    return tile ? tile.visible : false
  }

  getTileInfo(tileX, tileY) {
    const tile = this.getTile(tileX, tileY)

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
      const item = this.getItemAt(tileX, tileY)
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
    this.fill()
    for (const item of this.items) {
      item.collected = false
    }

    // Инициализируем очередь ходов при сбросе локации
    this.initializeTurnQueue()
  }


  static generateProcedural(config, biomeType = null) {
    // Выбор биома
    const selectedBiome = biomeType || (() => {
      const biomes = ['residential', 'factory', 'technical']
      return biomes[Math.floor(Math.random() * biomes.length)]
    })()

    // Базовые настройки генератора (новый формат)
    let generatorConfig = {
      width: 100,           // ширина карты
      height: 80,           // высота карты
      minRoomSize: 5,
      maxRoomSize: 10,
      maxRooms: 25,
      roomSpacing: 2,
      wallClearance: 1
    }

    let biomeName

    switch (selectedBiome) {
      case 'residential':
        biomeName = 'Жилой этаж'
        generatorConfig.maxRooms = 45
        generatorConfig.minRoomSize = 4
        generatorConfig.maxRoomSize = 6
        generatorConfig.roomSpacing = 1
        generatorConfig.wallClearance = 0   // разрешить коридорам касаться стен
        break

      case 'factory':
        biomeName = 'Фабрика'
        generatorConfig.maxRooms = 10
        generatorConfig.minRoomSize = 8
        generatorConfig.maxRoomSize = 14
        generatorConfig.roomSpacing = 4
        generatorConfig.wallClearance = 1
        break

      case 'technical':
        biomeName = 'Технический этаж'
        generatorConfig.maxRooms = 35
        generatorConfig.minRoomSize = 4
        generatorConfig.maxRoomSize = 6
        generatorConfig.roomSpacing = 3
        generatorConfig.wallClearance = 1
        break

      default:
        biomeName = 'Зараженная зона'
        generatorConfig.maxRooms = 25
        generatorConfig.minRoomSize = 5
        generatorConfig.maxRoomSize = 10
        generatorConfig.roomSpacing = 2
        generatorConfig.wallClearance = 1
    }

    // Генерация карты
    const generator = new BiomeGenerator(generatorConfig)
    const { walls, width, height, rooms, doors: doorData } = generator.generate()

    // ========== 2. ГЕНЕРАЦИЯ ЯЩИКОВ ==========
    const crates = []
    const crateCells = new Set()
    const wallSet = new Set(walls.map(w => `${w[0]},${w[1]}`))

    const roomCells = new Set()
    for (const room of rooms) {
      for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
        for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
          roomCells.add(`${x},${y}`)
        }
      }
    }

    const availableForCrates = Array.from(roomCells)
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
    const availableForItems = availableForCrates.filter(cell => !crateCells.has(cell))
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

    // ========== 5. ГЕНЕРАЦИЯ ВРАГОВ ==========
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
      const enemyData = ENEMIES[type]
      if (enemyData) {
        enemies.push({
          x, y, type,
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
          char: '@', color: '#44ffaa',
          id: generateId(), name: 'Игрок',
          fovRadius: 12,
          ap: { max: 12, moveCost: 1, pickupCost: 2 },
          hp: 25, armor: 1, damageMin: 3, damageMax: 6,
          damageType: 'blunt', range: 1, accuracy: 0.75, initiative: 6
        },
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

    const itemConfigs = items.map((item) => ({
      x: item.x,
      y: item.y,
      itemType: item.itemType,
      apRestore: 2 + Math.floor(Math.random() * 8)
    }))


    // Создаём объекты дверей
    const doorObjects = (doorData || []).map(d => new Door(d.x, d.y, d.locked))

    // Создаём локацию
    const location = new Location(
      { ...config, cols: width, rows: height },
      walls,
      [playerTeamConfig, enemyTeamConfig],
      itemConfigs,
      biomeName,
      crates
    )

    // Добавляем двери через Location
    if (doorObjects.length) {
      location.setDoors(doorObjects)
      console.log(`[Location] Добавлено ${doorObjects.length} дверей на карту`)
    }

    console.log(`[Location] Сгенерирована локация: ${biomeName}, размер ${width}x${height}`)
    console.log(`  - Комнат: ${rooms.length}, дверей: ${doorObjects.length}`)
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

  // Старый метод createDefault оставляем для совместимости
  static createDefault(config) {
    return Location.generateProcedural(config)
  }
}
