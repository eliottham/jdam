/* eslint-disable */
export type JSObject = Record<string | number | symbol, any>

export interface Indexable {
  [key: string | number | symbol]: any
}

export type ThisIsCheating = any
