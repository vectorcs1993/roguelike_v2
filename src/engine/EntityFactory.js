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
    const playerData = GameConfig.getPlayer()

    const entity = new Entity('player')
    const render = new RenderComponent(
      config.char || playerData.char,
      config.color || playerData.color,
      config.bgColor || playerData.bgColor || null
    )
    render.layer = playerData.layer || 4

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(render)
      .addComponent(new HealthComponent(
        config.hp || playerData.hp,
        config.maxHp || playerData.maxHp
      ))
      .addComponent(new CombatComponent({
        damageMin: config.damageMin || playerData.damageMin,
        damageMax: config.damageMax || playerData.damageMax,
        damageType: 'physical',
        attackRange: playerData.range,
        accuracy: playerData.accuracy,
        initiative: playerData.initiative
      }))
      .addComponent(new PlayerComponent())
      .addComponent(new MovementComponent(playerData.speed))
      .addComponent(new InventoryComponent())
    return entity
  }

  static createEnemy(x, y, type, enemyData) {
    const data = enemyData || GameConfig.getEnemy(type)
    if (!data) {
      console.warn(`[EntityFactory] Неизвестный тип врага: ${type}`)
      return null
    }

    const char = data.char || '?'
    const color = data.color || '#ffffff'
    const bgColor = data.bgColor || null
    const layer = data.layer || 3

    const entity = new Entity('enemy')
    const render = new RenderComponent(char, color, bgColor)
    render.layer = layer

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(render)
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

  static createFloor(x, y) {
    const envData = GameConfig.getEnvironment('floor')
    const entity = new Entity('floor')
    const render = new RenderComponent(
      envData.char,
      envData.color,
      envData.bgColor
    )
    render.layer = envData.layer || 0

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(render)
      .addComponent(new EnvironmentComponent({
        type: 'floor',
        solid: envData.solid,
        blocksSight: envData.blocksSight,
        isInteractive: envData.isInteractive,
        isCollectible: envData.isCollectible,
        name: envData.name
      }))
    return entity
  }

  static createWall(x, y) {
    const envData = GameConfig.getEnvironment('wall')
    const entity = new Entity('wall')
    const render = new RenderComponent(
      envData.char,
      envData.color,
      envData.bgColor
    )
    render.layer = envData.layer || 1

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(render)
      .addComponent(new EnvironmentComponent({
        type: 'wall',
        solid: envData.solid,
        blocksSight: envData.blocksSight,
        isInteractive: envData.isInteractive,
        isCollectible: envData.isCollectible,
        name: envData.name
      }))
    return entity
  }

  static createDoor(x, y, locked = false, options = {}) {
    const envData = GameConfig.getEnvironment('door')
    const closedState = envData.states.closed
    const openState = envData.states.open

    const entity = new Entity('door')

    const closedChar = options.closedChar || closedState.char
    const openChar = options.openChar || openState.char
    const closedColor = options.closedColor || closedState.color
    const openColor = options.openColor || openState.color
    const closedBgColor = options.closedBgColor || closedState.bgColor
    const openBgColor = options.openBgColor || openState.bgColor
    const layer = envData.layer || 1

    const render = new RenderComponent(closedChar, closedColor, closedBgColor)
    render.layer = layer

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(render)
      .addComponent(new EnvironmentComponent({
        type: 'door',
        solid: closedState.solid,
        blocksSight: closedState.blocksSight,
        isInteractive: envData.isInteractive,
        isCollectible: envData.isCollectible,
        name: locked ? 'Запертая дверь' : 'Дверь'
      }))
      .addComponent(new DoorComponent({
        isLocked: locked,
        closedChar,
        openChar,
        closedColor,
        openColor,
        closedBgColor,
        openBgColor,
        layer
      }))
    return entity
  }

  static createCrate(x, y) {
    const envData = GameConfig.getEnvironment('crate')
    const entity = new Entity('crate')
    const render = new RenderComponent(
      envData.char,
      envData.color,
      envData.bgColor
    )
    render.layer = envData.layer || 1

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(render)
      .addComponent(new EnvironmentComponent({
        type: 'crate',
        solid: envData.solid,
        blocksSight: envData.blocksSight,
        isInteractive: envData.isInteractive,
        isCollectible: envData.isCollectible,
        name: envData.name
      }))
    return entity
  }

  static createItem(x, y, itemType, config = {}) {
    const itemData = GameConfig.getItem(itemType) || GameConfig.getItem('generic')

    const char = config.char || itemData.char || '?'
    const color = config.color || itemData.color || '#ffffff'
    const bgColor = config.bgColor || itemData.bgColor || null
    const name = config.name || itemData.name || 'Предмет'
    const layer = itemData.layer || 2

    const entity = new Entity('item')
    const render = new RenderComponent(char, color, bgColor)
    render.layer = layer

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(render)
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
    return entity
  }
}
