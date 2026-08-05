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

export default class EntityFactory {
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

  static createItem(x, y, itemType, config = {}) {
    const entity = new Entity('item')

    const itemChars = {
      health: '♥',
      mana: '♦',
      weapon: '⚔',
      armor: '♠',
      gold: '$',
      potion: '!',
      scroll: '?'
    }

    const itemColors = {
      health: '#ff4444',
      mana: '#4444ff',
      weapon: '#ffaa44',
      armor: '#44aaff',
      gold: '#ffdd44',
      potion: '#ff66ff',
      scroll: '#88ff88'
    }

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent(
        itemChars[itemType] || '•',
        itemColors[itemType] || '#aaaaaa'
      ))

    // Добавляем компонент предмета
    entity.addComponent({
      constructor: { name: 'ItemComponent' },
      itemType: itemType,
      config: config,
      collected: false,
      get name() {
        const names = {
          health: '💊 Аптечка',
          mana: '⚡ Батарея',
          weapon: '🔫 Оружие',
          armor: '🛡️ Броня',
          gold: '💰 Золото',
          potion: '🧪 Зелье',
          scroll: '📜 Свиток'
        }
        return names[this.itemType] || '📦 Предмет'
      }
    })

    return entity
  }

  static createDoor(x, y, locked = false) {
    const entity = new Entity('door')

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent('+', '#aa8866'))

    entity.addComponent({
      constructor: { name: 'DoorComponent' },
      isOpen: false,
      isLocked: locked,
      open() {
        if (this.isOpen || this.isLocked) return false
        this.isOpen = true
        const render = entity.getComponent(RenderComponent)
        if (render) {
          render.char = '/'
          render.color = '#88aa66'
        }
        return true
      },
      close() {
        if (!this.isOpen) return false
        this.isOpen = false
        const render = entity.getComponent(RenderComponent)
        if (render) {
          render.char = '+'
          render.color = '#aa8866'
        }
        return true
      },
      toggle() {
        return this.isOpen ? this.close() : this.open()
      }
    })

    return entity
  }
}
