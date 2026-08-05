// src/engine/EntityFactory.js

import Entity from './Entity.js'
import PositionComponent from './components/PositionComponent.js'
import RenderComponent from './components/RenderComponent.js'
import HealthComponent from './components/HealthComponent.js'
import CombatComponent from './components/CombatComponent.js'
import PlayerComponent from './components/PlayerComponent.js'
import AIComponent from './components/AIComponent.js'
import MovementComponent from './components/MovementComponent.js'
import InventoryComponent from './components/InventoryComponent.js'

// Новые компоненты для окружения
import EnvironmentComponent from './components/EnvironmentComponent.js'
import DoorComponent from './components/DoorComponent.js'
import ItemComponent from './components/ItemComponent.js'

export default class EntityFactory {
  // ===== Существующие методы =====

  static createPlayer(x, y, config = {}) {
    const entity = new Entity('player')
    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent('@', '#88ff88'))
      .addComponent(new HealthComponent(
        config.hp || 25,
        config.maxHp || 25
      ))
      .addComponent(new CombatComponent({
        damageMin: config.damageMin || 3,
        damageMax: config.damageMax || 6,
        damageType: 'physical',
        attackRange: 1,
        accuracy: 0.75,
        initiative: 6
      }))
      .addComponent(new PlayerComponent())
      .addComponent(new MovementComponent(12))
      .addComponent(new InventoryComponent(20))
    return entity
  }

  static createEnemy(x, y, type, enemyData) {
    const entity = new Entity('enemy')
    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent(
        enemyData.char,
        enemyData.color
      ))
      .addComponent(new HealthComponent(
        enemyData.hp,
        enemyData.hp
      ))
      .addComponent(new CombatComponent({
        damageMin: enemyData.damageMin,
        damageMax: enemyData.damageMax,
        damageType: enemyData.damageType || 'physical',
        attackRange: enemyData.range || 1,
        accuracy: enemyData.accuracy || 0.7,
        initiative: enemyData.initiative || 5
      }))
      .addComponent(new AIComponent({
        type: 'aggressive',
        fovRadius: enemyData.fovRadius || 8
      }))
      .addComponent(new MovementComponent(12))
    return entity
  }

  // ===== НОВЫЕ МЕТОДЫ для объектов окружения =====

  static createWall(x, y) {
    const entity = new Entity('wall')
    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent('#', '#666666'))
      .addComponent(new EnvironmentComponent({
        type: 'wall',
        solid: true,
        blocksSight: true,
        name: 'Стена'
      }))
    // Устанавливаем слой для рендера (стены ниже сущностей)
    const render = entity.getComponent(RenderComponent)
    if (render) render.layer = 1
    return entity
  }

  static createDoor(x, y, locked = false) {
    const entity = new Entity('door')
    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent('+', '#aa8866'))
      .addComponent(new EnvironmentComponent({
        type: 'door',
        solid: true,
        blocksSight: true,
        isInteractive: true,
        name: locked ? 'Запертая дверь' : 'Дверь'
      }))
      .addComponent(new DoorComponent({ isLocked: locked }))
    const render = entity.getComponent(RenderComponent)
    if (render) render.layer = 1
    return entity
  }

  static createCrate(x, y) {
    const entity = new Entity('crate')
    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent('■', '#aa8844'))
      .addComponent(new EnvironmentComponent({
        type: 'crate',
        solid: true,
        blocksSight: false,
        isInteractive: true,
        name: 'Ящик'
      }))
    const render = entity.getComponent(RenderComponent)
    if (render) render.layer = 1
    return entity
  }

  static createItem(x, y, itemType, config = {}) {
    const entity = new Entity('item')
    const charMap = {
      health: '♥', mana: '♦', weapon: '⚔', armor: '♠',
      gold: '$', potion: '!', scroll: '?'
    }
    const colorMap = {
      health: '#ff4444', mana: '#4444ff', weapon: '#ffaa44',
      armor: '#44aaff', gold: '#ffdd44', potion: '#ff66ff',
      scroll: '#88ff88'
    }
    const nameMap = {
      health: '💊 Аптечка', mana: '⚡ Батарея', weapon: '🔫 Оружие',
      armor: '🛡️ Броня', gold: '💰 Золото', potion: '🧪 Зелье',
      scroll: '📜 Свиток'
    }

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent(
        charMap[itemType] || '•',
        colorMap[itemType] || '#aaaaaa'
      ))
      .addComponent(new EnvironmentComponent({
        type: 'item',
        solid: false,
        blocksSight: false,
        isCollectible: true,
        name: config.name || nameMap[itemType] || 'Предмет'
      }))
      .addComponent(new ItemComponent({
        itemType,
        onCollect: config.onCollect || null
      }))
    const render = entity.getComponent(RenderComponent)
    if (render) render.layer = 2 // предметы выше стен
    return entity
  }
}
