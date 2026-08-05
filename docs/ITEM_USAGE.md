# Использование предметов и система эффектов

Данный документ описывает, как реализовано использование предметов, как
настраивать эффекты предметов в конфиге (core.json / моды) и как расширять
систему новыми эффектами.

---

## 1. Обзор архитектуры

Использование предметов реализовано через несколько модулей:

| Модуль | Файл | Назначение |
|--------|------|------------|
| `ItemEffects` | [`src/game/ItemEffects.js`](../src/game/ItemEffects.js) | Реестр обработчиков эффектов, применение эффектов к сущности |
| `PlayerActions.useItem()` | [`src/game/PlayerActions.js`](../src/game/PlayerActions.js) | Логика использования предмета из инвентаря |
| `GameLoop.useItem()` | [`src/game/GameLoop.js`](../src/game/GameLoop.js) | Делегирование действия из UI в `PlayerActions` |
| `InventoryComponent` | [`src/engine/components/InventoryComponent.js`](../src/engine/components/InventoryComponent.js) | Хранение предметов и их количества |
| `IndexPage.vue` | [`src/pages/IndexPage.vue`](../src/pages/IndexPage.vue) | Кнопка «Использовать» в блоке «Инвентарь» |

### Поток выполнения

```
Пользователь нажимает «Использовать» в UI
        │
        ▼
IndexPage.vue → useItem(itemId)
        │
        ▼
GameLoop.useItem(itemId)
        │
        ▼
PlayerActions.useItem(itemId)
        │  ├─ проверка хода игрока
        │  ├─ получение предмета из инвентаря
        │  ├─ проверка isItemUsable(itemData)
        │  ├─ applyItemEffects(entity, itemData, gameLoop)
        │  ├─ удаление одного предмета из инвентаря
        │  └─ завершение хода игрока
        ▼
ItemEffects.applyItemEffects() → для каждого эффекта вызывает обработчик
```

---

## 2. Конфигурация предмета

Предметы определяются в секции `items` файла `core.json` (или в модах).
Каждый предмет — это объект с полями. Для использования предмета ключевыми
являются поля `usable` и `effects`.

### 2.1. Базовые поля

```json
{
  "id": "potion_heal",
  "name": "Малое зелье лечения",
  "char": "♥",
  "color": "#ff6666",
  "bgColor": "#2a0a0a",
  "layer": 2,
  "type": "consumable",
  "category": "healing",
  "value": 8,
  "weight": 0.3,
  "usable": true,
  "effects": {
    "heal": 10
  },
  "description": "Восстанавливает 10 HP"
}
```

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `id` | string | да | Уникальный идентификатор предмета |
| `name` | string | да | Отображаемое имя |
| `char` | string | да | Символ на карте и в инвентаре |
| `color` | string | нет | Цвет символа (hex) |
| `bgColor` | string | нет | Цвет фона (hex) |
| `layer` | number | нет | Слой отрисовки |
| `type` | string | нет | Тип предмета (`consumable`, `weapon`, `armor`, `currency`, `misc`) |
| `category` | string | нет | Категория (`healing`, `mana`, `buff`, `scroll`, `melee`, `body`, `gold`, `other`) |
| `value` | number | нет | Базовая ценность |
| `weight` | number | нет | Вес (для генерации) |
| `usable` | boolean | нет | Можно ли использовать предмет. Если `true` — кнопка «Использовать» активна |
| `effects` | object | нет | Список эффектов, применяемых при использовании |
| `description` | string | нет | Описание предмета |

### 2.2. Поле `usable`

- `usable: true` — предмет можно использовать (кнопка «Использовать» отображается).
- `usable: false` — предмет нельзя использовать (например, валюта).
- Если поле не указано, но у предмета есть непустой `effects` — предмет считается
  используемым автоматически (см. `isItemUsable`).

### 2.3. Поле `effects`

Поле `effects` — это объект, где **ключ** — имя эффекта, а **значение** —
параметр эффекта. При использовании предмета каждый эффект применяется
последовательно.

```json
"effects": {
  "heal": 15,
  "restoreMana": 10
}
```

---

## 3. Встроенные эффекты

Ниже перечислены все встроенные эффекты, доступные «из коробки».
Обработчики находятся в [`src/game/ItemEffects.js`](../src/game/ItemEffects.js)
в объекте `EFFECT_HANDLERS`.

### 3.1. `heal` — восстановление здоровья

```json
"effects": { "heal": 15 }
```

Восстанавливает указанное количество HP. Не применяется, если здоровье уже
полное или сущность мертва.

### 3.2. `healPercent` — восстановление здоровья в процентах

```json
"effects": { "healPercent": 0.5 }
```

