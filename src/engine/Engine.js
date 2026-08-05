// src/engine/Engine.js

import Entity from './Entity.js'
import PositionComponent from './components/PositionComponent.js'
import HealthComponent from './components/HealthComponent.js'
import PlayerComponent from './components/PlayerComponent.js'
import AIComponent from './components/AIComponent.js'

export default class Engine {
  constructor() {
    this.entities = []
    this.systems = []
    this.entityMap = new Map()
    this._nextId = 1
  }

  // ========== Управление сущностями ==========

  createEntity(tag = 'entity') {
    const entity = new Entity(tag)
    this.entities.push(entity)
    this.entityMap.set(entity.id, entity)
    return entity
  }

  addEntity(entity) {
    this.entities.push(entity)
    this.entityMap.set(entity.id, entity)
    return entity
  }

  getEntity(id) {
    return this.entityMap.get(id)
  }

  getEntitiesWithComponent(ComponentClass) {
    return this.entities.filter(e =>
      e.active && e.hasComponent(ComponentClass)
    )
  }

  getEntitiesWithComponents(componentClasses) {
    return this.entities.filter(e => {
      if (!e.active) return false
      return componentClasses.every(C => e.hasComponent(C))
    })
  }

  getPlayerEntities() {
    return this.getEntitiesWithComponent(PlayerComponent)
  }

  getEnemyEntities() {
    return this.getEntitiesWithComponents([AIComponent, HealthComponent])
  }

  removeEntity(entity) {
    entity.active = false
    entity.dead = true
    const index = this.entities.indexOf(entity)
    if (index !== -1) {
      this.entities.splice(index, 1)
    }
    this.entityMap.delete(entity.id)
  }

  removeDeadEntities() {
    const dead = this.entities.filter(e => e.dead)
    for (const entity of dead) {
      this.removeEntity(entity)
    }
    return dead.length
  }

  // ========== Системы ==========

  addSystem(system) {
    this.systems.push(system)
    system.engine = this
    return this
  }

  update(dt) {
    // Обновляем все системы
    for (const system of this.systems) {
      if (system.enabled !== false) {
        system.update(dt)
      }
    }

    // Удаляем мертвые сущности
    this.removeDeadEntities()
  }

  // ========== Поиск ==========

  getEntitiesAt(tileX, tileY) {
    return this.entities.filter(e => {
      const pos = e.getComponent(PositionComponent)
      return pos && pos.occupies(tileX, tileY) && e.active
    })
  }

  getFirstEntityAt(tileX, tileY) {
    const entities = this.getEntitiesAt(tileX, tileY)
    return entities.length > 0 ? entities[0] : null
  }

  getBlockedCells(excludeEntity = null) {
    const blocked = []
    for (const entity of this.entities) {
      if (!entity.active) continue
      if (entity === excludeEntity) continue
      const pos = entity.getComponent(PositionComponent)
      if (pos) {
        blocked.push({ x: pos.tileX, y: pos.tileY })
      }
    }
    return blocked
  }

  isTileBlocked(tileX, tileY, excludeEntity = null) {
    for (const entity of this.entities) {
      if (!entity.active) continue
      if (entity === excludeEntity) continue
      const pos = entity.getComponent(PositionComponent)
      if (pos && pos.occupies(tileX, tileY)) {
        return true
      }
    }
    return false
  }

  // ========== Очистка ==========

  clear() {
    this.entities = []
    this.entityMap.clear()
  }
}
