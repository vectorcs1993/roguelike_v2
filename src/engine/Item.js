// src/engine/Item.js
//
// Унифицированное представление предмета.
//
// Раньше предметы на полу были сущностями (Entity с PositionComponent,
// RenderComponent, EnvironmentComponent, ItemComponent и разрозненными полями
// itemData/itemType/itemCount/itemEffects), а предметы в инвентаре — просто
// данными { itemData, count }. Это приводило к дублированию логики и потере
// данных при конвертации в обе стороны.
//
// Теперь и предмет на полу, и предмет в инвентаре — это один и тот же объект
// Item:
//   - data  — статические данные предмета (тип, имя, символ, цвет, эффекты...)
//   - count — количество в стаке
//
// Контекст хранения определяется компонентом-владельцем:
//   - на полу: ItemComponent (сущность также имеет PositionComponent)
//   - в инвентаре: InventoryComponent
//
// При подборе/выбросе Item передаётся целиком, без ручной пересборки данных.

export default class Item {
  static _nextId = 1

  /**
   * @param {object} data  — данные предмета (см. GameConfig.getItem)
   * @param {number} count — количество в стаке
   */
  constructor(data = {}, count = 1) {
    this.id = data.id !== undefined ? data.id : Item._nextId++
    this.data = { ...data }
    this.count = count
  }

  // ===== Удобные геттеры =====

  get type() {
    return this.data.type || 'generic'
  }

  get name() {
    return this.data.name || 'Предмет'
  }

  get char() {
    return this.data.char || '?'
  }

  get color() {
    return this.data.color || '#ffffff'
  }

  get bgColor() {
    return this.data.bgColor || null
  }

  get effects() {
    return this.data.effects || {}
  }

  get usable() {
    if (this.data.usable === false) return false
    if (this.data.usable === true) return true
    return Object.keys(this.effects).length > 0
  }

  // ===== Операции со стаком =====

  add(count = 1) {
    this.count += count
    return this.count
  }

  remove(count = 1) {
    this.count = Math.max(0, this.count - count)
    return this.count
  }

  get isEmpty() {
    return this.count <= 0
  }

  // ===== Сериализация =====

  /** Возвращает копию данных предмета (для передачи в эффекты и т.п.). */
  toData() {
    return { ...this.data, id: this.id, count: this.count }
  }

  /** Создаёт копию предмета (для выброса/передачи). */
  clone(count = this.count) {
    return new Item({ ...this.data, id: this.id }, count)
  }
}
