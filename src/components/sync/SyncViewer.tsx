'use client'

import * as Ably from 'ably'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import PrompterStage from '@/components/prompter/PrompterStage'
import { IconChangeMember, IconFullscreen, IconNext, IconPrev, IconSettings } from '@/components/icons'
import { harmonyBandStyle, harmonyIds } from '@/lib/harmony'
import { memberDisplayName } from '@/lib/memberDisplayName'
import { buildDisplayBlocks } from '@/lib/prompterBlocks'
import { displayBlockAtPosition, playbackPositionMs, prompterBpmRate } from '@/lib/prompterTimeline'
import { getLineHighlight, getWordHighlight, normalizeMemberIds } from '@/lib/sync/highlight'
import type { SyncDevice, SyncLyricLine, SyncSnapshot, SyncState } from '@/lib/sync/types'
import MemberSelector from './MemberSelector'
import styles from './SyncViewer.module.css'

interface Credentials { deviceId: string; reconnectToken: string }
type FullscreenRoot = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}
type SelectReason = 'initial' | 'song-change' | 'manual'
type DisplaySyncLine = SyncLyricLine & {
  timestamp_ms: number | null
  word_members: { text: string }[]
}

async function responseError(response: Response): Promise<string> {
  const value = await response.json().catch(() => null) as { error?: string } | null
  return value?.error ?? '同期サービスとの通信に失敗しました。'
}

const CREDENTIAL_PREFIX = 'part-prompter:sync:device:'
const LATEST_CREDENTIAL_KEY = `${CREDENTIAL_PREFIX}latest`
const FONT_SCALE_MIN = 0.6
const FONT_SCALE_MAX = 1.6
const FONT_SCALE_STEP = 0.01

function displaySettingsKey(deviceId: string) {
  return `part-prompter:sync:display:${deviceId}`
}

async function credentialKey(joinToken: string) {
  const bytes = new TextEncoder().encode(joinToken)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
  return `${CREDENTIAL_PREFIX}${hash}`
}

function readStoredCredential(key: string): Credentials | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<Credentials> | null
    if (!value || typeof value.deviceId !== 'string' || typeof value.reconnectToken !== 'string') return null
    return { deviceId: value.deviceId, reconnectToken: value.reconnectToken }
  } catch {
    return null
  }
}

function removeStoredCredential(credentials: Credentials) {
  const keys: string[] = []
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (!key?.startsWith(CREDENTIAL_PREFIX)) continue
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<Credentials> | null
      if (value?.deviceId === credentials.deviceId && value.reconnectToken === credentials.reconnectToken) keys.push(key)
    } catch {}
  }
  for (const key of keys) localStorage.removeItem(key)
}

function storePlaylistSnapshot(snapshot: SyncSnapshot) {
  try {
    sessionStorage.setItem(
      `part-prompter:sync:${snapshot.session.id}:playlist`,
      JSON.stringify(snapshot.playlist)
    )
  } catch {}
}

function selectionKey(sessionId: string, songId: number) {
  return `part-prompter:sync:${sessionId}:parts:${songId}`
}

function readSelection(sessionId: string, songId: number): number[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(selectionKey(sessionId, songId)) ?? '[]')
    return Array.isArray(value) ? normalizeMemberIds(value) : []
  } catch { return [] }
}

