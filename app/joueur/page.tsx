'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import vinsData from '@/data/vins.json'

interface RoundConfig {
  round_number: number
  is_active: boolean
  is_completed: boolean
}

interface PlayerScore {
  pseudo: string
  total_score: number
}

type PageState = 'registration' | 'waiting' | 'playing' | 'answered' | 'finished'

const EMPTY_SELECTION = { pays: '', region: '', appellation: '', cepage: '', commentaire: '' }

export default function JoueurPage() {
  const [pageState, setPageState] = useState<PageState>('registration')
  const [pseudo, setPseudo] = useState('')
  const [activePseudo, setActivePseudo] = useState('')
  const [activeRound, setActiveRound] = useState<RoundConfig | null>(null)
  const [selection, setSelection] = useState(EMPTY_SELECTION)
  const [classement, setClassement] = useState<PlayerScore[]>([])
  const [loading, setLoading] = useState(false)

  const fetchClassement = useCallback(async () => {
    const { data } = await supabase
      .from('players')
      .select('pseudo, total_score')
      .order('total_score', { ascending: false })
    if (data) setClassement(data)
  }, [])

  const refreshGameState = useCallback(async (currentPseudo: string) => {
    const [gsRes, roundRes] = await Promise.all([
      supabase.from('game_state').select('status').eq('id', 1).single(),
      supabase.from('game_config').select('round_number, is_active, is_completed').eq('is_active', true).maybeSingle(),
    ])

    if (gsRes.data?.status === 'finished') {
      setPageState('finished')
      fetchClassement()
      return
    }

    if (roundRes.data) {
      const round = roundRes.data
      setActiveRound(round)
      const { data: existing } = await supabase
        .from('answers')
        .select('id')
        .eq('pseudo', currentPseudo)
        .eq('round_number', round.round_number)
        .maybeSingle()
      if (existing) {
        setPageState('answered')
        fetchClassement()
      } else {
        setSelection(EMPTY_SELECTION)
        setPageState('playing')
      }
    } else {
      setPageState(prev => (prev === 'answered' ? 'answered' : 'waiting'))
    }
  }, [fetchClassement])

  useEffect(() => {
    if (!activePseudo) return

    refreshGameState(activePseudo)

    const channel = supabase
      .channel('joueur-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_config' }, () => refreshGameState(activePseudo))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, () => refreshGameState(activePseudo))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchClassement)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activePseudo, refreshGameState, fetchClassement])

  async function joinGame() {
    if (!pseudo.trim()) return
    setLoading(true)
    const trimmed = pseudo.trim()
    await supabase
      .from('players')
      .upsert({ pseudo: trimmed, total_score: 0 }, { onConflict: 'pseudo', ignoreDuplicates: true })
    setActivePseudo(trimmed)
    setLoading(false)
  }

  async function submitAnswer() {
    if (!activeRound || !activePseudo) return
    setLoading(true)
    await supabase.from('answers').insert({
      pseudo: activePseudo,
      round_number: activeRound.round_number,
      pays: selection.pays || null,
      region: selection.region || null,
      appellation: selection.appellation || null,
      cepage: selection.cepage || null,
      commentaire: selection.commentaire || null,
      score: null,
    })
    setLoading(false)
    setPageState('answered')
    fetchClassement()
  }

  const paysOptions = vinsData.pays.map(p => p.nom)
  const selectedPays = vinsData.pays.find(p => p.nom === selection.pays)
  const regionOptions = selectedPays?.regions.map(r => r.nom) ?? []
  const selectedRegion = selectedPays?.regions.find(r => r.nom === selection.region)
  const appellationOptions = selectedRegion?.appellations ?? []
  const cepageOptions = selectedRegion?.cepages ?? []

  function updateSelection(field: keyof typeof selection, value: string) {
    setSelection(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'pays') { next.region = ''; next.appellation = ''; next.cepage = '' }
      if (field === 'region') { next.appellation = ''; next.cepage = '' }
      return next
    })
  }

  if (pageState === 'registration') {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">🥂</div>
          <h1 className="text-3xl font-bold text-white mb-2">Rejoindre</h1>
          <p className="text-slate-400 mb-8">Entrez votre pseudo pour participer</p>
          <input
            type="text"
            placeholder="Votre pseudo..."
            value={pseudo}
            onChange={e => setPseudo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && joinGame()}
            className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-red-600"
          />
          <button
            onClick={joinGame}
            disabled={!pseudo.trim() || loading}
            className="w-full bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl py-3 transition-colors"
          >
            {loading ? 'Connexion...' : 'Rejoindre le jeu'}
          </button>
        </div>
      </main>
    )
  }

  if (pageState === 'waiting') {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🍷</div>
          <h2 className="text-xl font-bold text-white mb-2">Bienvenue, {activePseudo} !</h2>
          <p className="text-slate-400">En attente du maître du jeu...</p>
          <p className="text-slate-500 text-sm mt-2">La prochaine manche commencera bientôt</p>
        </div>
      </main>
    )
  }

  if (pageState === 'playing' && activeRound) {
    return (
      <main className="min-h-screen p-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <p className="text-slate-400 text-sm">
              Joueur : <span className="text-white font-medium">{activePseudo}</span>
            </p>
            <span className="bg-red-800 text-white text-sm font-semibold px-4 py-1.5 rounded-full">
              Manche {activeRound.round_number}
            </span>
          </div>

          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mb-4 space-y-3">
            <h2 className="text-white font-bold text-lg mb-2">Identifiez ce vin</h2>

            <div>
              <label className="text-slate-400 text-xs mb-1 block">Pays</label>
              <select
                value={selection.pays}
                onChange={e => updateSelection('pays', e.target.value)}
                className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <option value="">Sélectionner...</option>
                {paysOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {selection.pays && (
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Région</label>
                <select
                  value={selection.region}
                  onChange={e => updateSelection('region', e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="">Sélectionner...</option>
                  {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            {selection.region && (
              <>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Appellation</label>
                  <select
                    value={selection.appellation}
                    onChange={e => updateSelection('appellation', e.target.value)}
                    className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-600"
                  >
                    <option value="">Sélectionner...</option>
                    {appellationOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Cépage dominant</label>
                  <select
                    value={selection.cepage}
                    onChange={e => updateSelection('cepage', e.target.value)}
                    className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-600"
                  >
                    <option value="">Sélectionner...</option>
                    {cepageOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="text-slate-400 text-xs mb-1 block">Commentaire (optionnel)</label>
              <textarea
                value={selection.commentaire}
                onChange={e => updateSelection('commentaire', e.target.value)}
                placeholder="Notes de dégustation..."
                rows={3}
                className="w-full bg-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-600 resize-none"
              />
            </div>
          </div>

          <button
            onClick={submitAnswer}
            disabled={loading || !selection.pays}
            className="w-full bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl py-3 transition-colors"
          >
            {loading ? 'Envoi...' : 'Valider ma réponse'}
          </button>
        </div>
      </main>
    )
  }

  if (pageState === 'answered') {
    return (
      <main className="min-h-screen p-6">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-green-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-white text-xl">✓</span>
            </div>
            <h2 className="text-white font-bold text-xl">Réponse enregistrée !</h2>
            <p className="text-slate-400 mt-1 text-sm">En attente de la prochaine manche...</p>
          </div>
          <Classement data={classement} myPseudo={activePseudo} />
        </div>
      </main>
    )
  }

  if (pageState === 'finished') {
    return (
      <main className="min-h-screen p-6">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🏆</div>
            <h1 className="text-3xl font-bold text-white mb-2">Fin de la dégustation !</h1>
            <p className="text-slate-400">Voici le classement final</p>
          </div>
          <Classement data={classement} myPseudo={activePseudo} final />
        </div>
      </main>
    )
  }

  return null
}

function Classement({
  data,
  myPseudo,
  final,
}: {
  data: PlayerScore[]
  myPseudo: string
  final?: boolean
}) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
      <h3 className="text-white font-bold text-lg mb-4">
        {final ? '🏆 Classement final' : '📊 Classement provisoire'}
      </h3>
      {data.length === 0 ? (
        <p className="text-slate-400 text-center py-4 text-sm">Aucun score pour le moment</p>
      ) : (
        <div className="space-y-2">
          {data.map((player, i) => (
            <div
              key={player.pseudo}
              className={`flex items-center justify-between px-4 py-3 rounded-xl ${
                player.pseudo === myPseudo
                  ? 'bg-red-900/40 border border-red-800'
                  : 'bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-sm">
                  {medals[i] ?? `${i + 1}.`}
                </span>
                <span className="text-white font-medium">{player.pseudo}</span>
                {player.pseudo === myPseudo && (
                  <span className="text-xs text-red-400">(vous)</span>
                )}
              </div>
              <span className="text-white font-bold">{player.total_score} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
