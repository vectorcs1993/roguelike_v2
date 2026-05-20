/**
 * Система очереди ходов по инициативе (Fallout-style)
 * Управляет очередностью ходов персонажей и врагов
 */
export default class TurnQueue {
  constructor() {
    /** @type {Array<{character: Object, initiative: number, isEnemy: boolean}>} */
    this.queue = []
    this.currentIndex = 0
    this.isCombatMode = false
    this.round = 1
  }

  /**
   * Инициализирует очередь с персонажами игрока
   * @param {Array} playerCharacters - персонажи игрока
   */
  initialize(playerCharacters) {
    this.queue = []
    this.currentIndex = 0
    this.isCombatMode = false
    this.round = 1

    // Добавляем только персонажей игрока в начальную очередь
    for (const character of playerCharacters) {
      this.addCharacter(character, false)
    }

    this.sortQueue()
  }

  /**
   * Добавляет персонажа в очередь
   * @param {Object} character - персонаж
   * @param {boolean} isEnemy - является ли врагом
   */
  addCharacter(character, isEnemy) {
    // Проверяем, не добавлен ли уже персонаж
    if (this.queue.some(item => item.character.id === character.id)) {
      return
    }

    const initiative = character.initiative || 5
    this.queue.push({
      character,
      initiative,
      isEnemy,
      originalInitiative: initiative // сохраняем оригинальное значение для сброса
    })

    // Если добавляем врага, переключаемся в режим боя
    if (isEnemy && !this.isCombatMode) {
      this.enterCombatMode()
    }

    this.sortQueue()
  }

  /**
   * Удаляет персонажа из очереди
   * @param {Object} character - персонаж для удаления
   */
  removeCharacter(character) {
    const index = this.queue.findIndex(item => item.character.id === character.id)
    if (index !== -1) {
      const removed = this.queue.splice(index, 1)[0]

      // Корректируем текущий индекс, если удалили текущего или предыдущего
      if (index < this.currentIndex) {
        this.currentIndex--
      } else if (index === this.currentIndex && this.currentIndex >= this.queue.length) {
        this.currentIndex = 0
      }

      // Если удалили всех врагов, выходим из режима боя
      if (removed.isEnemy && !this.hasEnemies()) {
        this.exitCombatMode()
      }
    }
  }

  /**
   * Сортирует очередь по инициативе (по убыванию)
   */
  sortQueue() {
    this.queue.sort((a, b) => {
      // Сначала по инициативе (больше = выше)
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative
      }
      // При равной инициативе - персонажи игрока выше врагов
      if (a.isEnemy !== b.isEnemy) {
        return a.isEnemy ? 1 : -1
      }
      // При равных условиях - по имени
      return a.character.name.localeCompare(b.character.name)
    })

    // Обновляем текущий индекс после сортировки
    const currentCharacter = this.getCurrentCharacter()
    if (currentCharacter) {
      this.currentIndex = this.queue.findIndex(item => item.character.id === currentCharacter.id)
    }
  }

  /**
   * Переходит в режим боя
   */
  enterCombatMode() {
    if (!this.isCombatMode) {
      this.isCombatMode = true
    }
  }

  /**
   * Выходит из режима боя
   */
  exitCombatMode() {
    if (this.isCombatMode) {
      this.isCombatMode = false

      // Удаляем всех врагов из очереди
      this.queue = this.queue.filter(item => !item.isEnemy)
      this.currentIndex = Math.min(this.currentIndex, this.queue.length - 1)
      if (this.currentIndex < 0 && this.queue.length > 0) {
        this.currentIndex = 0
      }
    }
  }

  /**
   * Проверяет, есть ли враги в очереди
   * @returns {boolean}
   */
  hasEnemies() {
    return this.queue.some(item => item.isEnemy)
  }

  /**
   * Возвращает текущего активного персонажа
   * @returns {Object|null}
   */
  getCurrentCharacter() {
    if (this.queue.length === 0) {
      return null
    }

    const item = this.queue[this.currentIndex]
    if (!item) {
      return null
    }

    if (!item.character) {
      return null
    }

    return item.character
  }

  /**
   * Переходит к следующему персонажу в очереди
   * @returns {Object|null} следующий персонаж
   */
  next() {
    if (this.queue.length === 0) {
      return null
    }

    // Переходим к следующему
    this.currentIndex = (this.currentIndex + 1) % this.queue.length

    // Если прошли полный круг, начинаем новый раунд
    if (this.currentIndex === 0) {
      this.round++
      // Сбрасываем инициативу к оригинальным значениям
      this.resetInitiatives()
    }

    const nextChar = this.getCurrentCharacter()

    // Восстанавливаем AP у нового персонажа
    if (nextChar && nextChar.restoreFullAP) {
      nextChar.restoreFullAP()
    }

    return nextChar
  }

  /**
   * Сбрасывает инициативу к оригинальным значениям в начале нового раунда
   */
  resetInitiatives() {
    for (const item of this.queue) {
      item.initiative = item.originalInitiative
    }
    this.sortQueue()
  }

  /**
   * Уменьшает инициативу персонажа после выполнения действия
   * @param {Object} character - персонаж
   * @param {number} cost - стоимость действия в инициативе
   */
  spendInitiative(character, cost = 1) {
    const item = this.queue.find(item => item.character.id === character.id)
    if (item) {
      item.initiative = Math.max(0, item.initiative - cost)
      this.sortQueue()
    }
  }

  /**
   * Возвращает список всех персонажей в очереди
   * @returns {Array}
   */
  getAllCharacters() {
    return this.queue.map(item => item.character)
  }

  /**
   * Возвращает список персонажей игрока в очереди
   * @returns {Array}
   */
  getPlayerCharacters() {
    return this.queue.filter(item => !item.isEnemy).map(item => item.character)
  }

  /**
   * Возвращает список врагов в очереди
   * @returns {Array}
   */
  getEnemies() {
    return this.queue.filter(item => item.isEnemy).map(item => item.character)
  }

  /**
   * Возвращает информацию об очереди для отладки
   * @returns {Object}
   */
  getDebugInfo() {
    return {
      queue: this.queue.map(item => ({
        name: item.character.name,
        initiative: item.initiative,
        isEnemy: item.isEnemy,
        isCurrent: this.getCurrentCharacter()?.id === item.character.id
      })),
      currentIndex: this.currentIndex,
      isCombatMode: this.isCombatMode,
      round: this.round,
      currentCharacter: this.getCurrentCharacter()?.name || 'нет'
    }
  }

  /**
   * Сбрасывает очередь
   */
  reset() {
    this.queue = []
    this.currentIndex = 0
    this.isCombatMode = false
    this.round = 1
  }
}
