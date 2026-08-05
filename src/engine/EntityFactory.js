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
import { GameConfig } from '../game/GameConfig.js'

export default class EntityFactory {

  static createPlayer(x, y, config = {}) {
    const playerConfig = GameConfig.getPlayerConfig()

    const entity = new Entity('player')
    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent(
        GameConfig.getSymbol('player'),
        GameConfig.getColor('player')
      ))
      .addComponent(new HealthComponent(
        config.hp || playerConfig.startHp,
        config.maxHp || playerConfig.startMaxHp
      ))
      .addComponent(new CombatComponent({
        damageMin: config.damageMin || playerConfig.damageMin,
        damageMax: config.damageMax || playerConfig.damageMax,
        damageType: 'physical',
        attackRange: playerConfig.attackRange,
        accuracy: playerConfig.accuracy,
        initiative: playerConfig.initiative
      }))
      .addComponent(new PlayerComponent())
      .addComponent(new MovementComponent(playerConfig.speed))
      .addComponent(new InventoryComponent())
    return entity
  }

  static createEnemy(x, y, type, enemyData) {
    const data = enemyData || GameConfig.getEnemy(type)
    if (!data) {
      console.warn(`[EntityFactory] Неизвестный тип врага: ${type}`)
      return null
    }

    const char = data.char || GameConfig.getSymbol('enemies', type) || '?'
    const color = data.color || GameConfig.getColor('enemies', type) || '#ffffff'

    const entity = new Entity('enemy')
    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent(char, color))
      .addComponent(new HealthComponent(data.hp, data.hp))
      .addComponent(new CombatComponent({
        damageMin: data.damageMin,
        damageMax: data.damageMax,
        damageType: data.damageType || 'physical',
        attackRange: data.range || 1,
        accuracy: data.accuracy || 0.7,
        initiative: data.initiative || 5
      }))
      .addComponent(new AIComponent({
        type: 'aggressive',
        fovRadius: data.fovRadius || 8
      }))
      .addComponent(new MovementComponent(12))

    entity.enemyType = type
    entity.enemyData = data
    return entity
  }

  static createWall(x, y) {
    const entity = new Entity('wall')
    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(new RenderComponent(
        GameConfig.getSymbol('wall'),
        GameConfig.getColor('wall')
      ))
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

    const closedChar = options.closedChar || GameConfig.getSymbol('door', 'closed')
    const openChar = options.openChar || GameConfig.getSymbol('door', 'open')
    const closedColor = options.closedColor || GameConfig.getColor('door', 'closed')
    const openColor = options.openColor || GameConfig.getColor('door', 'open')

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
      .addComponent(new RenderComponent(
        GameConfig.getSymbol('crate'),
        GameConfig.getColor('crate')
      ))
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
    const itemData = GameConfig.getItem(itemType) || GameConfig.getItem('generic')

    const char = config.char || itemData.char || '?'
    const color = config.color || itemData.color || '#ffffff'
    const name = config.name || itemData.name || 'Предмет'

    const entity = new Entity('item')
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
        itemType: itemType || 'generic'
      }))

    entity.itemData = itemData
    entity.itemType = itemType || 'generic'

    const render = entity.getComponent(RenderComponent)
    if (render) render.layer = 2
    return entity
  }
}
