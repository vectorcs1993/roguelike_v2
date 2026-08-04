export const ENEMY_TYPES = {
  GROANER: 'groaner',
  CRAWLER: 'crawler',
  MOLD: 'mold',
  CLAWER: 'clawer',
  SLIME: 'slime',
  RUNNER: 'runner',
  FATSO: 'fatso',
  HOWLER: 'howler',
  STICKER: 'sticker',
  MUSHROOM: 'mushroom',
  NONHUMAN: 'nonhuman',
  RAT_KING: 'ratKing'
}

export const ENEMIES = {
  groaner: {
    name: 'Стонущий', char: 'g', color: '#88aaaa',
    hp: 20, armor: 0, damageMin: 3, damageMax: 6,
    damageType: 'blunt', range: 1, initiative: 2,
    accuracy: 0.60, fovRadius: 8,
    features: ['deathScream']
  },
  crawler: {
    name: 'Ползун', char: 'c', color: '#88aa88',
    hp: 15, armor: 2, damageMin: 2, damageMax: 4,
    damageType: 'bite', range: 1, initiative: 4,
    accuracy: 0.70, fovRadius: 8,
    features: ['infection'], infectionChance: 0.05
  },
  mold: {
    name: 'Плесневик', char: 'm', color: '#88aa55',
    hp: 25, armor: 1, damageMin: 4, damageMax: 8,
    damageType: 'spore', range: 1, initiative: 3,
    accuracy: 0.65, fovRadius: 8,
    features: ['infection'], infectionChance: 0.05
  },
  clawer: {
    name: 'Когтистый', char: 'C', color: '#cc8866',
    hp: 30, armor: 2, damageMin: 6, damageMax: 12,
    damageType: 'slash', range: 1, initiative: 6,
    accuracy: 0.75, fovRadius: 8,
    features: ['doubleAttack'], doubleAttackPenalty: 0.20
  },
  slime: {
    name: 'Слизень', char: 's', color: '#66cc66',
    hp: 40, armor: 5, damageMin: 5, damageMax: 7,
    damageType: 'acid', range: 1, initiative: 1,
    accuracy: 0.80, fovRadius: 8,
    features: ['corrodeArmor'], armorReduction: 1
  },
  runner: {
    name: 'Бегунок', char: 'r', color: '#aa8866',
    hp: 18, armor: 0, damageMin: 4, damageMax: 6,
    damageType: 'bite', range: 1, initiative: 8,
    accuracy: 0.60, fovRadius: 10,
    features: ['fast']
  },
  fatso: {
    name: 'Толстяк', char: 'F', color: '#aa8844',
    hp: 60, armor: 3, damageMin: 8, damageMax: 14,
    damageType: 'blunt', range: 1, initiative: 2,
    accuracy: 0.70, fovRadius: 8,
    features: ['explodeOnDeath'],
    explosionDamageMin: 10, explosionDamageMax: 15,
    explosionRadius: 2, explosionInfection: 0.20
  },
  howler: {
    name: 'Воющий', char: 'h', color: '#aa88aa',
    hp: 22, armor: 1, damageMin: 0, damageMax: 0,
    damageType: 'none', range: 1, initiative: 5,
    accuracy: 1.00, fovRadius: 8,
    features: ['buffAllies'], initiativeBonus: 2
  },
  sticker: {
    name: 'Прилипала', char: 'S', color: '#88ccaa',
    hp: 12, armor: 4, damageMin: 2, damageMax: 4,
    damageType: 'immobilize', range: 1, initiative: 4,
    accuracy: 0.90, fovRadius: 8,
    features: ['immobilize'], immobilizeDuration: 1
  },
  mushroom: {
    name: 'Грибник', char: 'M', color: '#aa77aa',
    hp: 35, armor: 2, damageMin: 6, damageMax: 10,
    damageType: 'spore', range: 1, initiative: 3,
    accuracy: 0.70, fovRadius: 8,
    features: ['leaveSpores'], sporeRadius: 3, sporeInfection: 0.10
  },
  nonhuman: {
    name: 'Нелюдь', char: 'N', color: '#ccaa88',
    hp: 45, armor: 3, damageMin: 8, damageMax: 14,
    damageType: 'weapon', range: 1, initiative: 5,
    accuracy: 0.65, fovRadius: 10,
    features: ['dropsWeapon', 'canFollowOrders']
  },
  ratKing: {
    name: 'Крысиный король', char: 'R', color: '#cc8866',
    hp: 30, armor: 1, damageMin: 2, damageMax: 6,
    damageType: 'bite', range: 1, initiative: 7,
    accuracy: 0.80, fovRadius: 8,
    features: ['summonRats'], summonCountMin: 1, summonCountMax: 3
  }
}
