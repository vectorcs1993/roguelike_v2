// src/engine/components/MovementComponent.js

import Component from './Component.js'

export default class MovementComponent extends Component {
  constructor(speed = 12) {
    super()
    this.speed = speed
    this.path = []
    this.followingPath = false
    this.target = null
  }

  setPath(path, target = null) {
    if (!path || path.length <= 1) {
      this.followingPath = false
      this.path = []
      this.target = null
      return
    }
    this.path = path
    this.followingPath = true
    this.target = target
  }

  getNextStep() {
    if (!this.followingPath || this.path.length === 0) return null
    return this.path[0]
  }

  advancePath() {
    if (this.path.length > 0) {
      this.path.shift()
    }
    if (this.path.length === 0) {
      this.followingPath = false
    }
  }

  clearPath() {
    this.path = []
    this.followingPath = false
    this.target = null
  }
}
