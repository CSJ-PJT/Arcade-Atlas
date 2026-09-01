import { randomBytes } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { GravityBotEngine } from '../server/gravityBot.mjs'
import { RoomStore } from '../server/roomStore.mjs'

let id = 0
const store = new RoomStore({ id: () => `load-${++id}`, random: (size) => randomBytes(size) })
const engines = []
const startedAt = performance.now()
for (let roomIndex = 0; roomIndex < 100; roomIndex += 1) {
  const host = store.createRoom(`Load ${roomIndex}`)
  for (let botIndex = 0; botIndex < 3; botIndex += 1) store.addBot(host.room, host.player.id, ['rookie', 'pilot', 'ace'][botIndex])
  store.setReady(host.room, host.player.id, true)
  const match = store.start(host.room)
  for (const player of host.room.players.values()) if (player.isBot) engines.push(new GravityBotEngine(match.seed, player.botDifficulty, `${match.seed}:${player.id}`))
}
for (const engine of engines) engine.replay(3)
const elapsedMs = Math.round(performance.now() - startedAt)
const heapMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
if (store.rooms.size !== 100 || engines.length !== 300 || elapsedMs > 15_000 || heapMb > 512) throw new Error('load gate exceeded')
console.log(JSON.stringify({ rooms: store.rooms.size, bots: engines.length, movesPerBot: 3, elapsedMs, heapMb }))
