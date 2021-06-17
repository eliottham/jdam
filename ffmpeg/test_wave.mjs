import { metronome } from './wave.mjs'


metronome({
  bpm: 240, /* in eighth notes this is 120 */
  pattern: [ 2, 0, 1, 0, 1, 0, 1, 0, 0 ], /* 9/8 */
  measures: 4
})
