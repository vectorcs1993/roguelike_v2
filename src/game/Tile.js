export default class Tile {
  constructor(type) {
    this.type = type     // 0 = пол, 1 = стена
    this.visible = false  // сейчас в зоне видимости
    this.explored = false    // был увидён хотя бы раз
  }

  get isWalkable() { return this.type === 0 }
  get isWall() { return this.type === 1 }
}
