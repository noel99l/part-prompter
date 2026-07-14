'use client'

import Image from 'next/image'
import Link from 'next/link'
import QRCode from 'qrcode'
import * as Ably from 'ably'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import PrompterStage from '@/components/prompter/PrompterStage'
import { harmonyBandStyle, harmonyIds } from '@/lib/harmony'
import { buildDisplayBlocks } from '@/lib/prompterBlocks'
import { playbackPositionMs, prompterBpmRate, sourceBlockAtPosition } from '@/lib/prompterTimeline'
import { normalizeMemberIds } from '@/lib/sync/highlight'
import type { MasterSyncSnapshot, PresenceData, SyncDevice, SyncLyricLine, SyncState } from '@/lib/sync/types'
import styles from './SyncController.module.css'

type LiveDevice = PresenceData & { online: boolean }
type ControllerDisplayLine = SyncLyricLine & {
  timestamp_ms: number | null
  word_members: { text: string }[]
}

const CONTROLLER_DISPLAY_SETTINGS_KEY = 'part-prompter:sync:controller-display'
const PREVIEW_FONT_SCALE_MIN = 0.6
const PREVIEW_FONT_SCALE_MAX = 1.6
const PREVIEW_FONT_SCALE_STEP = 0.01

function parsePresence(value: unknown): PresenceData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  const keys = ['deviceId', 'deviceNumber', 'displayName', 'configured', 'songId', 'ready']
  if (Object.keys(data).some(key => !keys.includes(key))) return null
  if (typeof data.deviceId !== 'string' || !Number.isInteger(data.deviceNumber)
    || typeof data.displayName !== 'string' || typeof data.configured !== 'boolean'
    || !Number.isInteger(data.songId) || typeof data.ready !== 'boolean') return null
  return data as unknown as PresenceData
}

async function apiError(response: Response): Promise<string> {
  const value = await response.json().catch(() => null) as { error?: string } | null
  return value?.error ?? '同期サービスとの通信に失敗しました。'
}

function mergeSnapshotDevices(previous: Map<string, LiveDevice>, devices: SyncDevice[], songId: number) {
  const next = new Map<string, LiveDevice>()
  for (const device of devices) {
    if (!device.configured) continue
    const current = previous.get(device.id)
    next.set(device.id, {
      deviceId: device.id,
      deviceNumber: device.deviceNumber,
      displayName: device.displayName ?? `端末 ${device.deviceNumber}`,
      configured: true,
      songId: current?.songId ?? songId,
      ready: current?.ready ?? false,
      online: current?.online ?? false,
    })
  }
  return next
}

