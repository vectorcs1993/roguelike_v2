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
import EnvironmentComponent from './components/EnvironmentComponent.js'
import DoorComponent from './components/DoorComponent.js'
import ItemComponent from './components/ItemComponent.js'
import { GAME_DATA } from '../game/GameData.js'

export default class EntityFactory {

  static createPlayer(x, y, config = {}) {
    const entity = new Entity('player')
    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent(GAME_DATA.symbols.player, GAME_DATA.colors.player))
      .addComponent(new HealthComponent(config.hp || 25, config.maxHp || 25))
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
      .addComponent(new InventoryComponent())
    return entity
  }

  static createEnemy(x, y, type, enemyData) {
    const entity = new Entity('enemy')
    const char = GAME_DATA.symbols.enemies[type] || '?'
    const color = GAME_DATA.colors.enemies[type] || '#ffffff'

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent(char, color))
      .addComponent(new HealthComponent(enemyData.hp, enemyData.hp))
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

  static createWall(x, y) {
    const entity = new Entity('wall')
    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent(GAME_DATA.symbols.wall, GAME_DATA.colors.wall))
      .addComponent(new EnvironmentComponent({
        type: 'wall',
        solid: true,
        blocksSight: true,
        name: 'Стена'
      }))
    const render = entity.getComponent(RenderComponent)
    if (render) render.layer = 1
    return entity
  }

  static createDoor(x, y, locked = false, options = {}) {
    const entity = new Entity('door')
    const closedChar = options.closedChar || GAME_DATA.symbols.door.closed
    const openChar = options.openChar || GAME_DATA.symbols.door.open
    const closedColor = options.closedColor || GAME_DATA.colors.door.closed
    const openColor = options.openColor || GAME_DATA.colors.door.open

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent(closedChar, closedColor))
      .addComponent(new EnvironmentComponent({
        type: 'door',
        solid: true,
        blocksSight: true,
        isInteractive: true,
        name: locked ? 'Запертая дверь' : 'Дверь'
      }))
      .addComponent(new DoorComponent({
        isLocked: locked,
        closedChar,
        openChar,
        closedColor,
        openColor
      }))
    const render = entity.getComponent(RenderComponent)
    if (render) render.layer = 1
    return entity
  }

  static createCrate(x, y) {
    const entity = new Entity('crate')
    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent(GAME_DATA.symbols.crate, GAME_DATA.colors.crate))
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
    const charMap = GAME_DATA.symbols.items
    const colorMap = GAME_DATA.colors.items
    const nameMap = {
      health: '💊 Аптечка',
      mana: '⚡ Батарея',
      weapon: '🔫 Оружие',
      armor: '🛡️ Броня',
      gold: '💰 Золото',
      potion: '🧪 Зелье',
      scroll: '📜 Свиток',
      generic: '📦 Предмет'
    }

    const type = itemType || 'generic'
    const char = config.char || charMap[type] || '?'
    const color = config.color || colorMap[type] || '#ffffff'
    const name = config.name || nameMap[type] || 'Предмет'

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent(char, color))
      .addComponent(new EnvironmentComponent({
        type: 'item',
        solid: false,
        blocksSight: false,
        isCollectible: true,
        isInteractive: true,
        name: name
      }))
      .addComponent(new ItemComponent({
        itemType: type
      }))
    const render = entity.getComponent(RenderComponent)
    if (render) render.layer = 2
    return entity
  }
}
