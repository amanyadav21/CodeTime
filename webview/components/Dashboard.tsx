'use client';

import { useEffect, useState } from 'react';
import { onServerMessage, send, type EngineSnapshot, type CpServerMessage } from '../lib/bridge';
import { formatHms, formatHm, formatMinutes } from '../lib/format';

const STATE_ICON: Record<EngineSnapshot['timer']['state'], string> = {
  ACTIVE: '⚡',
  PAUSED: '⏸',
  IDLE: '○',
};

const STATE_LABEL: Record<EngineSnapshot['timer']['state'], string> = {
  ACTIVE: 'ACTIVE CODING',
  PAUSED: 'PAUSED',
  IDLE: 'IDLE',
};

export function Dashboard() {
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [stale, setStale] = useState(false);
  const [comboPulse, setComboPulse] = useState(0);

  useEffect(() => {
    send({ type: 'ready' });
    return onServerMessage((msg: CpServerMessage) => {
      if (msg.type === 'snapshot') {
        setSnapshot((prev) => {
          if (prev && prev.combo.multiplier !== msg.payload.combo.multiplier) {
            setComboPulse(msg.payload.combo.multiplier);
          }
          return msg.payload;
        });
        setStale(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    const t = setTimeout(() => setStale(true), 3000);
    return () => clearTimeout(t);
  }, [snapshot]);

  if (!snapshot) {
    return <DashboardSkeleton />;
  }

  const { timer, sessions, combo, streak, goal } = snapshot;
  const todayMinutes = Math.floor(sessions.today.totalActiveMillis / 60_000);
  const currentSessionMinutes = sessions.current
    ? Math.floor(sessions.current.activeMillis / 60_000)
    : 0;
  const bestTodayMinutes = Math.floor(sessions.today.longestSessionMillis / 60_000);

  return (
    <main className="p-4 space-y-5 max-w-sm">
      <header>
        <h1 className="text-xs tracking-widest text-cpMuted">CODEPULSE</h1>
      </header>

      <section aria-label="Active coding timer" className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span
            className={timer.state === 'ACTIVE' ? 'cp-pulse' : ''}
            aria-hidden
            style={{ filter: timer.state === 'IDLE' ? 'opacity(0.5)' : undefined }}
          >
            {STATE_ICON[timer.state]}
          </span>
          <span className="text-3xl font-mono tabular-nums">
            {formatHms(sessions.today.totalActiveMillis)}
          </span>
        </div>
        <p className="text-[11px] uppercase tracking-wider text-cpMuted">
          {STATE_LABEL[timer.state]}
        </p>
      </section>

      <Divider />

      <section aria-label="Combo" className="space-y-1">
        <p className="text-sm">
          <span aria-hidden>🔥</span> COMBO{' '}
          <span className="font-mono">
            {combo.multiplier > 0 ? `× ${combo.multiplier}` : '—'}
          </span>
        </p>
        {comboPulse > 0 && (
          <p className="text-[11px] text-cpAccent cp-anim" aria-hidden>
            × {comboPulse}
          </p>
        )}
      </section>

      <Divider />

      <section aria-label="Daily goal" className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-cpMuted">Today's Goal</p>
        <p className="text-sm font-mono">
          {formatMinutes(todayMinutes)} / {formatMinutes(goal.goalMinutes)}
        </p>
        <div
          className="h-1.5 w-full rounded-full bg-cpBorder/40 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(goal.percent)}
        >
          <div
            className="h-full rounded-full bg-cpAccent cp-anim"
            style={{ width: `${Math.max(0, Math.min(100, goal.percent))}%` }}
          />
        </div>
        <p className="text-[11px] text-cpMuted text-right">{Math.round(goal.percent)}%</p>
      </section>

      <Divider />

      <section aria-label="Daily stats" className="grid grid-cols-2 gap-y-1 text-sm">
        <span className="text-cpMuted">Current Session</span>
        <span className="text-right font-mono">{currentSessionMinutes}m</span>
        <span className="text-cpMuted">Best Session</span>
        <span className="text-right font-mono">{formatHm(bestTodayMinutes * 60_000)}</span>
        <span className="text-cpMuted">Sessions Today</span>
        <span className="text-right font-mono">{sessions.today.sessions.length}</span>
      </section>

      <Divider />

      <section aria-label="Streak" className="space-y-1">
        {streak.currentStreak > 0 ? (
          <p className="text-sm">
            <span aria-hidden>🔥</span>{' '}
            {streak.currentStreak === 1 ? '1 DAY STREAK' : `${streak.currentStreak} DAY STREAK`}
          </p>
        ) : (
          <p className="text-sm text-cpMuted">No streak yet</p>
        )}
        {!streak.isTodayQualifying && streak.currentStreak > 0 && (
          <p className="text-[11px] text-cpMuted">
            Streak: {streak.currentStreak} — keep going today
          </p>
        )}
      </section>

      {stale && (
        <button
          className="text-[11px] text-cpAccent underline"
          onClick={() => send({ type: 'requestSnapshot' })}
        >
          Stale — reload
        </button>
      )}
    </main>
  );
}

function Divider() {
  return <hr className="border-cpBorder/40" />;
}

function DashboardSkeleton() {
  return (
    <main className="p-4 space-y-4 max-w-sm" aria-busy>
      <div className="h-3 w-20 rounded bg-cpBorder/30" />
      <div className="h-9 w-40 rounded bg-cpBorder/30" />
      <div className="h-4 w-32 rounded bg-cpBorder/30" />
      <div className="h-4 w-44 rounded bg-cpBorder/30" />
      <div className="h-2 w-full rounded-full bg-cpBorder/30" />
      <div className="h-4 w-36 rounded bg-cpBorder/30" />
    </main>
  );
}
