// src/game/EnemyTeam.js

import Team from './Team.js'

export default class EnemyTeam extends Team {
  constructor(config = {}) {
    super(config.id || 'creatures', config.name || 'Твари', {
      color: config.color || '#ff4444',
      isPlayerControlled: false,
      canSwitchTo: false,
      visibleInFog: false,
      ...config
    })
  }

  update() {
    // Твари пока стоят на месте
  }
}
