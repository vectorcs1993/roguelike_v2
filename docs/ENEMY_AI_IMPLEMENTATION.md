# План реализации ИИ для врагов

## Обзор
Реализация системы искусственного интеллекта для врагов в roguelike игре. Враги должны иметь различные поведения: ожидание/блуждание, патрулирование, охрана, и боевые действия при обнаружении игрока.

## Текущее состояние
- Враги уже имеют радиус обзора (`fovRadius`)
- Враги враждебны к команде игрока
- У врагов есть система очков действий (AP)
- Некоторые враги имеют дальнюю атаку
- Класс `EnemyTeam` имеет пустой метод `update()`

## Архитектура ИИ

### 1. Класс EnemyAI
Создать новый файл `src/game/EnemyAI.js` с классами:
- `AI_STATE`: IDLE, ALERT, COMBAT, FLEE
- `BEHAVIOR_TYPE`: WANDER, GUARD, PATROL
- `EnemyAI`: основной класс ИИ

### 2. Интеграция с EnemyTeam
Обновить `EnemyTeam.js`:
- Добавить создание экземпляра `EnemyAI` для каждого врага
- Реализовать метод `update()` для обновления ИИ всех врагов команды

### 3. Боевая система
Интегрировать с существующей системой атаки:
- Использовать данные из `EnemyData.js` (damage, range, accuracy)
- Реализовать проверку линии видимости для дальних атак
- Учитывать стоимость AP для атак

### 4. Система восприятия
- Использовать существующую систему FOV (`tile.visible`)
- Добавить память о последней известной позиции врага
- Реализовать постепенное снижение настороженности

## Детальный план реализации

### Файл 1: `src/game/EnemyAI.js`
```javascript
// Основные состояния ИИ
export const AI_STATE = { IDLE, ALERT, COMBAT, FLEE }

// Типы поведения
export const BEHAVIOR_TYPE = { WANDER, GUARD, PATROL }

// Основной класс EnemyAI
export default class EnemyAI {
  constructor(character, config)
  update(dt, map, allCharacters)
  updatePerception(map, allCharacters)
  getVisibleEnemies(map, allCharacters)
  selectBestTarget(enemies)
  executeIdleBehavior(dt, map)
  wander(dt, map)
  patrol(dt, map)
  executeCombatBehavior(dt, map, allCharacters)
  tryAttack(target, map)
  performAttack(target)
  moveTowards(targetX, targetY, map)
  // ... вспомогательные методы
}
```

### Файл 2: `src/game/EnemyTeam.js` (обновление)
```javascript
import EnemyAI from './EnemyAI.js'

export default class EnemyTeam extends Team {
  constructor(config) {
    super(config)
    this.aiInstances = new Map() // character.id -> EnemyAI
  }

  addCharacter(character) {
    super.addCharacter(character)
    // Создаём ИИ для врага
    const ai = new EnemyAI(character, {
      behavior: this.getBehaviorForCharacter(character),
      wanderRadius: 5,
      aggressiveness: 0.8
    })
    this.aiInstances.set(character.id, ai)
  }

  removeCharacter(character) {
    super.removeCharacter(character)
    this.aiInstances.delete(character.id)
  }

  update(dt, map, allCharacters) {
    for (const character of this.characters) {
      const ai = this.aiInstances.get(character.id)
      if (ai && character.currentAP > 0) {
        ai.update(dt, map, allCharacters)
      }
    }
  }

  getBehaviorForCharacter(character) {
    // Логика определения поведения на основе типа врага
    // Например, стражи стоят на месте, патрульные ходят
    return EnemyAI.BEHAVIOR_TYPE.WANDER
  }
}
```

### Файл 3: Обновление `EnemyData.js`
Добавить поля для настройки ИИ:
```javascript
[ENEMY_TYPES.GROANER]: {
  // ... существующие поля
  aiBehavior: 'wander',
  aiAggressiveness: 0.7,
  aiWanderRadius: 5
}

[ENEMY_TYPES.MOLD]: {
  // ... существующие поля  
  aiBehavior: 'guard',
  aiAggressiveness: 0.5,
  aiPreferRanged: true
}
```

### Файл 4: Интеграция с системой боя
Создать или обновить систему боя для обработки атак ИИ:
- Метод `Character.attack(target)`
- Учёт точности, урона, типа атаки
- Расход AP

## Приоритеты реализации

### Фаза 1: Базовый ИИ (1-2 часа)
1. Создать `EnemyAI.js` с основными состояниями
2. Обновить `EnemyTeam.js` для использования ИИ
3. Реализовать блуждание и простую атаку

### Фаза 2: Улучшения (1-2 часа)
1. Добавить поддержку дальних атак
2. Реализовать патрулирование и охрану
3. Добавить память о позиции врага

### Фаза 3: Полировка (1 час)
1. Балансировка параметров ИИ
2. Добавить различные поведения для разных типов врагов
3. Тестирование и отладка

## Тестирование
1. Запустить игру и проверить, что враги двигаются
2. Подойти к врагу и проверить реакцию
3. Проверить дальние атаки
4. Проверить расход AP
5. Проверить различные типы поведения

## Потенциальные проблемы и решения
1. **Производительность**: ИИ обновляется только когда у врага есть AP
2. **Конфликты путей**: Использовать существующий Pathfinder
3. **Линия видимости**: Использовать алгоритм Брезенхэма
4. **Баланс**: Настроить параметры агрессивности и осторожности

## Документация
1. Комментарии в коде на русском языке
2. Описание параметров ИИ в `EnemyData.js`
3. Примеры использования в README

## Следующие шаги
После реализации этого плана можно добавить:
- Кооперативное поведение врагов
- Использование окружения (укрытия)
- Специальные способности ИИ
- Динамическую адаптацию к стилю игры игрока