export default function SyncViewer({ joinToken }: { joinToken: string }) {
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [device, setDevice] = useState<SyncDevice | null>(null)
  const [snapshot, setSnapshot] = useState<SyncSnapshot | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectReason, setSelectReason] = useState<SelectReason | null>(null)
  const [connected, setConnected] = useState(false)
  const [ended, setEnded] = useState(false)
  const [error, setError] = useState('')
  const [displayBlock, setDisplayBlock] = useState(-1)
  const [manualDisplayBlock, setManualDisplayBlock] = useState<number | null>(null)
  const [isPortrait, setIsPortrait] = useState(false)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [fontScale, setFontScale] = useState(1)
  const [showNext, setShowNext] = useState(true)
  const [autoSplit, setAutoSplit] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fullscreenSupported, setFullscreenSupported] = useState(false)
  const [fullscreenActive, setFullscreenActive] = useState(false)
  const realtimeRef = useRef<Ably.Realtime | null>(null)
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)
  const snapshotRef = useRef<SyncSnapshot | null>(null)
  const deviceRef = useRef<SyncDevice | null>(null)
  const selectedRef = useRef<number[]>([])
  const readyRef = useRef(false)
  const songGenerationRef = useRef(0)
  const selectionBeforeManualRef = useRef<{ selectedIds: number[]; reason: SelectReason | null; ready: boolean } | null>(null)

  const updateSnapshot = useCallback((incoming: SyncSnapshot, force = false) => {
    const previous = snapshotRef.current
    if (!force && previous && incoming.state.version <= previous.state.version) return
    const songChanged = previous != null && previous.state.songId !== incoming.state.songId
    snapshotRef.current = incoming; setSnapshot(incoming); setManualDisplayBlock(null)
    if (songChanged) {
      songGenerationRef.current += 1
      readyRef.current = false
      selectionBeforeManualRef.current = null
      const restored = readSelection(incoming.session.id, incoming.state.songId)
      selectedRef.current = restored; setSelectedIds(restored); setSelectReason('song-change')
      setDisplayBlock(-1)
    }
  }, [])

  const presenceData = useCallback((ready: boolean) => {
    const currentDevice = deviceRef.current
    const currentSnapshot = snapshotRef.current
    if (!currentDevice || !currentSnapshot) return null
    return {
      deviceId: currentDevice.id, deviceNumber: currentDevice.deviceNumber,
      displayName: currentDevice.displayName ?? '', configured: currentDevice.configured,
      songId: currentSnapshot.state.songId, ready,
    }
  }, [])

  const updatePresence = useCallback(async (ready: boolean, enter = false) => {
    const data = presenceData(ready)
    if (!data || !channelRef.current) return
    if (enter) await channelRef.current.presence.enter(data)
    else await channelRef.current.presence.update(data)
  }, [presenceData])

  useEffect(() => {
    const updateViewport = () => {
      setIsPortrait(window.innerHeight > window.innerWidth)
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    const root = document.documentElement as FullscreenRoot
    const fullscreenDocument = document as FullscreenDocument
    setFullscreenSupported(
      typeof root.requestFullscreen === 'function'
      || typeof root.webkitRequestFullscreen === 'function'
    )
    const updateFullscreen = () => {
      setFullscreenActive(Boolean(document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement))
    }
    updateFullscreen()
    document.addEventListener('fullscreenchange', updateFullscreen)
    document.addEventListener('webkitfullscreenchange', updateFullscreen)
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreen)
      document.removeEventListener('webkitfullscreenchange', updateFullscreen)
    }
  }, [])

  useEffect(() => {
    if (!device?.id) return
    setFontScale(1); setShowNext(true); setAutoSplit(true); setSettingsOpen(false)
    try {
      const saved = JSON.parse(localStorage.getItem(displaySettingsKey(device.id)) ?? 'null') as Record<string, unknown> | null
      if (typeof saved?.fontScale === 'number') setFontScale(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, saved.fontScale)))
      if (typeof saved?.showNext === 'boolean') setShowNext(saved.showNext)
      if (typeof saved?.autoSplit === 'boolean') setAutoSplit(saved.autoSplit)
    } catch {}
  }, [device?.id])

  const persistDisplaySettings = (nextFontScale: number, nextShowNext: boolean, nextAutoSplit: boolean) => {
    const deviceId = deviceRef.current?.id
    if (!deviceId) return
    try {
      localStorage.setItem(displaySettingsKey(deviceId), JSON.stringify({
        fontScale: nextFontScale,
        showNext: nextShowNext,
        autoSplit: nextAutoSplit,
      }))
    } catch {}
  }

  const changeFontScale = (value: number) => {
    const next = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Number(value.toFixed(2))))
    setFontScale(next)
    persistDisplaySettings(next, showNext, autoSplit)
  }

  const toggleShowNext = () => setShowNext(current => {
    persistDisplaySettings(fontScale, !current, autoSplit)
    return !current
  })

  const toggleAutoSplit = () => setAutoSplit(current => {
    persistDisplaySettings(fontScale, showNext, !current)
    return !current
  })

  useEffect(() => {
    let disposed = false
    const abortController = new AbortController()

    credentialKey(joinToken).then(async key => {
      if (disposed) return
      const currentCredentials = readStoredCredential(key)
      const savedCredentials = currentCredentials ?? readStoredCredential(LATEST_CREDENTIAL_KEY)
      const joinResponse = await fetch(`/api/sync/join/${encodeURIComponent(joinToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedCredentials ? { reconnectToken: savedCredentials.reconnectToken } : {}),
        signal: abortController.signal,
      })

      let joined: { device: SyncDevice; reconnectToken?: string; snapshot: SyncSnapshot }
      let restoredCredentials: Credentials
      if (joinResponse.ok) {
        joined = await joinResponse.json() as typeof joined
        if (joined.reconnectToken) {
          restoredCredentials = { deviceId: joined.device.id, reconnectToken: joined.reconnectToken }
        } else if (savedCredentials) {
          restoredCredentials = savedCredentials
        } else {
          throw new Error('端末の再接続情報を取得できませんでした。')
        }
      } else if (joinResponse.status === 404 && currentCredentials) {
        // 参加URL再発行後も、このURLで設定済みだった端末だけは資格情報で復帰できる。
        const snapshotResponse = await fetch(
          `/api/sync/devices/${encodeURIComponent(currentCredentials.deviceId)}/snapshot`,
          {
            headers: { Authorization: `Bearer ${currentCredentials.reconnectToken}` },
            signal: abortController.signal,
          }
        )
        if (snapshotResponse.status === 410) {
          removeStoredCredential(currentCredentials)
          if (!disposed) setEnded(true)
          return
        }
        if (!snapshotResponse.ok) {
          if (snapshotResponse.status === 401) localStorage.removeItem(key)
          throw new Error(await responseError(joinResponse))
        }
        const value = await snapshotResponse.json() as { device: SyncDevice; snapshot: SyncSnapshot }
        joined = value
        restoredCredentials = currentCredentials
      } else {
        if (joinResponse.status === 410) {
          localStorage.removeItem(key)
          if (!disposed) setEnded(true)
          return
        }
        throw new Error(await responseError(joinResponse))
      }

      if (disposed) return
      localStorage.setItem(key, JSON.stringify(restoredCredentials))
      localStorage.setItem(LATEST_CREDENTIAL_KEY, JSON.stringify(restoredCredentials))
      storePlaylistSnapshot(joined.snapshot)
      deviceRef.current = joined.device; setDevice(joined.device); setCredentials(restoredCredentials)
      updateSnapshot(joined.snapshot, true); setDisplayBlock(-1)
      const restored = readSelection(joined.snapshot.session.id, joined.snapshot.state.songId)
      selectedRef.current = restored; setSelectedIds(restored)
      readyRef.current = joined.device.configured && restored.length > 0
      if (!joined.device.configured) setSelectReason('initial')
      else if (restored.length === 0) setSelectReason('song-change')
    }).catch(reason => {
      if (!disposed && !(reason instanceof DOMException && reason.name === 'AbortError')) {
        setError(reason instanceof Error ? reason.message : '参加できませんでした。')
      }
    })
    return () => { disposed = true; abortController.abort() }
  }, [joinToken, updateSnapshot])

  const fetchSnapshot = useCallback(async () => {
    if (!credentials) return null
    const response = await fetch(`/api/sync/devices/${encodeURIComponent(credentials.deviceId)}/snapshot`, {
      headers: { Authorization: `Bearer ${credentials.reconnectToken}` },
      cache: 'no-store',
    })
    if (response.status === 410) {
      removeStoredCredential(credentials)
      setEnded(true); realtimeRef.current?.close(); return null
    }
    if (!response.ok) throw new Error(await responseError(response))
    const value = await response.json() as { device: SyncDevice; snapshot: SyncSnapshot }
    const previousDevice = deviceRef.current
    const nextDevice = previousDevice?.configured && !value.device.configured
      ? previousDevice
      : value.device
    storePlaylistSnapshot(value.snapshot)
    setManualDisplayBlock(null)
    deviceRef.current = nextDevice; setDevice(nextDevice); updateSnapshot(value.snapshot)
    return { ...value, device: nextDevice }
  }, [credentials, updateSnapshot])

  const sessionId = snapshot?.session.id
  useEffect(() => {
    if (!credentials || !sessionId) return
    let disposed = false
    const realtime = new Ably.Realtime({
      authCallback: async (_params, callback) => {
        try {
          const response = await fetch(`/api/sync/devices/${encodeURIComponent(credentials.deviceId)}/ably-token`, {
            method: 'POST', headers: { Authorization: `Bearer ${credentials.reconnectToken}` },
          })
          if (response.status === 410) {
            removeStoredCredential(credentials)
            setEnded(true); setConnected(false); realtimeRef.current?.close()
            callback('同期セッションは終了しました。', null); return
          }
          if (!response.ok) throw new Error(await responseError(response))
          const value = await response.json() as { tokenRequest: Ably.TokenRequest }
          callback(null, value.tokenRequest)
        } catch (reason) { callback(reason instanceof Error ? reason.message : '認証に失敗しました。', null) }
      },
    })
    realtimeRef.current = realtime
    const channel = realtime.channels.get(`part-prompter:session:${sessionId}`)
    channelRef.current = channel
    const onState = (message: Ably.Message) => {
      const state = message.data as SyncState
      const current = snapshotRef.current
      if (!current || !state || typeof state.version !== 'number' || state.version <= current.state.version) return
      const songChanged = state.songId !== current.state.songId
      updateSnapshot({ ...current, state })
      if (songChanged) updatePresence(false).catch(() => undefined)
    }
    const onEnded = () => {
      setEnded(true); setConnected(false)
      removeStoredCredential(credentials)
      realtime.close()
    }
    const subscriptionError = (message: string) => {
      if (!disposed) { setConnected(false); setError(message) }
    }
    void channel.subscribe('state.updated', onState)
      .catch(() => subscriptionError('状態更新の購読に失敗しました。'))
    void channel.subscribe('session.ended', onEnded)
      .catch(() => subscriptionError('終了通知の購読に失敗しました。'))
    realtime.connection.on('connected', () => {
      if (disposed) return
      setConnected(false)
      void fetchSnapshot()
        .then(async value => {
          if (!value) return false
          await updatePresence(readyRef.current, true)
          return true
        })
        .then(synchronized => {
          if (synchronized && !disposed && snapshotRef.current?.session.status === 'active') {
            setConnected(true); setError('')
          }
        })
        .catch(reason => subscriptionError(reason instanceof Error ? reason.message : '最新状態を取得できませんでした。'))
    })
    realtime.connection.on(['disconnected', 'suspended', 'failed'], () => { if (!disposed) setConnected(false) })
    return () => {
      disposed = true; channel.unsubscribe(); channel.presence.leave().catch(() => undefined)
      realtime.close(); realtimeRef.current = null; channelRef.current = null
    }
  }, [credentials, fetchSnapshot, sessionId, updatePresence, updateSnapshot])

  const currentSong = snapshot?.playlist.songs[snapshot.state.songIndex]

  const confirmDeviceSetup = async (displayName: string) => {
    if (!credentials || !snapshotRef.current || !deviceRef.current) return
    const response = await fetch(`/api/sync/devices/${encodeURIComponent(credentials.deviceId)}/configuration`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credentials.reconnectToken}` },
      body: JSON.stringify({ displayName, configured: true }),
    })
    if (!response.ok) throw new Error(await responseError(response))
    const value = await response.json() as { device: SyncDevice }
    deviceRef.current = value.device
    setDevice(value.device)
    readyRef.current = false
    selectionBeforeManualRef.current = null
    const current = snapshotRef.current
    const restored = readSelection(current.session.id, current.state.songId)
    selectedRef.current = restored
    setSelectedIds(restored)
    setSelectReason('song-change')
    await updatePresence(false)
  }

  const confirmSelection = async (displayName: string, ids: number[]) => {
    const startingSnapshot = snapshotRef.current
    const startingDevice = deviceRef.current
    if (!credentials || !startingSnapshot || !startingDevice) return
    const songId = startingSnapshot.state.songId
    const generation = songGenerationRef.current
    sessionStorage.setItem(selectionKey(startingSnapshot.session.id, songId), JSON.stringify(ids))
    selectedRef.current = ids; setSelectedIds(ids)

    if (!startingDevice.configured) {
      const response = await fetch(`/api/sync/devices/${encodeURIComponent(credentials.deviceId)}/configuration`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credentials.reconnectToken}` },
        body: JSON.stringify({ displayName, configured: true }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const value = await response.json() as { device: SyncDevice }
      deviceRef.current = value.device; setDevice(value.device)
    }

    const current = snapshotRef.current
    if (!current || current.state.songId !== songId || songGenerationRef.current !== generation) {
      readyRef.current = false
      selectionBeforeManualRef.current = null
      if (current) {
        const restored = readSelection(current.session.id, current.state.songId)
        selectedRef.current = restored; setSelectedIds(restored); setSelectReason('song-change')
      }
      await updatePresence(false)
      return
    }

    readyRef.current = true
    selectionBeforeManualRef.current = null
    setSelectReason(null)
    await updatePresence(true)
  }

  const startManualSelection = () => {
    setSettingsOpen(false)
    setManualDisplayBlock(null)
    selectionBeforeManualRef.current = {
      selectedIds: selectedRef.current,
      reason: selectReason,
      ready: readyRef.current,
    }
    readyRef.current = false
    setSelectReason('manual')
    updatePresence(false).catch(() => undefined)
  }
  const cancelSelection = () => {
    const previous = selectionBeforeManualRef.current
    if (!previous) return
    selectionBeforeManualRef.current = null
    readyRef.current = previous.ready
    selectedRef.current = previous.selectedIds
    setSelectedIds(previous.selectedIds)
    setSelectReason(previous.reason)
    updatePresence(previous.ready).catch(() => undefined)
  }

  const sourceBlocks = useMemo(() => {
    const grouped = new Map<number, DisplaySyncLine[]>()
    for (const line of currentSong?.lyrics ?? []) {
      const displayLine: DisplaySyncLine = {
        ...line,
        timestamp_ms: line.timestampMs,
        word_members: line.wordMembers.map(word => {
          const value = word && typeof word === 'object' ? word as Record<string, unknown> : {}
          return { text: typeof value.text === 'string' ? value.text : '' }
        }),
      }
      grouped.set(line.blockIndex, [...(grouped.get(line.blockIndex) ?? []), displayLine])
    }
    return [...grouped.entries()].sort(([left], [right]) => left - right)
  }, [currentSong])

  const layout = useMemo(() => {
    const width = Math.max(viewport.width, viewport.height)
    const height = Math.min(viewport.width, viewport.height)
    if (!width || !height) return null
    const rem = 16
    const clamp = (min: number, value: number, max: number) => Math.min(Math.max(min, value), max)
    const small = width <= 768
    const lineFont = (small ? clamp(rem, 0.03 * width, 2 * rem) : clamp(2 * rem, 0.06 * width, 6 * rem)) * fontScale
    const nextFont = (small ? clamp(0.75 * rem, 0.022 * width, 1.4 * rem) : clamp(1.5 * rem, 0.045 * width, 4 * rem)) * fontScale
    const nextArea = showNext ? nextFont * 2.6 + 1.25 * rem : 0
    const available = height - 58 - height * 0.15 - nextArea
    return { maxRows: Math.max(1, Math.floor(available / (lineFont * 1.6 + 0.4 * rem))), lineFont, contentW: width * 0.92 }
  }, [fontScale, showNext, viewport])

  const displayBlocks = useMemo(
    () => buildDisplayBlocks(sourceBlocks.map(([, lines]) => lines), layout, autoSplit),
    [autoSplit, layout, sourceBlocks]
  )

  useEffect(() => {
    setManualDisplayBlock(null)
  }, [displayBlocks])

  const bpmRate = useMemo(
    () => prompterBpmRate(currentSong?.originalBpm, currentSong?.playbackBpm),
    [currentSong]
  )
  const stateBlock = snapshot?.state.currentBlock ?? -1
  const fallbackDisplayBlock = useMemo(() => {
    if (stateBlock === -1) return -1
    return displayBlocks.findIndex(block => sourceBlocks[block.sourceBlockIndex]?.[0] === stateBlock)
  }, [displayBlocks, sourceBlocks, stateBlock])

  useEffect(() => {
    if (!snapshot) return
    const state = snapshot.state
    if (!state.isPlaying) {
      setDisplayBlock(displayBlockAtPosition(
        displayBlocks,
        state.positionMs,
        fallbackDisplayBlock,
        bpmRate
      ))
      return
    }
    let frame = 0
    const tick = () => {
      const position = playbackPositionMs(state.positionMs, true, state.startedAt)
      const next = displayBlockAtPosition(displayBlocks, position, fallbackDisplayBlock, bpmRate)
      setDisplayBlock(value => value === next ? value : next)
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [bpmRate, displayBlocks, fallbackDisplayBlock, snapshot])

  useEffect(() => {
    if (manualDisplayBlock !== null && manualDisplayBlock === displayBlock) {
      setManualDisplayBlock(null)
    }
  }, [displayBlock, manualDisplayBlock])

  const memberMap = useMemo(() => new Map(currentSong?.members.map(member => [member.id, member]) ?? []), [currentSong])
  const memberNameMap = useMemo(() => new Map(
    currentSong?.members.map((member, index) => [member.id, memberDisplayName(member, index)]) ?? []
  ), [currentSong])
  const selectionPending = selectReason === 'song-change'
  const unassignedPlayback = selectionPending && snapshot?.state.isPlaying === true

  const renderLine = (line: DisplaySyncLine) => {
    if (line.wordMembers.length > 0) return line.wordMembers.map((word, index) => {
      const value = word && typeof word === 'object' ? word as Record<string, unknown> : {}
      const text = typeof value.text === 'string' ? value.text : ''
      if (text === ' ' || text === '　') return <span key={index} className={styles.textTransparent}>{text}</span>
      const mainIds = normalizeMemberIds([value.member_ids, value.member_id, value.main_ids, value.main_id, value.main])
      const upIds = harmonyIds(value, 'up')
      const downIds = harmonyIds(value, 'down')
      const band = harmonyBandStyle(
        upIds.map(id => memberMap.get(id)?.color ?? '#888'),
        downIds.map(id => memberMap.get(id)?.color ?? '#888'),
        '0.07em'
      )
      const highlight = getWordHighlight(word, selectedIds)
      const colors = mainIds.map(id => memberMap.get(id)?.color ?? '#fff')
      const colorStyle = colors.length <= 1 ? { color: colors[0] ?? '#fff' } : {
        backgroundImage: `linear-gradient(to bottom, ${colors.map((color, colorIndex) => `${color} ${colorIndex * 100 / colors.length}%, ${color} ${(colorIndex + 1) * 100 / colors.length}%`).join(',')})`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      }
      return <span key={index} style={{ ...colorStyle, opacity: unassignedPlayback ? 1 : highlight.opacity }}>{band ? <span style={band}>{text}</span> : text}</span>
    })
    const ids = normalizeMemberIds(line.memberIds)
    const colors = ids.map(id => memberMap.get(id)?.color ?? '#fff')
    const highlight = getLineHighlight(ids, selectedIds)
    const opacity = unassignedPlayback ? 1 : highlight.opacity
    const style = colors.length <= 1 ? { color: colors[0] ?? '#fff', opacity } : {
      backgroundImage: `linear-gradient(to bottom, ${colors.map((color, index) => `${color} ${index * 100 / colors.length}%, ${color} ${(index + 1) * 100 / colors.length}%`).join(',')})`,
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', opacity,
    }
    return <span style={style}>{line.text}</span>
  }

  const visibleDisplayBlock = manualDisplayBlock ?? displayBlock
  const moveManualDisplay = (delta: -1 | 1) => {
    setSettingsOpen(false)
    setManualDisplayBlock(current => {
      const base = current ?? displayBlock
      const next = Math.max(-1, Math.min(displayBlocks.length - 1, base + delta))
      return next === displayBlock ? null : next
    })
  }
  const handleStageTap = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.clientX < window.innerWidth / 2) moveManualDisplay(-1)
    else moveManualDisplay(1)
  }
  const toggleFullscreen = () => {
    const root = document.documentElement as FullscreenRoot
    const fullscreenDocument = document as FullscreenDocument
    const activeElement = document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement
    if (!activeElement) {
      const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root)
      if (request) void Promise.resolve(request()).catch(() => undefined)
      return
    }
    const exit = document.exitFullscreen?.bind(document) ?? fullscreenDocument.webkitExitFullscreen?.bind(fullscreenDocument)
    if (exit) void Promise.resolve(exit()).catch(() => undefined)
  }

  if (ended) return <main className={styles.messagePage}><section><h1>同期セッションは終了しました</h1><p>ご参加ありがとうございました。この画面は閉じて構いません。</p></section></main>
  if (error && !snapshot) return <main className={styles.messagePage}><section><h1>参加できませんでした</h1><p>{error}</p></section></main>
  if (!snapshot || !device || !currentSong) return <main className={styles.messagePage}><p>同期プロンプターへ接続中...</p></main>
  if (selectReason === 'initial') return <MemberSelector key="initial-device-setup" members={currentSong.members} selectedIds={selectedIds} initialDisplayName={device.displayName ?? ''} requireDisplayName canCancel={false} reason="initial" onConfirm={confirmDeviceSetup} />

  const selectedParts = selectedIds.flatMap(id => {
    const member = memberMap.get(id)
    const name = memberNameMap.get(id)
    return member && name ? [{ id, name, color: member.color }] : []
  })
  return (
    <main
      className={styles.viewer}
      style={{ background: currentSong.bgColor || '#000' }}
    >
      <header className={styles.topbar}>
        <div><strong>{device.displayName}</strong><span>{currentSong.title}</span></div>
        <div className={styles.badges}>
          <span className={styles.partsBadge}>
            {unassignedPlayback ? '全パート表示' : selectedParts.length > 0 ? selectedParts.map(part => (
              <span key={part.id} className={styles.selectedPart} style={{ color: part.color }}>{part.name}</span>
            )) : '担当未選択'}
          </span>
          {manualDisplayBlock !== null && <span className={styles.manualBadge}>手動表示</span>}
          <span className={connected ? styles.connected : styles.reconnecting}>{connected ? '同期中' : '再接続中'}</span>
        </div>
      </header>
      {error && <div className={styles.error} role="status">{error}</div>}
      <section className={styles.stage} aria-live="off" style={{ '--fontScale': fontScale } as CSSProperties} onClick={handleStageTap}>
        <PrompterStage
          title={currentSong.title}
          artist={currentSong.artist}
          coverText={currentSong.coverText}
          members={currentSong.members.map(member => ({
            id: member.id,
            name: member.name,
            color: member.color,
            sortOrder: member.sortOrder,
          }))}
          displayBlocks={displayBlocks}
          currentBlock={visibleDisplayBlock}
          isPortrait={isPortrait}
          showNext={showNext}
          renderLine={renderLine}
          lineKey={line => line.id}
          scrollBlockAlign="start"
        />
      </section>
      {!connected && <div className={styles.reconnectOverlay}>再接続中 — 最後の歌詞を表示しています</div>}
      {settingsOpen && (
        <div className={styles.settingsPanel} role="dialog" aria-label="表示設定" onClick={event => event.stopPropagation()}>
          <div className={styles.settingsRow}>
            <span>文字サイズ</span>
            <div className={styles.fontControls}>
              <button onClick={() => changeFontScale(fontScale - FONT_SCALE_STEP)} disabled={fontScale <= FONT_SCALE_MIN} aria-label="文字を小さく">A−</button>
              <strong>{Math.round(fontScale * 100)}%</strong>
              <button onClick={() => changeFontScale(fontScale + FONT_SCALE_STEP)} disabled={fontScale >= FONT_SCALE_MAX} aria-label="文字を大きく">A＋</button>
            </div>
          </div>
          <input
            className={styles.fontSlider}
            type="range"
            min={FONT_SCALE_MIN * 100}
            max={FONT_SCALE_MAX * 100}
            step={1}
            value={Math.round(fontScale * 100)}
            onChange={event => changeFontScale(Number(event.target.value) / 100)}
            aria-label="文字サイズ"
          />
          <div className={styles.settingsRow}>
            <span>次のセクションを表示</span>
            <button role="switch" aria-checked={showNext} className={`${styles.switch} ${showNext ? styles.switchOn : ''}`} onClick={toggleShowNext}><span /></button>
          </div>
          <div className={styles.settingsRow}>
            <span>自動ブロック分け</span>
            <button role="switch" aria-checked={autoSplit} className={`${styles.switch} ${autoSplit ? styles.switchOn : ''}`} onClick={toggleAutoSplit}><span /></button>
          </div>
          <p>この端末だけに保存されます。</p>
        </div>
      )}
      {selectionPending && !snapshot.state.isPlaying && (
        <MemberSelector
          key={`${snapshot.state.songId}:song-change`}
          members={currentSong.members}
          selectedIds={selectedIds}
          initialDisplayName={device.displayName ?? ''}
          requireDisplayName={false}
          canCancel={false}
          reason="song-change"
          modal
          onConfirm={confirmSelection}
        />
      )}
      {selectReason === 'manual' && (
        <MemberSelector
          key={`${snapshot.state.songId}:manual`}
          members={currentSong.members}
          selectedIds={selectedIds}
          initialDisplayName={device.displayName ?? ''}
          requireDisplayName={!device.configured}
          canCancel
          reason="manual"
          modal
          onConfirm={confirmSelection}
          onCancel={cancelSelection}
        />
      )}
      <div className={styles.viewerControls} onClick={event => event.stopPropagation()}>
        <button className={styles.pageButton} onClick={() => moveManualDisplay(-1)} disabled={visibleDisplayBlock <= -1} title="前のスライド" aria-label="前のスライド"><IconPrev /></button>
        <button className={styles.pageButton} onClick={() => moveManualDisplay(1)} disabled={visibleDisplayBlock >= displayBlocks.length - 1} title="次のスライド" aria-label="次のスライド"><IconNext /></button>
        <button className={`${styles.settingsButton} ${settingsOpen ? styles.activeButton : ''}`} onClick={() => setSettingsOpen(value => !value)} title="表示設定" aria-label="表示設定" aria-expanded={settingsOpen}><IconSettings /></button>
        {fullscreenSupported && <button className={`${styles.fullscreenButton} ${fullscreenActive ? styles.activeButton : ''}`} onClick={toggleFullscreen} title={fullscreenActive ? '全画面表示を終了' : '全画面表示'} aria-label={fullscreenActive ? '全画面表示を終了' : '全画面表示'} aria-pressed={fullscreenActive}><IconFullscreen /></button>}
        <button className={styles.changeButton} onClick={startManualSelection} title="担当を変更" aria-label="担当を変更"><IconChangeMember /></button>
      </div>
    </main>
  )
}
