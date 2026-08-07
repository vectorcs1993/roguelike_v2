// src/engine/EntityFactory.js

import Entity from './Entity.js'
import PositionComponent from './components/PositionComponent.js'
import RenderComponent from './components/RenderComponent.js'
import HealthComponent from './components/HealthComponent.js'
import HungerComponent from './components/HungerComponent.js'
import EnergyComponent from './components/EnergyComponent.js'
import CombatComponent from './components/CombatComponent.js'
import PlayerComponent from './components/PlayerComponent.js'
import AIComponent from './components/AIComponent.js'
import MovementComponent from './components/MovementComponent.js'
import InventoryComponent from './components/InventoryComponent.js'
import EnvironmentComponent from './components/EnvironmentComponent.js'
import DoorComponent from './components/DoorComponent.js'
import ItemComponent from './components/ItemComponent.js'
import StairComponent from './components/StairComponent.js'
import Item from './Item.js'
import { GameConfig } from '../game/GameConfig.js'
import { logger, LOG_MODULES } from '../game/Logger.js'

export default class EntityFactory {

  static createPlayer(x, y) {
    const playerData = GameConfig.getPlayer()

    const entity = new Entity('player')
    const render = new RenderComponent(
      playerData.char,
      playerData.color,
      playerData.bgColor
    )
    render.layer = playerData.layer || 4
    render.visible = true
    render.explored = true

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(render)
      .addComponent(new HealthComponent(
        playerData.hp,
        playerData.maxHp
      ))
      .addComponent(new HungerComponent({
        hunger: playerData.hunger,
        maxHunger: playerData.maxHunger,
      }))
      .addComponent(new EnergyComponent({
        energy: playerData.energy,
        maxEnergy: playerData.maxEnergy,
      }))
      .addComponent(new CombatComponent({
        damageMin: playerData.damageMin,
        damageMax: playerData.damageMax,
        damageType: playerData.damageType,
        attackRange: playerData.range,
        accuracy: playerData.accuracy,
        initiative: playerData.initiative,
      }))
      .addComponent(new PlayerComponent({
        speed: playerData.speed
      }))
      .addComponent(new MovementComponent({
        speed: playerData.speed
      }))
      .addComponent(new InventoryComponent({
        maxWeight: playerData.maxCarryWeight || 50,
        currentWeight: 0
      }))

    entity.enemyData = playerData

    return entity
  }

  static createEnemy(x, y, type, enemyData, biomeId = null) {
    const data = enemyData || GameConfig.getEnemy(type)
    if (!data) {
      logger.warn(LOG_MODULES.SYSTEM, `[EntityFactory] Неизвестный тип врага: ${type}`)
      return null
    }

    const char = data.char || '?'
    const color = data.color || '#ffffff'
    const bgColor = data.bgColor || null
    const layer = data.layer || 3

    const entity = new Entity('enemy')
    const render = new RenderComponent(char, color, bgColor)
    render.layer = layer

    this._applyVisibility(render, 'enemy', type, biomeId)

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(render)
      .addComponent(new HealthComponent(data.hp, data.maxHp || data.hp))
      .addComponent(new CombatComponent({
        damageMin: data.damageMin || 1,
        damageMax: data.damageMax || 3,
        damageType: data.damageType || 'physical',
        attackRange: data.range || 1,
        accuracy: data.accuracy || 0.7,
        initiative: data.initiative || 5
      }))
      .addComponent(new AIComponent({
        type: data.aiType || 'aggressive',
        aggressionRange: data.aggressionRange || 8,
        fovRadius: data.fovRadius || 8
      }))
      .addComponent(new MovementComponent({
        speed: data.speed
      }))
      .addComponent(new InventoryComponent({
        maxWeight: data.maxCarryWeight || 20,
        currentWeight: 0
      }))

    entity.enemyType = type
    entity.enemyData = data

    return entity
  }

  static createFloor(x, y, biomeId = null) {
    const envData = GameConfig.getEnvironment('floor')
    const entity = new Entity('floor')
    const render = new RenderComponent(
      envData.char,
      envData.color,
      envData.bgColor
    )
    render.layer = envData.layer || 0

    this._applyVisibility(render, 'environment', 'floor', biomeId)

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(render)
      .addComponent(new EnvironmentComponent({
        type: 'floor',
        solid: envData.solid || false,
        blocksSight: envData.blocksSight || false,
        isInteractive: envData.isInteractive || false,
        isCollectible: envData.isCollectible || false,
        name: envData.name || 'Пол'
      }))
    return entity
  }

  static createWall(x, y, biomeId = null) {
    const envData = GameConfig.getEnvironment('wall')
    const entity = new Entity('wall')
    const render = new RenderComponent(
      envData.char,
      envData.color,
      envData.bgColor
    )
    render.layer = envData.layer || 1

    this._applyVisibility(render, 'environment', 'wall', biomeId)

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(render)
      .addComponent(new EnvironmentComponent({
        type: 'wall',
        solid: envData.solid || true,
        blocksSight: envData.blocksSight || true,
        isInteractive: envData.isInteractive || false,
        isCollectible: envData.isCollectible || false,
        name: envData.name || 'Стена'
      }))
    return entity
  }

