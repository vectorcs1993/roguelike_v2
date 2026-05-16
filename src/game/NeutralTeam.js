// src/game/NeutralTeam.js

import Team from './Team.js'

export default class NeutralTeam extends Team {
  constructor(config = {}) {
    super('neutral', 'Нейтралы', {
      color: '#ffaa44',
      isPlayerControlled: false,
      canSwitchTo: false,
      visibleInFog: false,
      ...config
    })
  }

  update() {
    return
  }
}
