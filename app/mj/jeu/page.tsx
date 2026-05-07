'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Round {
  id: number
  round_number: number
  pays: string
  region: string
  appellation: string
  cepage: string
  nom_bouteille: string | null
  is_active: boolean
  is_completed: boolean
}

export default function JeuPage() {
  const router = useRouter()
  const [rounds, setRounds] = useState<Round[]>([])
  const [playerCount, setPlayerCount] = useState(0)
  const [answerCounts, setAnswerCounts] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const fetchAnswerCounts = useCallback(async () => {
    const { data } = await supabase.from('answers').select('round_number')
    if (!data) return
    const counts: Record<number, number> = {}
    data.forEach(a => { counts[a.round_number] = (counts[a.round_number] ?? 0) + 1 })
    setAnswerCounts(counts)
  }, [])

  const fetchAll = useCallback(async () => {
    const [roundsRes, pcRes] = await Promise.all([
      supabase.from('game_config').select('*').order('round_number'),
      supabase.from('players').select('id', { count: 'exact', head: true }),
    ])
    if (roundsRes.data) setRounds(roundsRes.data)
    setPlayerCount(pcRes.count ?? 0)
    await fetchAnswerCounts()
    setLoading(false)
  }, [fetchAnswerCounts])

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('mj-jeu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_config' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers' }, fetchAnswerCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () =>
        supabase.from('players').select('id', { count: 'exact', head: true }).then(r => setPlayerCount(r.count ?? 0))
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchAll, fetchAnswerCounts])

  async function startRound(roundNumber: number) {
    setBusy(true)
    await supabase.from('game_config').update({ is_active: false }).gte('id', 0)
    await supabase.from('game_config').update({ is_active: true }).eq('round_number', roundNumber)
    setBusy(false)
  }

  async function endRound(roundNumber: number) {
    setBusy(true)
    await supabase.from('game_config')
      .update({ is_active: false, is_completed: true })
      .eq('round_number', roundNumber)
    setBusy(false)
  }

  async function goToCorrection() {
    setBusy(true)
    await supabase.from('game_state').upsert({ id: 1, status: 'finished' })
    setBusy(false)
    router.push('/mj/correction')
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">Chargement...</p>
      </main>
    )
  }

  if (rounds.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Aucune manche configurée</p>
          <button
            onClick={() => router.push('/mj/setup')}
            className="bg-red-700 hover:bg-red-600 text-white rounded-xl px-6 py-2.5 transition-colors"
          >
            Configurer les bouteilles
          </button>
        </div>
      </main>
    )
  }

  const activeRound = rounds.find(r => r.is_active) ?? null
  const allDone = rounds.every(r => r.is_completed)

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/mj')} className="text-slate-400 hover:text-white transition-colors">
            ← Retour
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Gérer les manches</h1>
            <p className="text-slate-400 text-sm">
              {playerCount} joueur{playerCount > 1 ? 's' : ''} connecté{playerCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Active round banner */}
        {activeRound && (
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-sm font-medium">
                  Manche {activeRound.round_number} en cours
                </span>
              </div>
              <p className="text-white text-sm">
                {answerCounts[activeRound.round_number] ?? 0} / {playerCount} réponse{playerCount > 1 ? 's' : ''} reçue{playerCount > 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => endRound(activeRound.round_number)}
              disabled={busy}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-4 py-2 transition-colors"
            >
              Terminer la manche
            </button>
          </div>
        )}

        {/* Rounds list */}
        <div className="space-y-3 mb-8">
          {rounds.map(round => {
            const answers = answerCounts[round.round_number] ?? 0
            const canStart = !activeRound && !round.is_completed

            return (
              <div
                key={round.id}
                className={`rounded-xl p-4 border transition-colors ${
                  round.is_active
                    ? 'bg-green-900/20 border-green-800'
                    : round.is_completed
                    ? 'bg-slate-800/40 border-slate-700/50 opacity-60'
                    : 'bg-slate-800 border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        round.is_active ? 'bg-green-800 text-green-200' : 'bg-slate-700 text-slate-300'
                      }`}>
                        Manche {round.round_number}
                      </span>
                      {round.is_completed && (
                        <span className="text-slate-500 text-xs">✓ Terminée · {answers} réponse{answers !== 1 ? 's' : ''}</span>
                      )}
                      {round.nom_bouteille && (
                        <span className="text-white text-sm font-medium truncate">{round.nom_bouteille}</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs">
                      {round.pays} › {round.region} › {round.appellation} · {round.cepage}
                    </p>
                    {round.is_active && (
                      <p className="text-green-400 text-xs mt-1">
                        {answers} / {playerCount} réponse{playerCount !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {canStart && (
                    <button
                      onClick={() => startRound(round.round_number)}
                      disabled={busy}
                      className="ml-4 shrink-0 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-4 py-2 transition-colors"
                    >
                      Démarrer
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {allDone && (
          <button
            onClick={goToCorrection}
            disabled={busy}
            className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
          >
            Terminer la partie → Correction
          </button>
        )}
      </div>
    </main>
  )
}