  static createDoor(x, y, locked = false, options = {}, biomeId = null) {
    const envData = GameConfig.getEnvironment('door')
    const closedState = envData.states?.closed || { char: '+', color: '#aa8866', bgColor: '#332211', solid: true, blocksSight: true }
    const openState = envData.states?.open || { char: '/', color: '#88cc88', bgColor: '#112211', solid: false, blocksSight: false }

    const entity = new Entity('door')

    const closedChar = options.closedChar || closedState.char
    const openChar = options.openChar || openState.char
    const closedColor = options.closedColor || closedState.color
    const openColor = options.openColor || openState.color
    const closedBgColor = options.closedBgColor || closedState.bgColor
    const openBgColor = options.openBgColor || openState.bgColor
    const layer = options.layer || envData.layer || 1

    const render = new RenderComponent(closedChar, closedColor, closedBgColor)
    render.layer = layer

    this._applyVisibility(render, 'environment', 'door', biomeId)

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(render)
      .addComponent(new EnvironmentComponent({
        type: 'door',
        solid: closedState.solid !== undefined ? closedState.solid : true,
        blocksSight: closedState.blocksSight !== undefined ? closedState.blocksSight : true,
        isInteractive: envData.isInteractive || true,
        isCollectible: envData.isCollectible || false,
        name: locked ? 'Запертая дверь' : 'Дверь'
      }))
      .addComponent(new DoorComponent({
        isOpen: false,
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

  static createCrate(x, y, biomeId = null) {
    const envData = GameConfig.getEnvironment('crate')
    const entity = new Entity('crate')
    const render = new RenderComponent(
      envData.char || '■',
      envData.color || '#aa8844',
      envData.bgColor || '#332211'
    )
    render.layer = envData.layer || 1

    this._applyVisibility(render, 'environment', 'crate', biomeId)

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(render)
      .addComponent(new EnvironmentComponent({
        type: 'crate',
        solid: envData.solid !== undefined ? envData.solid : true,
        blocksSight: envData.blocksSight || false,
        isInteractive: envData.isInteractive || true,
        isCollectible: envData.isCollectible || false,
        name: envData.name || 'Ящик'
      }))
    return entity
  }

  static createItem(x, y, itemType, config = {}, biomeId = null) {
    const baseData = GameConfig.getItem(itemType) || GameConfig.getItem('generic')

    const char = config.char || baseData.char || '?'
    const color = config.color || baseData.color || '#ffffff'
    const bgColor = config.bgColor || baseData.bgColor || null
    const name = config.name || baseData.name || 'Предмет'
    const layer = config.layer || baseData.layer || 2
    const count = config.count !== undefined ? config.count : 1
    const weight = config.weight !== undefined ? config.weight : (baseData.weight || 0)

    const item = new Item({
      ...baseData,
      type: itemType || baseData.type || 'generic',
      name,
      char,
      color,
      bgColor,
      layer,
      weight: weight,
      effects: config.effects || baseData.effects || {},
      usable: config.usable !== undefined ? config.usable : baseData.usable,
      description: config.description !== undefined ? config.description : baseData.description
    }, count)

    const entity = new Entity('item')
    const render = new RenderComponent(char, color, bgColor)
    render.layer = layer

    this._applyVisibility(render, 'item', itemType, biomeId)

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
      .addComponent(new ItemComponent({ item }))

    return entity
  }

  static createStair(x, y, direction = 'down', targetBiome = null, targetLevel = null, biomeId = null) {
    const isUp = direction === 'up'
    const char = isUp ? '<' : '>'
    const color = isUp ? '#88ff88' : '#ff8844'
    const bgColor = isUp ? '#1a2a1a' : '#2a1a0a'
    const layer = 2

    const entity = new Entity('stair')
    const render = new RenderComponent(char, color, bgColor)
    render.layer = layer

    // ИСПОЛЬЗУЕМ ОБЩУЮ СИСТЕМУ ВИДИМОСТИ
    this._applyVisibility(render, 'environment', 'stair', biomeId)

    entity
      .addComponent(new PositionComponent(x, y))
      .addComponent(render)
      .addComponent(new StairComponent({
        direction: direction,
        targetBiome: targetBiome,
        targetLevel: targetLevel
      }))

    return entity
  }

  static _applyVisibility(render, entityType, entityId, biomeId) {
    const visibilityConfig = GameConfig.getVisibilityConfig(entityType, entityId, biomeId)
    render.visible = visibilityConfig.visibleByDefault || false
    render.explored = visibilityConfig.exploredByDefault || false
    render._visibilityConfig = visibilityConfig
  }

}
