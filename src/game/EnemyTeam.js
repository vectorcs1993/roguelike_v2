// src/game/EnemyTeam.js

import Team from './Team.js'
import EnemyAI, { BEHAVIOR_TYPE } from './EnemyAI.js'
import { ENEMIES } from './EnemyData.js'

export default class EnemyTeam extends Team {
  constructor(config = {}) {
    super(config.id || 'creatures', config.name || 'Твари', {
      color: config.color || '#ff4444',
      isPlayerControlled: false,
      canSwitchTo: false,
      visibleInFog: false,
      ...config
    })

    this.aiInstances = new Map() // character.id -> EnemyAI
  }

  addCharacter(character) {
    super.addCharacter(character)

    // Получаем данные врага из EnemyData
    let enemyData = {}
    for (const enemyType in ENEMIES) {
      const enemy = ENEMIES[enemyType]
      if (enemy.char === character.char || enemy.name === character.name) {
        enemyData = enemy
        break
      }
    }

    // Определяем поведение на основе типа врага
    const behavior = this.getBehaviorForCharacter(character, enemyData)

    // Создаём ИИ для врага
    const ai = new EnemyAI(character, {
      behavior: behavior,
      wanderRadius: 5,
      aggressiveness: 0.7,
      enemyData: enemyData,
      preferRanged: enemyData.range > 1,
      memoryDuration: 5000 // 5 секунд помнить позицию врага
    })

    this.aiInstances.set(character.id, ai)
    console.log(`Создан ИИ для ${character.name}: поведение ${behavior}`)
  }

  removeCharacter(character) {
    super.removeCharacter(character)
    this.aiInstances.delete(character.id)
  }

  update(dt, map, allCharacters) { // eslint-disable-line no-unused-vars
    // В упрощенной системе с очередью ходов враги действуют только в свой ход
    // Этот метод теперь не обновляет ИИ врагов - они будут обновляться через очередь ходов
    // Оставляем пустую реализацию для совместимости
  }

  getBehaviorForCharacter(character, enemyData) {
    // Определяем поведение на основе типа врага

    // Враги с дальней атакой обычно охраняют позицию
    if (enemyData.range > 1) {
      return BEHAVIOR_TYPE.GUARD
    }

    // Быстрые враги патрулируют
    if (enemyData.initiative >= 6) {
      return BEHAVIOR_TYPE.PATROL
    }

    // Медленные враги блуждают
    if (enemyData.initiative <= 2) {
      return BEHAVIOR_TYPE.WANDER
    }

    // По умолчанию блуждание
    return BEHAVIOR_TYPE.WANDER
  }

  // Получить ИИ для персонажа (для отладки)
  getAI(character) {
    return this.aiInstances.get(character.id)
  }

  // Сброс всех ИИ (при смене уровня)
  resetAllAI() {
    for (const ai of this.aiInstances.values()) {
      ai.reset()
    }
  }
}
