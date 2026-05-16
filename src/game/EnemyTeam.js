// src/game/EnemyTeam.js

import Team from './Team.js'

export default class EnemyTeam extends Team {
  constructor(config) {
    super('enemy', 'Враги', {
      color: '#ff4444',
      isPlayerControlled: false,
      canSwitchTo: false,
      visibleInFog: false,
      ...config
    })
  }

  update() {
    // Враги пока стоят на месте
    // Позже здесь будет ИИ
  }
}
