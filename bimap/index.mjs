class Bimap {
  constructor() {
    this.forwards = new Map()
    this.reverse = new Map()
    Object.defineProperty(this, 'size', {
      get() {
        return this.forwards.size
      }
    })
  }

  clear() {
    this.forwards.clear()
    this.reverse.clear()
  }

  delete(key) {
    const reverseKey = this.forwards.get(key)
    this.forwards.delete(key)
    if (reverseKey) { this.reverse.delete(reverseKey) }
  }

  deleteValue(value) {
    const forwardsKey = this.reverse.get(value)
    this.reverse.delete(value)
    return this.forwards.delete(forwardsKey)
  }

  get(key) {
    return this.forwards.get(key)
  }

  getKey(value) {
    return this.reverse(value)
  }

  has(key) {
    return this.forwards.has(key)
  }

  hasKey(value) {
    return this.reverse.has(value)
  }

  set(key, value) {
    this.forwards.set(key, value)
    this.reverse.set(value, key)
  }

  *[Symbol.iterator] () {
    yield* this.entries()
  }

  *entries () {
    yield* this.forwards.entries()
  }

  *keys () {
    yield* this.forwards.keys()
  }

  *values () {
    yield* this.forwards.values()
  }
}

export default Bimap
