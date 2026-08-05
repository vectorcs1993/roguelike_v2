// src/game/GameData.js

export const GAME_DATA = {
  // Символы для отрисовки
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
      scroll: '?'
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

  // Цвета для отрисовки
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
      scroll: '#88ff88'
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
    }
  },

  // Параметры врагов (бывший EnemyData)
  enemyData: {
    groaner: {
      name: 'Стонущий',
      hp: 20,
      armor: 0,
      damageMin: 3,
      damageMax: 6,
      damageType: 'blunt',
      range: 1,
      initiative: 2,
      accuracy: 0.60,
      fovRadius: 8,
      features: ['deathScream']
    },
    crawler: {
      name: 'Ползун',
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
      infectionChance: 0.05
    },
    mold: {
      name: 'Плесневик',
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
      infectionChance: 0.05
    },
    clawer: {
      name: 'Когтистый',
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
      doubleAttackPenalty: 0.20
    },
    slime: {
      name: 'Слизень',
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
      armorReduction: 1
    },
    runner: {
      name: 'Бегунок',
      hp: 18,
      armor: 0,
      damageMin: 4,
      damageMax: 6,
      damageType: 'bite',
      range: 1,
      initiative: 8,
      accuracy: 0.60,
      fovRadius: 10,
      features: ['fast']
    },
    fatso: {
      name: 'Толстяк',
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
      explosionInfection: 0.20
    },
    howler: {
      name: 'Воющий',
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
      initiativeBonus: 2
    },
    sticker: {
      name: 'Прилипала',
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
      immobilizeDuration: 1
    },
    mushroom: {
      name: 'Грибник',
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
      sporeInfection: 0.10
    },
    nonhuman: {
      name: 'Нелюдь',
      hp: 45,
      armor: 3,
      damageMin: 8,
      damageMax: 14,
      damageType: 'weapon',
      range: 1,
      initiative: 5,
      accuracy: 0.65,
      fovRadius: 10,
      features: ['dropsWeapon', 'canFollowOrders']
    },
    ratKing: {
      name: 'Крысиный король',
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
      summonCountMax: 3
    }
  }
}
