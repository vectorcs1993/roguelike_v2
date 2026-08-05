// src/game/GameConfig.js

/**
 * Единый конфигурационный файл игры
 * Все игровые данные хранятся здесь
 */

export const GAME_CONFIG = {
  // ===== ОСНОВНЫЕ НАСТРОЙКИ =====
  version: '1.0.0',

  // ===== СИМВОЛЫ ДЛЯ ОТРИСОВКИ =====
  symbols: {
    player: '@',
    wall: '#',
    door: {
      closed: '+',
      open: '/'
    },
    crate: '■',
    items: {
      health: '♥',
      mana: '♦',
      weapon: '⚔',
      armor: '♠',
      gold: '$',
      potion: '!',
      scroll: '?',
      generic: '•'
    },
    enemies: {
      groaner: 'g',
      crawler: 'c',
      mold: 'm',
      clawer: 'C',
      slime: 's',
      runner: 'r',
      fatso: 'F',
      howler: 'h',
      sticker: 'S',
      mushroom: 'M',
      nonhuman: 'N',
      ratKing: 'R'
    }
  },

  // ===== ЦВЕТА =====
  colors: {
    player: '#88ff88',
    wall: '#666666',
    door: {
      closed: '#aa8866',
      open: '#88cc88'
    },
    crate: '#aa8844',
    items: {
      health: '#ff4444',
      mana: '#4444ff',
      weapon: '#ffaa44',
      armor: '#44aaff',
      gold: '#ffdd44',
      potion: '#ff66ff',
      scroll: '#88ff88',
      generic: '#ffffff'
    },
    enemies: {
      groaner: '#88aaaa',
      crawler: '#88aa88',
      mold: '#88aa55',
      clawer: '#cc8866',
      slime: '#66cc66',
      runner: '#aa8866',
      fatso: '#aa8844',
      howler: '#aa88aa',
      sticker: '#88ccaa',
      mushroom: '#aa77aa',
      nonhuman: '#ccaa88',
      ratKing: '#cc8866'
    },
    ui: {
      healthBar: '#44ff44',
      healthBarLow: '#ffaa44',
      healthBarCritical: '#ff4444',
      enemy: '#d83232',
      player: '#5272b6',
      neutral: '#666666',
      background: '#0a0a0a'
    }
  },

  // ===== ДАННЫЕ ВРАГОВ =====
  enemies: {
    groaner: {
      id: 'groaner',
      name: 'Стонущий',
      char: 'g',
      color: '#88aaaa',
      hp: 20,
      armor: 0,
      damageMin: 3,
      damageMax: 6,
      damageType: 'blunt',
      range: 1,
      initiative: 2,
      accuracy: 0.60,
      fovRadius: 8,
      features: ['deathScream'],
      xp: 10,
      loot: { gold: { min: 1, max: 3, chance: 0.3 } }
    },
    crawler: {
      id: 'crawler',
      name: 'Ползун',
      char: 'c',
      color: '#88aa88',
      hp: 15,
      armor: 2,
      damageMin: 2,
      damageMax: 4,
      damageType: 'bite',
      range: 1,
      initiative: 4,
      accuracy: 0.70,
      fovRadius: 8,
      features: ['infection'],
      infectionChance: 0.05,
      xp: 12,
      loot: { gold: { min: 1, max: 2, chance: 0.2 } }
    },
    mold: {
      id: 'mold',
      name: 'Плесневик',
      char: 'm',
      color: '#88aa55',
      hp: 25,
      armor: 1,
      damageMin: 4,
      damageMax: 8,
      damageType: 'spore',
      range: 1,
      initiative: 3,
      accuracy: 0.65,
      fovRadius: 8,
      features: ['infection'],
      infectionChance: 0.05,
      xp: 15,
      loot: { gold: { min: 2, max: 4, chance: 0.4 } }
    },
    clawer: {
      id: 'clawer',
      name: 'Когтистый',
      char: 'C',
      color: '#cc8866',
      hp: 30,
      armor: 2,
      damageMin: 6,
      damageMax: 12,
      damageType: 'slash',
      range: 1,
      initiative: 6,
      accuracy: 0.75,
      fovRadius: 8,
      features: ['doubleAttack'],
      doubleAttackPenalty: 0.20,
      xp: 20,
      loot: { gold: { min: 2, max: 5, chance: 0.5 } }
    },
    slime: {
      id: 'slime',
      name: 'Слизень',
      char: 's',
      color: '#66cc66',
      hp: 40,
      armor: 5,
      damageMin: 5,
      damageMax: 7,
      damageType: 'acid',
      range: 1,
      initiative: 1,
      accuracy: 0.80,
      fovRadius: 8,
      features: ['corrodeArmor'],
      armorReduction: 1,
      xp: 25,
      loot: { gold: { min: 3, max: 6, chance: 0.3 } }
    },
    runner: {
      id: 'runner',
      name: 'Бегунок',
      char: 'r',
      color: '#aa8866',
      hp: 18,
      armor: 0,
      damageMin: 4,
      damageMax: 6,
      damageType: 'bite',
      range: 1,
      initiative: 8,
      accuracy: 0.60,
      fovRadius: 10,
      features: ['fast'],
      xp: 15,
      loot: { gold: { min: 1, max: 3, chance: 0.2 } }
    },
    fatso: {
      id: 'fatso',
      name: 'Толстяк',
      char: 'F',
      color: '#aa8844',
      hp: 60,
      armor: 3,
      damageMin: 8,
      damageMax: 14,
      damageType: 'blunt',
      range: 1,
      initiative: 2,
      accuracy: 0.70,
      fovRadius: 8,
      features: ['explodeOnDeath'],
      explosionDamageMin: 10,
      explosionDamageMax: 15,
      explosionRadius: 2,
      explosionInfection: 0.20,
      xp: 30,
      loot: { gold: { min: 5, max: 10, chance: 0.6 } }
    },
    howler: {
      id: 'howler',
      name: 'Воющий',
      char: 'h',
      color: '#aa88aa',
      hp: 22,
      armor: 1,
      damageMin: 0,
      damageMax: 0,
      damageType: 'none',
      range: 1,
      initiative: 5,
      accuracy: 1.00,
      fovRadius: 8,
      features: ['buffAllies'],
      initiativeBonus: 2,
      xp: 15,
      loot: { gold: { min: 2, max: 4, chance: 0.3 } }
    },
    sticker: {
      id: 'sticker',
      name: 'Прилипала',
      char: 'S',
      color: '#88ccaa',
      hp: 12,
      armor: 4,
      damageMin: 2,
      damageMax: 4,
      damageType: 'immobilize',
      range: 1,
      initiative: 4,
      accuracy: 0.90,
      fovRadius: 8,
      features: ['immobilize'],
      immobilizeDuration: 1,
      xp: 12,
      loot: { gold: { min: 1, max: 2, chance: 0.2 } }
    },
    mushroom: {
      id: 'mushroom',
      name: 'Грибник',
      char: 'M',
      color: '#aa77aa',
      hp: 35,
      armor: 2,
      damageMin: 6,
      damageMax: 10,
      damageType: 'spore',
      range: 1,
      initiative: 3,
      accuracy: 0.70,
      fovRadius: 8,
      features: ['leaveSpores'],
      sporeRadius: 3,
      sporeInfection: 0.10,
      xp: 20,
      loot: { gold: { min: 2, max: 5, chance: 0.4 } }
    },
    nonhuman: {
      id: 'nonhuman',
      name: 'Нелюдь',
      char: 'N',
      color: '#ccaa88',
      hp: 45,
      armor: 3,
      damageMin: 8,
      damageMax: 14,
      damageType: 'weapon',
      range: 1,
      initiative: 5,
      accuracy: 0.65,
      fovRadius: 10,
      features: ['dropsWeapon', 'canFollowOrders'],
      xp: 25,
      loot: {
        gold: { min: 3, max: 7, chance: 0.5 },
        weapon: { chance: 0.2 }
      }
    },
    ratKing: {
      id: 'ratKing',
      name: 'Крысиный король',
      char: 'R',
      color: '#cc8866',
      hp: 30,
      armor: 1,
      damageMin: 2,
      damageMax: 6,
      damageType: 'bite',
      range: 1,
      initiative: 7,
      accuracy: 0.80,
      fovRadius: 8,
      features: ['summonRats'],
      summonCountMin: 1,
      summonCountMax: 3,
      xp: 30,
      loot: { gold: { min: 5, max: 10, chance: 0.7 } }
    }
  },

  // ===== ДАННЫЕ ПРЕДМЕТОВ =====
  items: {
    health: {
      id: 'health',
      name: 'Аптечка',
      char: '♥',
      color: '#ff4444',
      type: 'consumable',
      category: 'healing',
      value: 10,
      weight: 0.5,
      effects: { heal: 15 },
      description: 'Восстанавливает 15 HP'
    },
    mana: {
      id: 'mana',
      name: 'Батарея',
      char: '♦',
      color: '#4444ff',
      type: 'consumable',
      category: 'mana',
      value: 8,
      weight: 0.3,
      effects: { restoreMana: 10 },
      description: 'Восстанавливает 10 энергии'
    },
    weapon: {
      id: 'weapon',
      name: 'Оружие',
      char: '⚔',
      color: '#ffaa44',
      type: 'weapon',
      category: 'melee',
      value: 15,
      weight: 2,
      effects: { damageBonus: 3 },
      description: 'Увеличивает урон на 3'
    },
    armor: {
      id: 'armor',
      name: 'Броня',
      char: '♠',
      color: '#44aaff',
      type: 'armor',
      category: 'body',
      value: 12,
      weight: 3,
      effects: { armorBonus: 2 },
      description: 'Увеличивает броню на 2'
    },
    gold: {
      id: 'gold',
      name: 'Золото',
      char: '$',
      color: '#ffdd44',
      type: 'currency',
      category: 'gold',
      value: 1,
      weight: 0.01,
      effects: {},
      description: 'Игровая валюта'
    },
    potion: {
      id: 'potion',
      name: 'Зелье',
      char: '!',
      color: '#ff66ff',
      type: 'consumable',
      category: 'buff',
      value: 6,
      weight: 0.3,
      effects: { buff: 'strength', duration: 3 },
      description: 'Увеличивает силу на 3 хода'
    },
    scroll: {
      id: 'scroll',
      name: 'Свиток',
      char: '?',
      color: '#88ff88',
      type: 'consumable',
      category: 'scroll',
      value: 20,
      weight: 0.1,
      effects: { teleport: true },
      description: 'Телепортирует в случайное место'
    },
    generic: {
      id: 'generic',
      name: 'Предмет',
      char: '•',
      color: '#ffffff',
      type: 'misc',
      category: 'other',
      value: 1,
      weight: 0.5,
      effects: {},
      description: 'Обычный предмет'
    }
  },

  // ===== БИОМЫ =====
  biomes: {
    residential: {
      id: 'residential',
      name: 'Жилой этаж',
      description: 'Заброшенные жилые помещения',
      generation: {
        maxRooms: 22,
        minRoomSize: 4,
        maxRoomSize: 7,
        doorChance: 0.6,
        roomSpacing: 1
      },
      enemyPool: ['groaner', 'crawler', 'runner', 'mold', 'sticker'],
      enemyCount: { min: 8, max: 12 },
      itemPool: ['health', 'gold', 'potion', 'scroll', 'weapon', 'armor', 'mana'],
      itemWeights: [30, 20, 15, 10, 10, 10, 5],
      itemCount: { min: 5, max: 10 }
    },
    factory: {
      id: 'factory',
      name: 'Фабрика',
      description: 'Заброшенное промышленное здание',
      generation: {
        maxRooms: 12,
        minRoomSize: 6,
        maxRoomSize: 10,
        doorChance: 0.4,
        roomSpacing: 2
      },
      enemyPool: ['groaner', 'clawer', 'slime', 'mold', 'fatso', 'nonhuman'],
      enemyCount: { min: 10, max: 16 },
      itemPool: ['health', 'gold', 'weapon', 'armor', 'scroll', 'mana'],
      itemWeights: [20, 25, 15, 15, 10, 15],
      itemCount: { min: 4, max: 8 }
    },
    technical: {
      id: 'technical',
      name: 'Технический этаж',
      description: 'Лабиринт технических помещений',
      generation: {
        maxRooms: 15,
        minRoomSize: 3,
        maxRoomSize: 6,
        doorChance: 0.7,
        roomSpacing: 1
      },
      enemyPool: ['runner', 'sticker', 'mushroom', 'howler', 'ratKing'],
      enemyCount: { min: 6, max: 10 },
      itemPool: ['health', 'mana', 'gold', 'scroll', 'potion'],
      itemWeights: [25, 20, 20, 15, 20],
      itemCount: { min: 6, max: 12 }
    }
  },

  // ===== ПАРАМЕТРЫ ИГРОКА =====
  player: {
    startHp: 25,
    startMaxHp: 25,
    damageMin: 3,
    damageMax: 6,
    attackRange: 1,
    accuracy: 0.75,
    initiative: 6,
    fovRadius: 12,
    speed: 12,
    xpPerLevel: 20,
    maxLevel: 20,
    levelBonuses: {
      hp: 5,
      damage: 1,
      accuracy: 0.01
    }
  },

  // ===== ПАРАМЕТРЫ ГЕНЕРАЦИИ МИРА =====
  world: {
    width: 60,
    height: 40,
    padding: 2,
    minRoomSize: 4,
    maxRoomSize: 8,
    maxRooms: 20,
    roomSpacing: 1,
    doorChance: 0.5,
    crateChance: 0.3,
    doorSpawnChance: 0.5
  },

  // ===== НАСТРОЙКИ БОЯ =====
  combat: {
    baseAccuracy: 0.7,
    modifiers: {
      flanking: 0.1,
      highGround: 0.15,
      cover: -0.2,
      range: {
        melee: 0,
        short: -0.1,
        medium: -0.3,
        long: -0.5
      }
    }
  },

  // ===== КОНФИГУРАЦИЯ ИНТЕРФЕЙСА =====
  ui: {
    logger: {
      level: 2,
      enabledModules: ['enemy', 'combat', 'movement', 'action', 'ai', 'turn', 'pathfinding', 'generation', 'system']
    },
    console: {
      maxMessages: 500,
      autoScroll: true
    },
    camera: {
      speed: 15,
      lerpFactor: 0.15
    },
    renderer: {
      tileSize: 48,
      minTileSize: 12,
      fontFamily: 'Lucida Console, monospace'
    }
  },

  // ===== ДЕБАГ =====
  debug: {
    enabled: false,
    showFov: false,
    showRays: false,
    showVisibleCells: false,
    showPathfinding: false,
    logActions: true
  }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====

export const GameConfig = {
  getEnemy(id) {
    return GAME_CONFIG.enemies[id] || null
  },

  getEnemyIds() {
    return Object.keys(GAME_CONFIG.enemies)
  },

  getItem(id) {
    return GAME_CONFIG.items[id] || null
  },

  getItemIds() {
    return Object.keys(GAME_CONFIG.items)
  },

  getBiome(id) {
    return GAME_CONFIG.biomes[id] || null
  },

  getBiomeIds() {
    return Object.keys(GAME_CONFIG.biomes)
  },

  getRandomEnemyForBiome(biomeId) {
    const biome = this.getBiome(biomeId)
    if (!biome) return null
    const pool = biome.enemyPool
    if (!pool || pool.length === 0) return null
    const id = pool[Math.floor(Math.random() * pool.length)]
    return this.getEnemy(id)
  },

  getRandomItemForBiome(biomeId) {
    const biome = this.getBiome(biomeId)
    if (!biome) return null
    const pool = biome.itemPool
    const weights = biome.itemWeights
    if (!pool || pool.length === 0) return null
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * totalWeight
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]
      if (r <= 0) {
        return this.getItem(pool[i])
      }
    }
    return this.getItem(pool[0])
  },

  getSymbol(type, subType = null) {
    if (subType) {
      return GAME_CONFIG.symbols[type]?.[subType] || '?'
    }
    return GAME_CONFIG.symbols[type] || '?'
  },

  getColor(type, subType = null) {
    if (subType) {
      return GAME_CONFIG.colors[type]?.[subType] || '#ffffff'
    }
    return GAME_CONFIG.colors[type] || '#ffffff'
  },

  getBiomeGenerationConfig(biomeId) {
    const biome = this.getBiome(biomeId)
    if (!biome) return { ...GAME_CONFIG.world }
    return {
      ...GAME_CONFIG.world,
      ...biome.generation
    }
  },

  getPlayerConfig() {
    return { ...GAME_CONFIG.player }
  },

  getWorldConfig() {
    return { ...GAME_CONFIG.world }
  },

  getCombatConfig() {
    return { ...GAME_CONFIG.combat }
  },

  getUIConfig() {
    return { ...GAME_CONFIG.ui }
  },

  getDebugConfig() {
    return { ...GAME_CONFIG.debug }
  }
}

// Экспортируем для обратной совместимости
export const GAME_DATA = GAME_CONFIG
export default GAME_CONFIG