Восстанавливает указанный процент от максимального HP (0.5 = 50%).

### 3.3. `restoreMana` — восстановление энергии

```json
"effects": { "restoreMana": 10 }
```

Восстанавливает энергию. Энергия хранится в полях `entity.mana` и
`entity.maxMana` (по умолчанию `maxMana = 100`).

### 3.4. `damageBonus` — постоянный бонус к урону

```json
"effects": { "damageBonus": 3 }
```

Увеличивает `damageMin` и `damageMax` сущности на указанное значение.

### 3.5. `armorBonus` — постоянный бонус к броне

```json
"effects": { "armorBonus": 2 }
```

Увеличивает `armor` сущности на указанное значение.

### 3.6. `accuracyBonus` — постоянный бонус к точности

```json
"effects": { "accuracyBonus": 0.1 }
```

Увеличивает `accuracy` сущности (не более 1.0).

### 3.7. `buff` — временный бафф

```json
"effects": {
  "buff": "strength",
  "duration": 5
}
```

Активирует временный бафф на указанное количество ходов. Бафф хранится в
`entity.activeBuffs[buffName]`. Поддерживаемые баффы:

| Имя баффа | Эффект |
|-----------|--------|
| `strength` | Увеличивает урон |
| `armor` | Увеличивает броню |
| `accuracy` | Увеличивает точность |

> **Примечание:** в текущей реализации бафф применяется немедленно и хранится
> на сущности. Для полноценного учёта длительности (снятие баффа через N ходов)
> требуется обработка в системе ходов (см. раздел «Расширение»).

### 3.8. `teleport` — телепортация

```json
"effects": { "teleport": true }
```

Перемещает сущность в случайную проходимую клетку локации.

### 3.9. `selfDamage` — урон себе

```json
"effects": { "selfDamage": 5 }
```

Наносит урон использующему (например, для ядов). Можно указать тип урона через
поле `damageType` предмета.

---

## 4. Добавление нового эффекта

Система эффектов расширяемая. Чтобы добавить новый эффект, зарегистрируйте
обработчик через функцию `registerEffect`.

### 4.1. Регистрация в коде

```js
import { registerEffect } from 'src/game/index.js'

registerEffect('myEffect', (ctx) => {
  // ctx: { entity, itemData, value, duration, buffValue, damageType,
  //        gameLoop, location, engine, logger }
  const health = ctx.entity.getComponent(HealthComponent)
  if (!health) return false
  health.heal(Number(ctx.value) || 0)
  return 'Здоровье восстановлено'
})
```

Обработчик должен вернуть:
- `true` — эффект применён (предмет будет израсходован);
- `false` — эффект не применён (предмет останется в инвентаре);
- строку — эффект применён, строка будет выведена в лог.

### 4.2. Добавление в `EFFECT_HANDLERS`

Также можно добавить обработчик напрямую в объект `EFFECT_HANDLERS` в
[`src/game/ItemEffects.js`](../src/game/ItemEffects.js):

```js
export const EFFECT_HANDLERS = {
  // ... существующие обработчики
  myEffect(ctx) {
    // логика
    return true
  }
}
```

### 4.3. Использование в конфиге

После регистрации эффект можно использовать в конфиге предмета:

```json
{
  "id": "my_item",
  "name": "Мой предмет",
  "char": "M",
  "type": "consumable",
  "usable": true,
  "effects": {
    "myEffect": 42
  }
}
```

---

## 5. Модули и их описание

### 5.1. `ItemEffects` ([`src/game/ItemEffects.js`](../src/game/ItemEffects.js))

Центральный модуль системы эффектов.

**Экспорты:**

| Экспорт | Тип | Описание |
|---------|-----|----------|
| `EFFECT_HANDLERS` | object | Реестр обработчиков эффектов (ключ — имя эффекта, значение — функция) |
| `applyItemEffects(entity, itemData, gameLoop)` | function | Применяет все эффекты предмета к сущности. Возвращает `{ success, messages }` |
| `isItemUsable(itemData)` | function | Проверяет, можно ли использовать предмет |
| `registerEffect(name, handler)` | function | Регистрирует новый эффект |
| `default` | object | Объект со всеми экспортами |

**Контекст обработчика (`ctx`):**

| Поле | Тип | Описание |
|------|-----|----------|
| `entity` | Entity | Сущность, использующая предмет |
| `itemData` | object | Данные предмета из инвентаря |
| `value` | any | Значение эффекта из конфига |
| `duration` | number | Длительность (из `itemData.duration`) |
| `buffValue` | any | Значение баффа (из `itemData.buffValue`) |
| `damageType` | string | Тип урона (из `itemData.damageType`) |
| `gameLoop` | GameLoop | Ссылка на игровой цикл |
| `location` | Location | Текущая локация |
| `engine` | Engine | Движок локации |
| `logger` | Logger | Логгер |

