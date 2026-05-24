// src/game/Logger.js
// Централизованная система логирования для отладки и тестирования

export const LOG_LEVEL = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

export const LOG_MODULES = {
  ENEMY: 'enemy',
  COMBAT: 'combat',
  MOVEMENT: 'movement',
  AI: 'ai',
  TURN: 'turn',
  PATHFINDING: 'pathfinding',
  GENERATION: 'generation',
  SYSTEM: 'system'
};

// Конфигурация по умолчанию
const DEFAULT_CONFIG = {
  level: LOG_LEVEL.INFO, // Уровень по умолчанию
  enabledModules: new Set(Object.values(LOG_MODULES)), // Все модули включены
  showTimestamp: false,
  showModule: true,
  showLevel: true,
  colors: true,
  callbacks: [] // Массив callback-функций для перехвата сообщений
};

class Logger {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Преобразуем enabledModules в Set если это массив
    if (Array.isArray(this.config.enabledModules)) {
      this.config.enabledModules = new Set(this.config.enabledModules);
    }

    // Кэшируем проверки для производительности
    this._enabledCache = new Map();

    // Инициализируем массив callback-ов
    this.config.callbacks = this.config.callbacks || [];
  }

  // Проверка, включено ли логирование для данного уровня и модуля
  isEnabled(level, module) {
    if (level > this.config.level) return false;

    // Если модуль не указан, считаем что включен
    if (!module) return true;

    // Проверяем кэш
    const cacheKey = `${level}:${module}`;
    if (this._enabledCache.has(cacheKey)) {
      return this._enabledCache.get(cacheKey);
    }

    const enabled = this.config.enabledModules.has(module);
    this._enabledCache.set(cacheKey, enabled);
    return enabled;
  }

  // Форматирование сообщения
  formatMessage(level, module, message) {
    const parts = [];

    if (this.config.showTimestamp) {
      parts.push(`[${new Date().toISOString().slice(11, 23)}]`);
    }

    if (this.config.showLevel) {
      const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
      parts.push(`[${levelNames[level]}]`);
    }

    if (this.config.showModule && module) {
      parts.push(`[${module.toUpperCase()}]`);
    }

    parts.push(message);

    return parts.join(' ');
  }

  // Базовый метод логирования
  log(level, module, ...args) {
    if (!this.isEnabled(level, module)) return;

    const message = this.formatMessage(level, module, args.join(' '));

    // Вызываем все зарегистрированные callback-функции
    if (this.config.callbacks && this.config.callbacks.length > 0) {
      for (const callback of this.config.callbacks) {
        try {
          callback(level, module, message, args);
        } catch (err) {
          console.error('Logger callback error:', err);
        }
      }
    }

    // Выбор метода консоли в зависимости от уровня
    switch (level) {
      case LOG_LEVEL.ERROR:
        console.error(message);
        break;
      case LOG_LEVEL.WARN:
        console.warn(message);
        break;
      case LOG_LEVEL.INFO:
        console.info(message);
        break;
      case LOG_LEVEL.DEBUG:
        console.debug(message);
        break;
      case LOG_LEVEL.TRACE:
        console.trace(message);
        break;
      default:
        console.log(message);
    }
  }

  // Методы для каждого уровня
  error(module, ...args) {
    this.log(LOG_LEVEL.ERROR, module, ...args);
  }

  warn(module, ...args) {
    this.log(LOG_LEVEL.WARN, module, ...args);
  }

  info(module, ...args) {
    this.log(LOG_LEVEL.INFO, module, ...args);
  }

  debug(module, ...args) {
    this.log(LOG_LEVEL.DEBUG, module, ...args);
  }

  trace(module, ...args) {
    this.log(LOG_LEVEL.TRACE, module, ...args);
  }

  // Утилиты для быстрого логирования врагов
  enemyMove(enemyName, fromX, fromY, toX, toY, apCost, remainingAP) {
    if (!this.isEnabled(LOG_LEVEL.DEBUG, LOG_MODULES.ENEMY)) return;
    this.debug(LOG_MODULES.ENEMY,
      `${enemyName} двигается: (${Math.floor(fromX)}, ${Math.floor(fromY)}) -> (${toX}, ${toY}), ` +
      `потрачено AP: ${apCost}, осталось: ${remainingAP}`
    );
  }

  enemyAttack(enemyName, targetName, damage, success, remainingAP) {
    if (!this.isEnabled(LOG_LEVEL.INFO, LOG_MODULES.COMBAT)) return;
    const result = success ? 'успешно' : 'промах';
    this.info(LOG_MODULES.COMBAT,
      `${enemyName} атакует ${targetName}: ${result}, ` +
      `урон: ${damage}, AP осталось: ${remainingAP}`
    );
  }

  enemyStateChange(enemyName, oldState, newState, reason = '') {
    if (!this.isEnabled(LOG_LEVEL.DEBUG, LOG_MODULES.AI)) return;
    this.debug(LOG_MODULES.AI,
      `${enemyName} меняет состояние: ${oldState} -> ${newState}` +
      (reason ? ` (${reason})` : '')
    );
  }

  enemyDetection(enemyName, targetName, distance) {
    if (!this.isEnabled(LOG_LEVEL.INFO, LOG_MODULES.AI)) return;
    this.info(LOG_MODULES.AI,
      `${enemyName} обнаружил ${targetName} на расстоянии ${distance.toFixed(1)}`
    );
  }

  enemyTurnStart(enemyName, ap) {
    if (!this.isEnabled(LOG_LEVEL.INFO, LOG_MODULES.TURN)) return;
    this.info(LOG_MODULES.TURN,
      `Ход врага: ${enemyName}, AP: ${ap}`
    );
  }

  enemyTurnEnd(enemyName, apSpent, totalAP) {
    if (!this.isEnabled(LOG_LEVEL.DEBUG, LOG_MODULES.TURN)) return;
    this.debug(LOG_MODULES.TURN,
      `${enemyName} завершил ход, потрачено AP: ${apSpent}/${totalAP}`
    );
  }

  // Конфигурация
  setLevel(level) {
    this.config.level = level;
    this._enabledCache.clear();
  }

  enableModule(module) {
    this.config.enabledModules.add(module);
    this._enabledCache.clear();
  }

  disableModule(module) {
    this.config.enabledModules.delete(module);
    this._enabledCache.clear();
  }

  setModules(modules) {
    this.config.enabledModules = new Set(modules);
    this._enabledCache.clear();
  }

  // Методы для работы с callback-ами
  addCallback(callback) {
    if (typeof callback !== 'function') {
      console.error('Logger.addCallback: callback must be a function');
      return;
    }
    this.config.callbacks.push(callback);
  }

  removeCallback(callback) {
    const index = this.config.callbacks.indexOf(callback);
    if (index !== -1) {
      this.config.callbacks.splice(index, 1);
    }
  }

  clearCallbacks() {
    this.config.callbacks = [];
  }
}

// Создаем глобальный экземпляр логгера с настройками по умолчанию
// Можно переопределить через window.LOGGER_CONFIG в index.html
let globalConfig = DEFAULT_CONFIG;

if (typeof window !== 'undefined' && window.LOGGER_CONFIG) {
  globalConfig = { ...DEFAULT_CONFIG, ...window.LOGGER_CONFIG };
}

// Экспортируем синглтон
export const logger = new Logger(globalConfig);

// Экспортируем класс для тестирования
export default Logger;
