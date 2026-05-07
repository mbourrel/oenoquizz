'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type GameStatus = 'setup' | 'playing' | 'finished'

export default function MJPage() {
  const [gameStatus, setGameStatus] = useState<GameStatus>('setup')
  const [roundCount, setRoundCount] = useState(0)
  const [playerCount, setPlayerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchState = useCallback(async () => {
    const [gsRes, rcRes, pcRes] = await Promise.all([
      supabase.from('game_state').select('status').eq('id', 1).single(),
      supabase.from('game_config').select('id', { count: 'exact', head: true }),
      supabase.from('players').select('id', { count: 'exact', head: true }),
    ])
    setGameStatus((gsRes.data?.status ?? 'setup') as GameStatus)
    setRoundCount(rcRes.count ?? 0)
    setPlayerCount(pcRes.count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchState()
    const channel = supabase
      .channel('mj-state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, fetchState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchState)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchState])

  async function resetGame() {
    if (!confirm('Réinitialiser la partie ? Toutes les données seront supprimées.')) return
    await Promise.all([
      supabase.from('game_config').delete().gte('id', 0),
      supabase.from('answers').delete().gte('id', 0),
      supabase.from('players').delete().gte('id', 0),
      supabase.from('game_state').upsert({ id: 1, status: 'setup' }),
    ])
    fetchState()
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">Chargement...</p>
      </main>
    )
  }

  const statusLabel = { setup: 'Préparation', playing: 'En cours', finished: 'Terminée' }[gameStatus]
  const statusColor = {
    setup: 'bg-slate-700 text-slate-300',
    playing: 'bg-green-900 text-green-300',
    finished: 'bg-amber-900 text-amber-300',
  }[gameStatus]

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Maître du jeu</h1>
            <p className="text-slate-400 text-sm">Tableau de bord</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm mb-1">Manches</p>
            <p className="text-3xl font-bold text-white">{roundCount}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm mb-1">Joueurs</p>
            <p className="text-3xl font-bold text-white">{playerCount}</p>
          </div>
        </div>

        <nav className="space-y-3">
          <Link href="/mj/setup">
            <div className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${
              gameStatus === 'setup'
                ? 'bg-red-900/30 border-red-700 hover:bg-red-900/50'
                : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🍾</span>
                <div>
                  <p className="text-white font-semibold">Configurer les bouteilles</p>
                  <p className="text-slate-400 text-sm">Ajouter les vins de chaque manche</p>
                </div>
              </div>
              <span className="text-slate-400">→</span>
            </div>
          </Link>

          <Link href="/mj/jeu">
            <div className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${
              gameStatus === 'playing'
                ? 'bg-green-900/20 border-green-800 hover:bg-green-900/30'
                : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎮</span>
                <div>
                  <p className="text-white font-semibold">Gérer les manches</p>
                  <p className="text-slate-400 text-sm">Démarrer et terminer chaque manche</p>
                </div>
              </div>
              <span className="text-slate-400">→</span>
            </div>
          </Link>

          <Link href="/mj/correction">
            <div className="flex items-center justify-between bg-slate-800 border border-slate-700 hover:bg-slate-700 p-4 rounded-xl cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✏️</span>
                <div>
                  <p className="text-white font-semibold">Correction & Scores</p>
                  <p className="text-slate-400 text-sm">Corriger les réponses et ajuster les points</p>
                </div>
              </div>
              <span className="text-slate-400">→</span>
            </div>
          </Link>
        </nav>

        <div className="mt-10 pt-6 border-t border-slate-800 flex items-center justify-between">
          <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
            ← Accueil
          </Link>
          <button
            onClick={resetGame}
            className="text-slate-600 hover:text-red-400 text-sm transition-colors"
          >
            Réinitialiser la partie
          </button>
        </div>
      </div>
    </main>
  )
}
