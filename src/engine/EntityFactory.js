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
        damageType: config.damageType || playerData.damageType || 'physical',
        attackRange: config.attackRange || playerData.range || 1,
        accuracy: config.accuracy || playerData.accuracy || 0.75,
        initiative: config.initiative || playerData.initiative || 6
      }))
      .addComponent(new PlayerComponent())
      .addComponent(new MovementComponent(config.speed || playerData.speed || 12))
      .addComponent(new InventoryComponent())

    // Добавляем кастомные компоненты из конфига
    if (config.components) {
      this._addCustomComponents(entity, config.components)
    }

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
    const speed = data.speed || 12 // Используем скорость из конфига

    const entity = new Entity('enemy')
    const render = new RenderComponent(char, color, bgColor)
    render.layer = layer

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
        aggressionRange: data.aggressionRange || data.fovRadius || 8,
        fovRadius: data.fovRadius || 8
      }))
      .addComponent(new MovementComponent(speed))

    entity.enemyType = type
    entity.enemyData = data

    // Добавляем кастомные компоненты из данных врага
    if (data.components) {
      this._addCustomComponents(entity, data.components)
    }

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
        solid: envData.solid || false,
        blocksSight: envData.blocksSight || false,
        isInteractive: envData.isInteractive || false,
        isCollectible: envData.isCollectible || false,
        name: envData.name || 'Пол'
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
        solid: envData.solid || true,
        blocksSight: envData.blocksSight || true,
        isInteractive: envData.isInteractive || false,
        isCollectible: envData.isCollectible || false,
        name: envData.name || 'Стена'
      }))
    return entity
  }

  static createDoor(x, y, locked = false, options = {}) {
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

  static createCrate(x, y) {
    const envData = GameConfig.getEnvironment('crate')
    const entity = new Entity('crate')
    const render = new RenderComponent(
      envData.char || '■',
      envData.color || '#aa8844',
      envData.bgColor || '#332211'
    )
    render.layer = envData.layer || 1

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

  static createItem(x, y, itemType, config = {}) {
    const itemData = GameConfig.getItem(itemType) || GameConfig.getItem('generic')

    const char = config.char || itemData.char || '?'
    const color = config.color || itemData.color || '#ffffff'
    const bgColor = config.bgColor || itemData.bgColor || null
    const name = config.name || itemData.name || 'Предмет'
    const layer = config.layer || itemData.layer || 2

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

    // Добавляем эффекты предмета как данные
    if (itemData.effects) {
      entity.itemEffects = { ...itemData.effects }
    }

    return entity
  }

  // ===== ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ КАСТОМНЫХ КОМПОНЕНТОВ =====

  static _addCustomComponents(entity, components) {
    if (!components || typeof components !== 'object') return

    // Импортируем все компоненты динамически
    const componentMap = {
      'PositionComponent': PositionComponent,
      'RenderComponent': RenderComponent,
      'HealthComponent': HealthComponent,
      'CombatComponent': CombatComponent,
      'PlayerComponent': PlayerComponent,
      'AIComponent': AIComponent,
      'MovementComponent': MovementComponent,
      'InventoryComponent': InventoryComponent,
      'EnvironmentComponent': EnvironmentComponent,
      'DoorComponent': DoorComponent,
      'ItemComponent': ItemComponent
    }

    for (const [name, data] of Object.entries(components)) {
      const ComponentClass = componentMap[name]
      if (!ComponentClass) {
        console.warn(`[EntityFactory] Неизвестный компонент: ${name}`)
        continue
      }

      let instance
      if (data instanceof ComponentClass) {
        instance = data
      } else if (typeof data === 'object') {
        // Создаем экземпляр с переданными данными
        try {
          instance = new ComponentClass(data)
        } catch (e) {
          console.warn(`[EntityFactory] Не удалось создать компонент ${name}:`, e)
          continue
        }
      } else {
        // Простое значение - передаем как аргумент
        try {
          instance = new ComponentClass(data)
        } catch (e) {
          console.warn(`[EntityFactory] Не удалось создать компонент ${name}:`, e)
          continue
        }
      }

      entity.addComponent(instance)
    }
  }

  // ===== МЕТОДЫ ДЛЯ ПАРТИЙ =====

  static createEnemyParty(x, y, enemies) {
    const party = []
    const positions = []

    // Определяем позиции для группы
    const offsets = [
      [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1]
    ]

    for (let i = 0; i < enemies.length && i < offsets.length; i++) {
      const [dx, dy] = offsets[i]
      const ex = x + dx
      const ey = y + dy

      const enemyType = typeof enemies[i] === 'string' ? enemies[i] : enemies[i].type
      const enemyConfig = typeof enemies[i] === 'string' ? {} : enemies[i].config || {}

      const entity = this.createEnemy(ex, ey, enemyType, enemyConfig)
      if (entity) {
        party.push(entity)
        positions.push({ x: ex, y: ey })
      }
    }

    return { entities: party, positions }
  }

  // ===== МЕТОДЫ ДЛЯ КЛАДОВ =====

  static createLoot(x, y, lootTable, count = 1) {
    const items = []
    const itemData = []

    for (let i = 0; i < count; i++) {
      // Выбираем предмет из таблицы
      let totalWeight = 0
      for (const entry of lootTable) {
        totalWeight += entry.chance || 1
      }

      let r = Math.random() * totalWeight
      let selected = lootTable[0]
      for (const entry of lootTable) {
        r -= (entry.chance || 1)
        if (r <= 0) {
          selected = entry
          break
        }
      }

      const itemType = selected.id || selected.type
      const config = selected.config || {}

      const entity = this.createItem(
        x + (Math.random() - 0.5) * 0.5,
        y + (Math.random() - 0.5) * 0.5,
        itemType,
        config
      )

      if (entity) {
        items.push(entity)
        itemData.push({ type: itemType, ...config })
      }
    }

    return { entities: items, items: itemData }
  }
}