export default function SyncController({ sessionId }: { sessionId: string }) {
  const [snapshot, setSnapshot] = useState<MasterSyncSnapshot | null>(null)
  const [joinUrl, setJoinUrl] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [devices, setDevices] = useState<Map<string, LiveDevice>>(new Map())
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ended, setEnded] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [previewFontScale, setPreviewFontScale] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const realtimeRef = useRef<Ably.Realtime | null>(null)
  const snapshotRef = useRef<MasterSyncSnapshot | null>(null)
  const dbDevicesRef = useRef<Map<string, SyncDevice>>(new Map())
  const connectionsRef = useRef<Map<string, Set<string>>>(new Map())

  const loadSnapshot = useCallback(async () => {
    const response = await fetch(`/api/sync/sessions/${encodeURIComponent(sessionId)}`)
    if (!response.ok) throw new Error(await apiError(response))
    const value = await response.json() as MasterSyncSnapshot
    snapshotRef.current = value
    dbDevicesRef.current = new Map(value.devices.map(device => [device.id, device]))
    setSnapshot(value)
    setDevices(previous => mergeSnapshotDevices(previous, value.devices, value.state.songId))
    if (value.session.status !== 'active') {
      sessionStorage.removeItem(`part-prompter:sync:join:${sessionId}`)
      setEnded(true)
      setConnected(false)
      realtimeRef.current?.close()
    }
    return value
  }, [sessionId])

  useEffect(() => {
    const stored = sessionStorage.getItem(`part-prompter:sync:join:${sessionId}`)
    if (stored) setJoinUrl(stored)
  }, [sessionId])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CONTROLLER_DISPLAY_SETTINGS_KEY) ?? 'null') as { fontScale?: unknown } | null
      if (typeof saved?.fontScale === 'number') {
        setPreviewFontScale(Math.min(PREVIEW_FONT_SCALE_MAX, Math.max(PREVIEW_FONT_SCALE_MIN, saved.fontScale)))
      }
    } catch {}
  }, [])

  const changePreviewFontScale = (value: number) => {
    const next = Math.min(PREVIEW_FONT_SCALE_MAX, Math.max(PREVIEW_FONT_SCALE_MIN, Number(value.toFixed(2))))
    setPreviewFontScale(next)
    try { localStorage.setItem(CONTROLLER_DISPLAY_SETTINGS_KEY, JSON.stringify({ fontScale: next })) } catch {}
  }

  const rotateJoinUrl = useCallback(async () => {
    if (!window.confirm('参加URLを再発行すると、現在の参加URLは無効になります。再発行しますか？')) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/sync/sessions/${encodeURIComponent(sessionId)}/join-token`, { method: 'POST' })
      if (response.status === 410) {
        setEnded(true); setConnected(false); realtimeRef.current?.close(); return
      }
      if (!response.ok) throw new Error(await apiError(response))
      const value = await response.json() as { joinUrl: string }
      sessionStorage.setItem(`part-prompter:sync:join:${sessionId}`, value.joinUrl)
      setJoinUrl(value.joinUrl)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '参加URLを再発行できませんでした。')
    } finally { setBusy(false) }
  }, [sessionId])

  useEffect(() => {
    if (!joinUrl) return
    QRCode.toDataURL(joinUrl, { width: 360, margin: 2, errorCorrectionLevel: 'M' })
      .then(setQrUrl).catch(() => setQrUrl(''))
  }, [joinUrl])

  useEffect(() => {
    let disposed = false
    loadSnapshot().catch(reason => { if (!disposed) setError(reason instanceof Error ? reason.message : '読み込みに失敗しました。') })
    const realtime = new Ably.Realtime({
      authCallback: async (_params, callback) => {
        try {
          const response = await fetch(`/api/sync/sessions/${encodeURIComponent(sessionId)}/ably-token`, { method: 'POST' })
          if (response.status === 410) {
            sessionStorage.removeItem(`part-prompter:sync:join:${sessionId}`)
            setEnded(true); setConnected(false); realtimeRef.current?.close()
            callback('同期セッションは終了しました。', null)
            return
          }
          if (!response.ok) throw new Error(await apiError(response))
          const value = await response.json() as { tokenRequest: Ably.TokenRequest }
          callback(null, value.tokenRequest)
        } catch (reason) { callback(reason instanceof Error ? reason.message : '認証に失敗しました。', null) }
      },
    })
    realtimeRef.current = realtime
    const channel = realtime.channels.get(`part-prompter:session:${sessionId}`)
    const realtimeError = (message: string) => {
      if (!disposed) { setConnected(false); setError(message) }
    }
    const onState = (message: Ably.Message) => {
      const incoming = message.data as SyncState
      const current = snapshotRef.current
      if (!current || !incoming || typeof incoming.version !== 'number' || incoming.version <= current.state.version) return
      const next = { ...current, state: incoming }
      snapshotRef.current = next; setSnapshot(next)
    }
    const onEnded = () => {
      sessionStorage.removeItem(`part-prompter:sync:join:${sessionId}`)
      setEnded(true); setConnected(false); realtime.close()
    }
    const applyPresence = async (message: Ably.PresenceMessage) => {
      const data = parsePresence(message.data)
      if (!data || message.clientId !== `device:${data.deviceId}` || !message.connectionId) return

      let dbDevice = dbDevicesRef.current.get(data.deviceId)
      if (!dbDevice && message.action !== 'leave') {
        await loadSnapshot()
        dbDevice = dbDevicesRef.current.get(data.deviceId)
      }
      if (!dbDevice?.configured) return

      const connections = new Set(connectionsRef.current.get(data.deviceId) ?? [])
      if (message.action === 'leave') connections.delete(message.connectionId)
      else connections.add(message.connectionId)
      if (connections.size > 0) connectionsRef.current.set(data.deviceId, connections)
      else connectionsRef.current.delete(data.deviceId)

      setDevices(previous => {
        const current = previous.get(data.deviceId)
        const next = new Map(previous)
        next.set(data.deviceId, {
          deviceId: dbDevice.id,
          deviceNumber: dbDevice.deviceNumber,
          displayName: dbDevice.displayName ?? `端末 ${dbDevice.deviceNumber}`,
          configured: true,
          songId: message.action === 'leave' ? (current?.songId ?? data.songId) : data.songId,
          ready: message.action === 'leave' ? (current?.ready ?? false) : data.ready,
          online: connections.size > 0,
        })
        return next
      })
    }
    const onPresence = (message: Ably.PresenceMessage) => {
      void applyPresence(message).catch(reason => realtimeError(
        reason instanceof Error ? reason.message : '端末状態を同期できませんでした。'
      ))
    }

    void channel.subscribe('state.updated', onState).catch(() => realtimeError('状態更新の購読に失敗しました。'))
    void channel.subscribe('session.ended', onEnded).catch(() => realtimeError('終了通知の購読に失敗しました。'))
    void channel.presence.subscribe(['enter', 'update', 'leave'], onPresence)
      .catch(() => realtimeError('端末状態の購読に失敗しました。'))

    const syncPresence = async () => {
      connectionsRef.current.clear()
      setDevices(previous => new Map([...previous].map(([id, device]) => [id, { ...device, online: false }])))
      const members = await channel.presence.get()
      for (const member of members) await applyPresence(member)
    }
    realtime.connection.on('connected', () => {
      if (disposed) return
      setConnected(false)
      void loadSnapshot()
        .then(value => value.session.status === 'active' ? syncPresence() : undefined)
        .then(() => {
          if (!disposed && snapshotRef.current?.session.status === 'active') {
            setConnected(true); setError('')
          }
        })
        .catch(reason => realtimeError(reason instanceof Error ? reason.message : '最新状態を取得できませんでした。'))
    })
    realtime.connection.on(['disconnected', 'suspended', 'failed'], () => { if (!disposed) setConnected(false) })
    return () => {
      disposed = true
      channel.unsubscribe(); channel.presence.unsubscribe()
      realtime.close(); realtimeRef.current = null
    }
  }, [loadSnapshot, sessionId])

  useEffect(() => {
    setNowMs(Date.now())
    if (!snapshot?.state.isPlaying) return
    const timer = window.setInterval(() => setNowMs(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [snapshot?.state.isPlaying, snapshot?.state.startedAt, snapshot?.state.positionMs])

  const command = useCallback(async (body: Record<string, unknown>) => {
    if (!connected || busy) return
    const payload = JSON.stringify({ commandId: crypto.randomUUID(), ...body })
    const send = () => fetch(`/api/sync/sessions/${encodeURIComponent(sessionId)}/state`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: payload,
    })
    setBusy(true); setError('')
    try {
      let response = await send()
      if (response.status === 503) {
        const latest = await loadSnapshot()
        if (latest.session.status !== 'active') return
        response = await send()
      }
      if (!response.ok) throw new Error(await apiError(response))
      const value = await response.json() as { state: SyncState }
      const current = snapshotRef.current
      if (current && value.state.version >= current.state.version) {
        const next = { ...current, state: value.state }; snapshotRef.current = next; setSnapshot(next)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作を反映できませんでした。')
    } finally { setBusy(false) }
  }, [busy, connected, loadSnapshot, sessionId])

  const finish = async () => {
    if (!window.confirm('同期セッションを終了しますか？ 終了後は参加URLを利用できません。')) return
    setBusy(true); setError('')
    let failure: unknown = new Error('終了できませんでした。')
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(`/api/sync/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
          if (response.ok) {
            sessionStorage.removeItem(`part-prompter:sync:join:${sessionId}`)
            setEnded(true); setConnected(false); realtimeRef.current?.close()
            return
          }
          failure = new Error(await apiError(response))
        } catch (reason) { failure = reason }
      }
      const latest = await loadSnapshot()
      if (latest.session.status !== 'active') {
        sessionStorage.removeItem(`part-prompter:sync:join:${sessionId}`)
        return
      }
      throw failure
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '終了できませんでした。')
    } finally { setBusy(false) }
  }

  const currentSong = snapshot?.playlist.songs[snapshot.state.songIndex]
  const sourceBlocks = useMemo(() => {
    const grouped = new Map<number, ControllerDisplayLine[]>()
    for (const line of currentSong?.lyrics ?? []) {
      const displayLine: ControllerDisplayLine = {
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
  const displayBlocks = useMemo(
    () => buildDisplayBlocks(sourceBlocks.map(([, lines]) => lines), null, false),
    [sourceBlocks]
  )
  const bpmRate = prompterBpmRate(currentSong?.originalBpm, currentSong?.playbackBpm)
  const currentPosition = snapshot
    ? playbackPositionMs(snapshot.state.positionMs, snapshot.state.isPlaying, snapshot.state.startedAt, nowMs)
    : 0
  const effectiveBlock = snapshot && currentSong
    ? sourceBlockAtPosition(currentSong.lyrics, currentPosition, snapshot.state.currentBlock, bpmRate)
    : -1
  const controllerBlockIndex = displayBlocks.findIndex(
    block => sourceBlocks[block.sourceBlockIndex]?.[0] === effectiveBlock
  )
  const maxPosition = Math.max(
    1000,
    ...((currentSong?.lyrics ?? []).map(line => Math.round((line.timestampMs ?? 0) * bpmRate)))
  )
  const memberMap = new Map(currentSong?.members.map(member => [member.id, member]) ?? [])
  const renderControllerLine = (line: ControllerDisplayLine) => {
    if (line.wordMembers.length > 0) return line.wordMembers.map((word, index) => {
      const value = word && typeof word === 'object' ? word as Record<string, unknown> : {}
      const text = typeof value.text === 'string' ? value.text : ''
      if (text === ' ' || text === '　') return <span key={index} className={styles.textTransparent}>{text}</span>
      const ids = normalizeMemberIds([value.member_ids, value.member_id, value.main_ids, value.main_id, value.main])
      const band = harmonyBandStyle(
        harmonyIds(value, 'up').map(id => memberMap.get(id)?.color ?? '#888'),
        harmonyIds(value, 'down').map(id => memberMap.get(id)?.color ?? '#888'),
        '0.07em'
      )
      const colors = ids.map(id => memberMap.get(id)?.color ?? '#fff')
      const colorStyle = colors.length <= 1 ? { color: colors[0] ?? '#fff' } : {
        backgroundImage: `linear-gradient(to bottom, ${colors.map((color, colorIndex) => `${color} ${colorIndex * 100 / colors.length}%, ${color} ${(colorIndex + 1) * 100 / colors.length}%`).join(',')})`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      }
      return <span key={index} style={colorStyle}>{band ? <span style={band}>{text}</span> : text}</span>
    })
    const ids = normalizeMemberIds(line.memberIds)
    const colors = ids.map(id => memberMap.get(id)?.color ?? '#fff')
    const style = colors.length <= 1 ? { color: colors[0] ?? '#fff' } : {
      backgroundImage: `linear-gradient(to bottom, ${colors.map((color, index) => `${color} ${index * 100 / colors.length}%, ${color} ${(index + 1) * 100 / colors.length}%`).join(',')})`,
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
    }
    return <span style={style}>{line.text}</span>
  }
  const configuredDevices = [...devices.values()].sort((a, b) => a.deviceNumber - b.deviceNumber)
  const configuringCount = snapshot?.configuringCount ?? 0

  if (ended) return <main className={styles.page}><section className={styles.ended}><h1>同期セッションを終了しました</h1><Link href="/manage/sync">新しいセッションを作成</Link></section></main>
  if (!snapshot || !currentSong) return <main className={styles.page}><p className={styles.loading}>{error || 'コントローラーを読み込み中...'}</p></main>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>📡 SYNC CONTROLLER</p><h1>{snapshot.playlist.name}</h1></div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.sidebarToggle}
            onClick={() => setSidebarOpen(value => !value)}
            aria-expanded={sidebarOpen}
            aria-controls="sync-controller-sidebar"
          >
            {sidebarOpen ? '情報パネルを隠す' : `情報パネルを表示（${configuredDevices.length}台）`}
          </button>
          <div className={`${styles.connection} ${connected ? styles.online : styles.offline}`}>{connected ? '接続中' : '再接続中'}</div>
        </div>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={`${styles.grid} ${sidebarOpen ? '' : styles.gridExpanded}`}>
        <section className={styles.stage}>
          <div className={styles.songNavigation}>
            <button
              type="button"
              onClick={() => command({ type: 'selectSong', songIndex: snapshot.state.songIndex - 1 })}
              disabled={!connected || busy || snapshot.state.songIndex <= 0}
            >
              ◀ 前の曲
            </button>
            <select
              className={styles.songSelect}
              value={snapshot.state.songIndex}
              disabled={!connected || busy}
              onChange={event => command({ type: 'selectSong', songIndex: Number(event.target.value) })}
              aria-label="曲を選択"
            >
              {snapshot.playlist.songs.map((song, index) => <option key={song.id} value={index}>{index + 1}. {song.title}</option>)}
            </select>
            <button
              type="button"
              onClick={() => command({ type: 'selectSong', songIndex: snapshot.state.songIndex + 1 })}
              disabled={!connected || busy || snapshot.state.songIndex >= snapshot.playlist.songs.length - 1}
            >
              次の曲 ▶
            </button>
          </div>
          <div className={`${styles.preview} ${sidebarOpen ? '' : styles.previewExpanded}`} style={{ background: currentSong.bgColor || '#000', '--fontScale': previewFontScale } as CSSProperties}>
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
              currentBlock={controllerBlockIndex}
              isPortrait={false}
              renderLine={renderControllerLine}
              lineKey={line => line.id}
              embedded
            />
          </div>
          <div className={styles.previewSettings}>
            <span>プレビュー文字サイズ</span>
            <button onClick={() => changePreviewFontScale(previewFontScale - PREVIEW_FONT_SCALE_STEP)} disabled={previewFontScale <= PREVIEW_FONT_SCALE_MIN} aria-label="プレビュー文字を小さく">A−</button>
            <strong>{Math.round(previewFontScale * 100)}%</strong>
            <button onClick={() => changePreviewFontScale(previewFontScale + PREVIEW_FONT_SCALE_STEP)} disabled={previewFontScale >= PREVIEW_FONT_SCALE_MAX} aria-label="プレビュー文字を大きく">A＋</button>
            <input
              type="range"
              min={PREVIEW_FONT_SCALE_MIN * 100}
              max={PREVIEW_FONT_SCALE_MAX * 100}
              step={1}
              value={Math.round(previewFontScale * 100)}
              onChange={event => changePreviewFontScale(Number(event.target.value) / 100)}
              aria-label="プレビュー文字サイズ"
            />
          </div>
          <div className={styles.controls}>
            <button onClick={() => command({ type: 'previousPage' })} disabled={!connected || busy}>◀ 前ページ</button>
            <button className={styles.play} onClick={() => command({ type: snapshot.state.isPlaying ? 'pause' : 'play' })} disabled={!connected || busy}>{snapshot.state.isPlaying ? '⏸ 一時停止' : '▶ 再生'}</button>
            <button onClick={() => command({ type: 'nextPage' })} disabled={!connected || busy}>次ページ ▶</button>
          </div>
          <label className={styles.seek}>再生位置 {Math.floor(currentPosition / 1000)}秒
            <input type="range" min={0} max={maxPosition} value={Math.min(currentPosition, maxPosition)} disabled={!connected || busy} onChange={event => command({ type: 'seek', positionMs: Number(event.target.value) })} />
          </label>
        </section>
        {sidebarOpen && (
          <aside id="sync-controller-sidebar" className={styles.sidebar}>
            <section className={styles.panel}>
              <h2>参加用QRコード</h2>
              <p>必要な端末で読み取ります</p>
              {joinUrl ? (
                <>
                  {qrUrl ? <Image className={styles.qr} src={qrUrl} width={360} height={360} unoptimized alt="同期プロンプター参加用QRコード" /> : <div className={styles.qrFallback}>QRコードを生成できませんでした</div>}
                  <div className={styles.urlRow}><input readOnly value={joinUrl} aria-label="参加URL" /><button onClick={() => navigator.clipboard.writeText(joinUrl)}>コピー</button></div>
                </>
              ) : <div className={styles.qrFallback}>参加URLはこのブラウザに保存されていません</div>}
              <p className={styles.tokenWarning}>再発行すると、現在の参加URLは無効になります。</p>
              <button className={styles.rotateButton} onClick={rotateJoinUrl} disabled={busy}>参加URLを再発行</button>
            </section>
            <section className={styles.panel}>
              <div className={styles.deviceHeading}><h2>設定完了端末</h2><span>{configuredDevices.length}台</span></div>
              {configuringCount > 0 && <p className={styles.configuring}>設定中 {configuringCount}台</p>}
              {configuredDevices.length === 0 ? <p className={styles.empty}>QRコードを読み取り、端末名と担当を設定してください。</p> : configuredDevices.map(device => {
                const status = !device.online ? '切断中' : device.songId !== snapshot.state.songId || !device.ready ? '担当選択待ち' : '準備完了'
                return <div className={styles.device} key={device.deviceId}><div><strong>{device.displayName}</strong><small>端末 {device.deviceNumber}</small></div><span data-status={status}>{status}</span></div>
              })}
            </section>
            <button className={styles.endButton} onClick={finish} disabled={busy}>セッションを終了</button>
          </aside>
        )}
      </div>
    </main>
  )
}
