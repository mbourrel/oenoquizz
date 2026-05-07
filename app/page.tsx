'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import vinsData from '@/data/vins.json'

type PageState = 'init' | 'registration' | 'waiting' | 'playing' | 'answered' | 'finished'

interface PlayerScore { pseudo: string; total_score: number }
interface ActiveRound { round_number: number; is_active: boolean }

const EMPTY = { pays: '', region: '', appellation: '', cepage: '', millesime: '', commentaire: '' }
const MILLESIMES = Array.from({ length: 75 }, (_, i) => 2024 - i)
export default function HomePage() {
  const [pageState, setPageState] = useState<PageState>('init')
  const [pseudoInput, setPseudoInput] = useState('')
  const [activePseudo, setActivePseudo] = useState('')
  const [activeRound, setActiveRound] = useState<ActiveRound | null>(null)
  const [selection, setSelection] = useState(EMPTY)
  const [classement, setClassement] = useState<PlayerScore[]>([])
  const [loading, setLoading] = useState(false)

  const fetchClassement = useCallback(async () => {
    const { data } = await supabase
      .from('players')
      .select('pseudo, total_score')
      .order('total_score', { ascending: false })
    if (data) setClassement(data)
  }, [])

  const refreshGame = useCallback(async (pseudo: string) => {
    // Vérifie si le joueur existe encore (le MJ peut avoir relancé une nouvelle partie)
    const { data: me } = await supabase
      .from('players').select('pseudo').eq('pseudo', pseudo).maybeSingle()
    if (!me) {
      localStorage.removeItem('oenoquizz_pseudo')
      setActivePseudo('')
      setPseudoInput('')
      setPageState('registration')
      return
    }

    const [gsRes, roundRes] = await Promise.all([
      supabase.from('game_state').select('status').eq('id', 1).single(),
      supabase.from('game_config').select('round_number, is_active').eq('is_active', true).maybeSingle(),
    ])

    const gameStatus = gsRes.data?.status
    if (gameStatus === 'finished') {
      setPageState('finished')
      fetchClassement()
      return
    }
    // La partie a été réinitialisée pendant que le joueur attendait
    if (!gameStatus || gameStatus === 'setup') {
      setPageState('waiting')
      return
    }

    if (roundRes.data) {
      const round = roundRes.data
      setActiveRound(round)
      const { data: existing } = await supabase
        .from('answers')
        .select('id')
        .eq('pseudo', pseudo)
        .eq('round_number', round.round_number)
        .maybeSingle()
      if (existing) {
        setPageState('answered')
        fetchClassement()
      } else {
        setSelection(EMPTY)
        setPageState('playing')
      }
    } else {
      setPageState(prev => (prev === 'answered' ? 'answered' : 'waiting'))
    }
  }, [fetchClassement])

  // Restore pseudo from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('oenoquizz_pseudo')
    if (saved) {
      setActivePseudo(saved)
      setPseudoInput(saved)
    } else {
      setPageState('registration')
    }
  }, [])

  // Subscribe once pseudo is known
  useEffect(() => {
    if (!activePseudo) return
    refreshGame(activePseudo)

    const ch = supabase
      .channel('home-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_config' }, () => refreshGame(activePseudo))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, () => refreshGame(activePseudo))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchClassement)
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [activePseudo, refreshGame, fetchClassement])

  async function joinGame() {
    if (!pseudoInput.trim()) return
    setLoading(true)
    const trimmed = pseudoInput.trim()
    await supabase
      .from('players')
      .upsert({ pseudo: trimmed, total_score: 0 }, { onConflict: 'pseudo', ignoreDuplicates: true })
    localStorage.setItem('oenoquizz_pseudo', trimmed)
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
      millesime: selection.millesime ? parseInt(selection.millesime) : null,
      commentaire: selection.commentaire || null,
      score: null,
    })
    setLoading(false)
    setPageState('answered')
    fetchClassement()
  }

  function updateSel(field: string, value: string) {
    setSelection(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'pays') { next.region = ''; next.appellation = ''; next.cepage = '' }
      if (field === 'region') { next.appellation = ''; next.cepage = '' }
      return next
    })
  }

  const selPays = vinsData.pays.find(p => p.nom === selection.pays)
  const regionOpts = selPays?.regions.map(r => r.nom) ?? []
  const selRegion = selPays?.regions.find(r => r.nom === selection.region)
  const appellationOpts = selRegion?.appellations ?? []
  const cepageOpts = selRegion?.cepages ?? []

  /* ── Loading init ─────────────────────────────────── */
  if (pageState === 'init') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-5xl animate-pulse">🍷</div>
      </main>
    )
  }

  /* ── Registration ─────────────────────────────────── */
  if (pageState === 'registration') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">🍷</div>
          <h1 className="text-4xl font-bold text-white mb-2">OenoQuizz</h1>
          <p className="text-slate-400 mb-8">Le jeu de dégustation à l&apos;aveugle</p>

          <input
            type="text"
            placeholder="Votre pseudo..."
            value={pseudoInput}
            onChange={e => setPseudoInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && joinGame()}
            className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 mb-4 text-center focus:outline-none focus:ring-2 focus:ring-red-600"
          />
          <button
            onClick={joinGame}
            disabled={!pseudoInput.trim() || loading}
            className="w-full bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl py-3 mb-10 transition-colors"
          >
            {loading ? 'Connexion...' : 'Rejoindre →'}
          </button>

          <Link href="/mj" className="text-slate-600 hover:text-slate-400 text-xs transition-colors">
            Maître du jeu
          </Link>
        </div>
      </main>
    )
  }

  /* ── Waiting for game to start ────────────────────── */
  if (pageState === 'waiting') {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🍷</div>
          <h2 className="text-xl font-bold text-white mb-2">Bienvenue, {activePseudo} !</h2>
          <p className="text-slate-400">En attente du maître du jeu...</p>
          <p className="text-slate-500 text-sm mt-2">La première manche commencera bientôt</p>
        </div>
      </main>
    )
  }

  /* ── Playing ──────────────────────────────────────── */
  if (pageState === 'playing' && activeRound) {
    return (
      <main className="min-h-screen p-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <span className="text-slate-400 text-sm">
              Joueur : <span className="text-white font-medium">{activePseudo}</span>
            </span>
            <span className="bg-red-800 text-white text-sm font-semibold px-4 py-1.5 rounded-full">
              Manche {activeRound.round_number}
            </span>
          </div>

          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mb-4 space-y-3">
            <h2 className="text-white font-bold text-lg mb-2">Identifiez ce vin</h2>

            <div>
              <label className="text-slate-400 text-xs mb-1 block">Pays</label>
              <select value={selection.pays} onChange={e => updateSel('pays', e.target.value)}
                className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-600">
                <option value="">Sélectionner...</option>
                {vinsData.pays.map(p => <option key={p.nom} value={p.nom}>{p.nom}</option>)}
              </select>
            </div>

            {selection.pays && (
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Région</label>
                <select value={selection.region} onChange={e => updateSel('region', e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-600">
                  <option value="">Sélectionner...</option>
                  {regionOpts.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            {selection.region && (
              <>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Appellation</label>
                  <select value={selection.appellation} onChange={e => updateSel('appellation', e.target.value)}
                    className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-600">
                    <option value="">Sélectionner...</option>
                    {appellationOpts.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Cépage dominant</label>
                  <select value={selection.cepage} onChange={e => updateSel('cepage', e.target.value)}
                    className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-600">
                    <option value="">Sélectionner...</option>
                    {cepageOpts.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="text-slate-400 text-xs mb-1 block">Millésime (optionnel)</label>
              <select value={selection.millesime} onChange={e => updateSel('millesime', e.target.value)}
                className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-600">
                <option value="">Sélectionner...</option>
                {MILLESIMES.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label className="text-slate-400 text-xs mb-1 block">Commentaire (optionnel)</label>
              <textarea value={selection.commentaire} onChange={e => updateSel('commentaire', e.target.value)}
                placeholder="Notes de dégustation..." rows={3}
                className="w-full bg-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-600 resize-none" />
            </div>
          </div>

          <button onClick={submitAnswer} disabled={loading || !selection.pays}
            className="w-full bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl py-3 transition-colors">
            {loading ? 'Envoi...' : 'Valider ma réponse'}
          </button>
        </div>
      </main>
    )
  }

  /* ── Answered — waiting + leaderboard ────────────── */
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
          <LeaderboardCard data={classement} me={activePseudo} title="📊 Classement provisoire" />
        </div>
      </main>
    )
  }

  /* ── Finished ─────────────────────────────────────── */
  if (pageState === 'finished') {
    return (
      <main className="min-h-screen p-6">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🏆</div>
            <h1 className="text-3xl font-bold text-white mb-2">Fin de la dégustation !</h1>
            <p className="text-slate-400">Voici le classement final</p>
          </div>
          <LeaderboardCard data={classement} me={activePseudo} title="🏆 Classement final" />
        </div>
      </main>
    )
  }

  return null
}

function LeaderboardCard({
  data, me, title,
}: { data: PlayerScore[]; me: string; title: string }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
      <h3 className="text-white font-bold mb-4">{title}</h3>
      {data.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-4">Scores en cours de calcul...</p>
      ) : (
        <div className="space-y-2">
          {data.map((p, i) => (
            <div key={p.pseudo} className={`flex items-center justify-between px-4 py-3 rounded-xl ${
              p.pseudo === me ? 'bg-red-900/40 border border-red-800' : 'bg-slate-700'
            }`}>
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-sm">{medals[i] ?? `${i + 1}.`}</span>
                <span className="text-white font-medium">{p.pseudo}</span>
                {p.pseudo === me && <span className="text-xs text-red-400">(vous)</span>}
              </div>
              <span className="text-white font-bold">{p.total_score} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
