// Колода карт
export const DECK = [
  // Предметы
  { title: 'Концентрат', description: '+25 HP', icon: 'restaurant', type: 'item', heal: 25 },
  { title: 'Концентрат', description: '+25 HP', icon: 'restaurant', type: 'item', heal: 25 },
  { title: 'Аптечка', description: '+50 HP', icon: 'medical_services', type: 'item', heal: 50 },
  { title: 'Сгущёнка', description: 'Полное восстановление', icon: 'coffee', type: 'item', heal: 100 },

  // Оружие
  {
    title: 'Монтировка',
    description: 'Урон 8-12, оглушение',
    icon: 'build',
    type: 'weapon',
    dmg: [8, 12],
    stun: true  // оглушает врага — тот пропускает следующий ход
  },
  {
    title: 'Обрез',
    description: 'Урон 15-25, конус 3 клетки',
    icon: 'sports_kabaddi',
    type: 'weapon',
    dmg: [15, 25],
    ranged: true,
    aoe: 'cone'  // конус: клетка врага + две соседние дальние
  },
  {
    title: 'Автомат Ералашникова',
    description: 'Урон 10-18, линия',
    icon: 'bolt',
    type: 'weapon',
    dmg: [10, 18],
    ranged: true,
    aoe: 'line'  // линия: вся строка или столбец
  },

  // Враги — ближний бой
  { title: 'Бывший сосед', description: 'Пассивный', icon: 'person_off', type: 'enemy', hp: 25, dmg: [5, 10], aggro: false, counterAttack: false },
  { title: 'Сосед-агр', description: 'Агрессивный', icon: 'person_remove', type: 'enemy', hp: 25, dmg: [5, 10], aggro: true, counterAttack: true },
  { title: 'Нелюдь-шёпот', description: 'Психоатака', icon: 'psychology', type: 'enemy', hp: 30, dmg: [8, 12], aggro: true, counterAttack: true },

  // Враги — дальний бой
  { title: 'Ликвидатор', description: 'Дальний бой', icon: 'military_tech', type: 'enemy', hp: 40, dmg: [15, 20], aggro: true, ranged: true, counterAttack: false },

  // Ловушки
  { title: 'Прогнивший пол', description: 'Урон 10', icon: 'grid_off', type: 'trap', damage: 10 },
  { title: 'Оголённые провода', description: 'Урон 15', icon: 'bolt', type: 'trap', damage: 15 },

  // Локации
  { title: 'Распределитель', description: 'Случайный предмет', icon: 'store', type: 'location' },
  { title: 'Гермобункер', description: '+50 HP', icon: 'shield_lock', type: 'location' },
  { title: 'Вентшахта', description: 'Телепорт', icon: 'air', type: 'location' },

  // События
  { title: 'Запах газа', description: 'Событие', icon: 'description', type: 'event' },
  { title: 'Радиопередача', description: 'Событие', icon: 'radio', type: 'event' },
]

// Игровые константы
export const GAME_CONFIG = {
  START_HP: 100,
  START_ENERGY: 100,
  MAX_HAND_SIZE: 5,
  GRID_SIZE: 9,
  PLAYER_START_INDEX: 4,
  FIST_DAMAGE: 5,
  TRAP_DISARM_CHANCE: 0.6,
  STACK_MIN_SIZE: 1,
  STACK_MAX_SIZE: 2,
  LOG_MAX_LINES: 6,
  FLIP_ANIMATION_MS: 250,
}

// Вспомогательные функции
export const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5)

export const buildStacks = (deck) => {
  const shuffled = shuffle(deck)
  const stacks = []
  let idx = 0
  for (let i = 0; i < GAME_CONFIG.GRID_SIZE; i++) {
    const size = GAME_CONFIG.STACK_MIN_SIZE + Math.floor(Math.random() * (GAME_CONFIG.STACK_MAX_SIZE - GAME_CONFIG.STACK_MIN_SIZE + 1))
    stacks.push(shuffled.slice(idx, idx + size))
    idx += size
  }
  return stacks
}

export const createField = (stacks) => {
  return Array.from({ length: GAME_CONFIG.GRID_SIZE }, (_, i) => ({
    id: i + 1,
    isPlayer: i === GAME_CONFIG.PLAYER_START_INDEX,
    stack: [...(stacks[i] || [])],
    revealed: false,
    isEmpty: false,
    topCard: null,
    enemyData: null,
    _flipping: false,
  }))
}

export const createEnemyData = (card) => {
  if (card.type !== 'enemy') return null
  return {
    hp: card.hp,
    maxHp: card.hp,
    dmg: card.dmg,
    aggro: card.aggro || false,
    ranged: card.ranged || false,
    counterAttack: card.counterAttack !== false, // по умолчанию true
  }
}
