// src/engine/components/PlayerComponent.js

import Component from './Component.js'

export default class PlayerComponent extends Component {
  constructor() {
    super()
    this.isPlayerControlled = true
    this.canSwitchTo = true
    this.team = 'player'
  }
}
