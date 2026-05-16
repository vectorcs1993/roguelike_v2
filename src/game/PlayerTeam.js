// src/game/PlayerTeam.js

import Team from './Team.js'

export default class PlayerTeam extends Team {
  constructor(config = {}) {
    super(config.id || 'player', config.name || 'Игроки', {
      color: config.color || '#44aaff',
      isPlayerControlled: true,
      canSwitchTo: true,
      visibleInFog: true,
      ...config
    })
  }

  update() {
    // Игроки не обновляются автоматически
    return
  }
}
