// src/game/PlayerTeam.js

import Team from './Team.js'

export default class PlayerTeam extends Team {
  constructor(config = {}) {
    super(config.id || 'squad', config.name || 'Отряд', {
      color: config.color || '#44ff44',
      isPlayerControlled: true,
      canSwitchTo: true,
      visibleInFog: false,
      ...config
    })
  }

  update() {
    return
  }
}