### 5.2. `PlayerActions.useItem(itemId)` ([`src/game/PlayerActions.js`](../src/game/PlayerActions.js))

Метод, вызываемый при использовании предмета. Возвращает `true` при успехе,
`false` при неудаче. Выполняет:
1. Проверку, что сейчас ход игрока.
2. Получение предмета из инвентаря по `itemId`.
3. Проверку `isItemUsable`.
4. Применение эффектов через `applyItemEffects`.
5. Удаление одного предмета из инвентаря.
6. Завершение хода игрока.

### 5.3. `GameLoop.useItem(itemId)` ([`src/game/GameLoop.js`](../src/game/GameLoop.js))

Делегирует вызов в `PlayerActions.useItem`. Используется из UI.

### 5.4. `InventoryComponent` ([`src/engine/components/InventoryComponent.js`](../src/engine/components/InventoryComponent.js))

Хранит предметы в виде `{ itemData, count }`. Методы:
- `addItem(itemData, count)` — добавить предмет (с поддержкой стаков).
- `removeItem(itemId, count)` — удалить предмет.
- `getItem(itemId)` — получить данные предмета.
- `getItemCount(itemId)` — получить количество.
- `getDisplayItems()` — получить массив для отображения.

### 5.5. `IndexPage.vue` ([`src/pages/IndexPage.vue`](../src/pages/IndexPage.vue))

UI-слой. В блоке «Инвентарь» для каждого используемого предмета отображается
кнопка «Использовать». Кнопка видна только если `isItemUsable(item)` вернул
`true`.

---

## 6. Примеры конфигурации

### 6.1. Аптечка (лечение)

```json
{
  "id": "health",
  "name": "Аптечка",
  "char": "♥",
  "color": "#ff4444",
  "type": "consumable",
  "category": "healing",
  "usable": true,
  "effects": { "heal": 15 },
  "description": "Восстанавливает 15 HP"
}
```

### 6.2. Зелье силы (временный бафф)

```json
{
  "id": "potion_strength",
  "name": "Зелье силы",
  "char": "⚡",
  "color": "#ffaa00",
  "type": "consumable",
  "category": "buff",
  "usable": true,
  "effects": {
    "buff": "strength",
    "duration": 5
  },
  "description": "Увеличивает силу на 5 ходов"
}
```

### 6.3. Свиток телепортации

```json
{
  "id": "scroll",
  "name": "Свиток",
  "char": "?",
  "color": "#88ff88",
  "type": "consumable",
  "category": "scroll",
  "usable": true,
  "effects": { "teleport": true },
  "description": "Телепортирует в случайное место"
}
```

### 6.4. Валюта (не используется)

```json
{
  "id": "gold",
  "name": "Золото",
  "char": "$",
  "color": "#ffdd44",
  "type": "currency",
  "category": "gold",
  "usable": false,
  "effects": {},
  "description": "Игровая валюта"
}
```

---

## 7. Валидация

Функция `GameConfig.validate()` проверяет предметы:
- Если `usable: true`, но `effects` пуст — выдаётся предупреждение.
- Если `effects` не является объектом — выдаётся ошибка.

---

## 8. Расширение системы (продвинутое)

### 8.1. Учёт длительности баффов

Для полноценного снятия баффов через N ходов необходимо обрабатывать
`entity.activeBuffs` в системе ходов. Например, в `TurnManager.endEnemyTurn()`
можно уменьшать длительность активных баффов и снимать их по истечении:

```js
// В TurnManager.endEnemyTurn() или отдельной системе
for (const entity of playerEntities) {
  if (!entity.activeBuffs) continue
  for (const [name, buff] of Object.entries(entity.activeBuffs)) {
    buff.duration--
    if (buff.duration <= 0) {
      removeBuffStats(entity, name, buff.value)
      delete entity.activeBuffs[name]
    }
  }
}
```

### 8.2. Экипировка (weapon/armor)

В текущей реализации `damageBonus` и `armorBonus` применяются как постоянные
эффекты. Для полноценной экипировки (с возможностью снять предмет) потребуется
отдельная логика в `InventoryComponent.equipped` и обработчики, которые
учитывают слот экипировки.

---

## 9. Быстрый старт

1. Добавьте предмет в `core.json` (или мод) с полем `usable: true` и `effects`.
2. Перезагрузите контент (кнопка «Загрузить контент» или перезапуск).
3. Подберите предмет в инвентарь.
4. В блоке «Инвентарь» нажмите «Использовать».
5. Эффект применится, предмет будет израсходован, ход завершится.