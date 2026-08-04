export default class Team {
  constructor(id, name, config = {}) {
    this.id = id
    this.name = name
    this.characters = []
    this.color = config.color || '#ffffff'
    this.isPlayerControlled = config.isPlayerControlled || false
    this.canSwitchTo = config.canSwitchTo || false
    this.visibleInFog = config.visibleInFog || false
    this.location = null
  }

  setLocation(location) {
    this.location = location
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
      return tile && (tile.visible || tile.explored)
    }
    return tile && tile.visible
  }

  getBlockedCells(excludeCharacter = null) {
    return this.characters
      .filter(c => c !== excludeCharacter)
      .map(c => ({ x: Math.floor(c.x), y: Math.floor(c.y) }))
  }
}
