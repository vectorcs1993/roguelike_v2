export default class Team {
  constructor(id, name, config) {
    this.id = id
    this.name = name
    this.config = config
    this.characters = []
    this.color = config.color || '#ffffff'
    this.isPlayerControlled = config.isPlayerControlled || false
    this.canSwitchTo = config.canSwitchTo || false
    this.visibleInFog = config.visibleInFog || false
  }

  addCharacter(character) {
    this.characters.push(character)
    character.team = this
  }

  removeCharacter(character) {
    const index = this.characters.indexOf(character)
    if (index !== -1) this.characters.splice(index, 1)
  }

  isCharacterVisible(character, map) {
    const tile = map.getTile(Math.floor(character.x), Math.floor(character.y))

    if (this.visibleInFog) {
      // Всегда видны (даже в explored)
      return tile && (tile.visible || tile.explored)
    } else {
      // Только в зоне видимости
      return tile && tile.visible
    }
  }

  getBlockedCells(excludeCharacter = null) {
    // По умолчанию персонажи команды блокируют путь
    return this.characters
      .filter(c => c !== excludeCharacter)
      .map(c => ({ x: c.x | 0, y: c.y | 0 }))
  }
}
