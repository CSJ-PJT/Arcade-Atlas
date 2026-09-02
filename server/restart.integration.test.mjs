import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'

const children = new Set()

async function waitUntil(probe, timeout = 8_000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    try { const value = await probe(); if (value) return value }
    catch { /* retry during restart */ }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('integration timeout')
}

function startServer(port, stateFile) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, ARCADE_PORT: String(port), ARCADE_STATE_FILE: stateFile, ARCADE_HEARTBEAT_MS: '500' },
    stdio: 'ignore',
  })
  children.add(child)
  return child
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await new Promise((resolve) => child.once('exit', resolve))
  children.delete(child)
}

async function connect(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'http://127.0.0.1:4173' })
  const messages = []
  socket.on('message', (raw) => messages.push(JSON.parse(String(raw))))
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  const next = (predicate) => waitUntil(() => {
    const index = messages.findIndex(predicate)
    return index < 0 ? null : messages.splice(index, 1)[0]
  })
  await next((message) => message.type === 'connected')
  socket.send(JSON.stringify({ type: 'authenticate', protocol: 3, accessToken: '' }))
  await next((message) => message.type === 'authenticated')
  return { socket, next }
}

afterEach(async () => {
  for (const child of [...children]) await stopServer(child)
})

describe('Arcade server restart recovery', () => {
  it('restores a human board checkpoint, score, pieces and input revision', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'arcade-restart-'))
    const stateFile = join(directory, 'rooms.json')
    const port = 4600 + Math.floor(Math.random() * 200)
    let child = startServer(port, stateFile)
    await waitUntil(async () => (await fetch(`http://127.0.0.1:${port}/health`)).ok)
    const first = await connect(port)
    first.socket.send(JSON.stringify({ type: 'create', protocol: 3, name: 'Restart QA' }))
    const joined = await first.next((message) => message.type === 'joined')
    first.socket.send(JSON.stringify({ type: 'addBot', protocol: 3, difficulty: 'pilot' }))
    first.socket.send(JSON.stringify({ type: 'ready', protocol: 3, ready: true }))
    await waitUntil(() => first.next((message) => message.type === 'roomState').then((message) => message.room.players.length === 2 && message.room.players.every((player) => player.ready)))
    first.socket.send(JSON.stringify({ type: 'start', protocol: 3 }))
    await first.next((message) => message.type === 'matchStart')
    await first.next((message) => message.type === 'playerState' && message.state.status === 'playing')
    first.socket.send(JSON.stringify({ type: 'input', protocol: 3, sequence: 1, command: 'hardDrop' }))
    const before = await first.next((message) => message.type === 'playerState' && message.sequence === 1)
    await new Promise((resolve) => setTimeout(resolve, 400))
    first.socket.terminate()
    await stopServer(child)

    child = startServer(port, stateFile)
    await waitUntil(async () => (await fetch(`http://127.0.0.1:${port}/health`)).ok)
    const second = await connect(port)
    second.socket.send(JSON.stringify({ type: 'resume', protocol: 3, code: joined.room.code, playerId: joined.playerId, reconnectToken: joined.reconnectToken }))
    await second.next((message) => message.type === 'resumed')
    const after = await second.next((message) => message.type === 'playerState')
    expect(after.sequence).toBe(1)
    expect(after.state.board).toEqual(before.state.board)
    expect(after.state.score).toBe(before.state.score)
    expect(after.state.activePiece.id).toBe(before.state.activePiece.id)
    expect(after.state.nextPiece.id).toBe(before.state.nextPiece.id)
    second.socket.send(JSON.stringify({ type: 'leave', protocol: 3 }))
    second.socket.terminate()
    await stopServer(child)
    await rm(directory, { recursive: true, force: true })
  }, 20_000)
})
