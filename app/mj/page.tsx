'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import vinsData from '@/data/vins.json'

/* ── Types ─────────────────────────────────────────────── */

interface BottleConfig {
  pays: string; region: string; appellation: string; cepage: string
  nom_bouteille: string; millesime: string
}
interface Round {
  id: number; round_number: number; pays: string; region: string
  appellation: string; cepage: string; nom_bouteille: string | null
  millesime: number | null; is_active: boolean; is_completed: boolean
}
interface Answer {
  id: number; pseudo: string; round_number: number
  pays: string | null; region: string | null; appellation: string | null
  cepage: string | null; millesime: number | null; commentaire: string | null; score: number | null
}
interface Ranking { pseudo: string; total: number }

type GameStatus = 'setup' | 'playing' | 'finished'

const EMPTY_BOTTLE: BottleConfig = { pays: '', region: '', appellation: '', cepage: '', nom_bouteille: '', millesime: '' }
const MILLESIMES = Array.from({ length: 75 }, (_, i) => 2024 - i)

function calcScore(a: Answer, r: Round): number {
  let pts = 0
  if (a.pays === r.pays) pts += 1
  if (a.region === r.region) pts += 1
  if (a.appellation === r.appellation) pts += 2
  if (a.cepage === r.cepage) pts += 1
  if (r.millesime != null && a.millesime != null) {
    const diff = Math.abs(a.millesime - r.millesime)
    if (diff === 0) pts += 2
    else if (diff <= 2) pts += 1
  }
  return pts
}

/* ── Page ──────────────────────────────────────────────── */

export default function MJPage() {
  const [gameStatus, setGameStatus] = useState<GameStatus>('setup')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  /* setup */
  const [bottles, setBottles] = useState<BottleConfig[]>([])
  const [current, setCurrent] = useState<BottleConfig>(EMPTY_BOTTLE)

  /* playing */
  const [rounds, setRounds] = useState<Round[]>([])
  const [players, setPlayers] = useState<string[]>([])
  const [playerCount, setPlayerCount] = useState(0)
  const [answerCounts, setAnswerCounts] = useState<Record<number, number>>({})

  /* scoring (lazy — loaded when all rounds done) */
  const [answers, setAnswers] = useState<Answer[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [scoringReady, setScoringReady] = useState(false)

  /* finished */
  const [finalRanking, setFinalRanking] = useState<Ranking[]>([])

  /* ── Loaders ─────────────────────────────────────────── */

  const loadAnswerCounts = useCallback(async () => {
    const { data } = await supabase.from('answers').select('round_number')
    if (!data) return
    const counts: Record<number, number> = {}
    data.forEach(a => { counts[a.round_number] = (counts[a.round_number] ?? 0) + 1 })
    setAnswerCounts(counts)
  }, [])

  const loadAnswers = useCallback(async (roundsData: Round[]) => {
    const { data } = await supabase
      .from('answers')
      .select('id, pseudo, round_number, pays, region, appellation, cepage, millesime, commentaire, score')
      .order('pseudo')
    const ans: Answer[] = data ?? []
    setAnswers(ans)
    const init: Record<string, number> = {}
    ans.forEach(a => {
      const r = roundsData.find(r => r.round_number === a.round_number)
      if (r) init[`${a.pseudo}__${a.round_number}`] = a.score ?? calcScore(a, r)
    })
    setScores(init)
    setScoringReady(true)
  }, [])

  const loadRounds = useCallback(async (): Promise<Round[]> => {
    const { data } = await supabase.from('game_config').select('*').order('round_number')
    const r = (data ?? []) as Round[]
    setRounds(r)
    return r
  }, [])

  const loadPlayers = useCallback(async () => {
    const { data } = await supabase.from('players').select('pseudo').order('pseudo')
    const pseudos = data?.map(p => p.pseudo) ?? []
    setPlayers(pseudos)
    setPlayerCount(pseudos.length)
  }, [])

  const loadFinalRanking = useCallback(async () => {
    const { data } = await supabase
      .from('players').select('pseudo, total_score').order('total_score', { ascending: false })
    setFinalRanking(data?.map(p => ({ pseudo: p.pseudo, total: p.total_score })) ?? [])
  }, [])

  /* ── Init + subscriptions ────────────────────────────── */

  useEffect(() => {
    async function init() {
      const { data: gs } = await supabase.from('game_state').select('status').eq('id', 1).single()
      const status = (gs?.status ?? 'setup') as GameStatus
      setGameStatus(status)

      if (status === 'setup') { setLoading(false); return }

      const roundsData = await loadRounds()
      await Promise.all([loadAnswerCounts(), loadPlayers()])

      if (status === 'finished') {
        await loadFinalRanking()
      } else if (roundsData.every(r => r.is_completed)) {
        await loadAnswers(roundsData)
      }
      setLoading(false)
    }
    init()

    const ch = supabase.channel('mj-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_config' }, async () => {
        const r = await loadRounds()
        await loadAnswerCounts()
        if (r.every(x => x.is_completed) && !scoringReady) await loadAnswers(r)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers' }, loadAnswerCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, loadPlayers)
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load scoring section when all rounds complete
  useEffect(() => {
    if (rounds.length > 0 && rounds.every(r => r.is_completed) && !scoringReady) {
      loadAnswers(rounds)
    }
  }, [rounds, scoringReady, loadAnswers])

  /* ── Setup actions ───────────────────────────────────── */

  function updateBottle(field: keyof BottleConfig, value: string) {
    setCurrent(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'pays') { next.region = ''; next.appellation = ''; next.cepage = '' }
      if (field === 'region') { next.appellation = ''; next.cepage = '' }
      return next
    })
  }

  async function launchGame() {
    if (bottles.length === 0) return
    setBusy(true)

    // Nettoyage complet — colonnes garanties d'exister dans chaque table
    await Promise.all([
      supabase.from('game_config').delete().neq('round_number', 0),
      supabase.from('answers').delete().neq('round_number', 0),
      supabase.from('players').delete().neq('pseudo', ''),
    ])

    const { error } = await supabase.from('game_config').insert(
      bottles.map((b, i) => ({
        round_number: i + 1, pays: b.pays, region: b.region,
        appellation: b.appellation, cepage: b.cepage,
        nom_bouteille: b.nom_bouteille || null,
        millesime: b.millesime ? parseInt(b.millesime) : null,
        is_active: false, is_completed: false,
      }))
    )
    if (error) {
      alert('Erreur lors de la création des manches :\n' + error.message + '\n\nAvez-vous exécuté SCHEMA.sql dans Supabase ?')
      setBusy(false)
      return
    }

    await supabase.from('game_state').upsert({ id: 1, status: 'playing' })
    await loadRounds()
    setPlayers([])
    setPlayerCount(0)
    setAnswerCounts({})
    setScoringReady(false)
    setGameStatus('playing')
    setBusy(false)
  }

  /* ── Playing actions ─────────────────────────────────── */

  async function startRound(n: number) {
    setBusy(true)
    await supabase.from('game_config').update({ is_active: false }).neq('round_number', 0)
    await supabase.from('game_config').update({ is_active: true }).eq('round_number', n)
    setBusy(false)
  }

  async function endRound(n: number) {
    setBusy(true)
    await supabase.from('game_config').update({ is_active: false, is_completed: true }).eq('round_number', n)
    setBusy(false)
  }

  /* ── Scoring actions ─────────────────────────────────── */

  const getScore = (pseudo: string, rn: number) => scores[`${pseudo}__${rn}`] ?? 0
  const setScore = (pseudo: string, rn: number, raw: string) =>
    setScores(prev => ({ ...prev, [`${pseudo}__${rn}`]: Math.max(0, parseInt(raw) || 0) }))

  function playerTotals(): Ranking[] {
    const pseudos = [...new Set(answers.map(a => a.pseudo))]
    return pseudos
      .map(p => ({ pseudo: p, total: answers.filter(a => a.pseudo === p).reduce((s, a) => s + getScore(a.pseudo, a.round_number), 0) }))
      .sort((a, b) => b.total - a.total)
  }

  async function publishScores() {
    setBusy(true)
    for (const a of answers) {
      await supabase.from('answers').update({ score: getScore(a.pseudo, a.round_number) }).eq('id', a.id)
    }
    for (const { pseudo, total } of playerTotals()) {
      await supabase.from('players').update({ total_score: total }).eq('pseudo', pseudo)
    }
    await supabase.from('game_state').upsert({ id: 1, status: 'finished' })
    await loadFinalRanking()
    setGameStatus('finished')
    setBusy(false)
  }

  async function resetGame() {
    if (!confirm('Réinitialiser la partie ? Toutes les données seront supprimées.')) return
    await Promise.all([
      supabase.from('game_config').delete().neq('round_number', 0),
      supabase.from('answers').delete().neq('round_number', 0),
      supabase.from('players').delete().neq('pseudo', ''),
      supabase.from('game_state').upsert({ id: 1, status: 'setup' }),
    ])
    setBottles([]); setCurrent(EMPTY_BOTTLE); setRounds([])
    setAnswers([]); setScores({}); setScoringReady(false)
    setFinalRanking([]); setGameStatus('setup')
  }

  /* ── Render ──────────────────────────────────────────── */

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-slate-400">Chargement...</p></main>
  }

  /* ── FINISHED ── */
  if (gameStatus === 'finished') {
    const medals = ['🥇', '🥈', '🥉']
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-lg mx-auto text-center">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-3xl font-bold text-white mb-2">Classement final</h1>
          <p className="text-slate-400 mb-8">Les joueurs voient ce classement en temps réel</p>
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mb-6">
            {finalRanking.map((p, i) => (
              <div key={p.pseudo} className="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center">{medals[i] ?? `${i + 1}.`}</span>
                  <span className="text-white font-medium">{p.pseudo}</span>
                </div>
                <span className="text-white font-bold">{p.total} pts</span>
              </div>
            ))}
          </div>
          <button onClick={resetGame} className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-3 transition-colors">
            Nouvelle partie
          </button>
        </div>
      </main>
    )
  }

  /* ── SETUP ── */
  if (gameStatus === 'setup') {
    const selPays = vinsData.pays.find(p => p.nom === current.pays)
    const regionOpts = selPays?.regions.map(r => r.nom) ?? []
    const selRegion = selPays?.regions.find(r => r.nom === current.region)
    const appellationOpts = selRegion?.appellations ?? []
    const cepageOpts = selRegion?.cepages ?? []
    const canAdd = !!(current.pays && current.region && current.appellation && current.cepage)

    return (
      <main className="min-h-screen p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">OenoQuizz — Maître du jeu</h1>
            <p className="text-slate-400 text-sm">Ajoutez une bouteille par manche, puis lancez la partie</p>
          </div>

          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mb-6">
            <h2 className="text-white font-semibold mb-4">Bouteille {bottles.length + 1}</h2>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Pays *</label>
                <select value={current.pays} onChange={e => updateBottle('pays', e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600">
                  <option value="">Sélectionner...</option>
                  {vinsData.pays.map(p => <option key={p.nom} value={p.nom}>{p.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Région *</label>
                <select value={current.region} onChange={e => updateBottle('region', e.target.value)} disabled={!current.pays}
                  className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-40">
                  <option value="">Sélectionner...</option>
                  {regionOpts.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Appellation *</label>
                <select value={current.appellation} onChange={e => updateBottle('appellation', e.target.value)} disabled={!current.region}
                  className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-40">
                  <option value="">Sélectionner...</option>
                  {appellationOpts.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Cépage *</label>
                <select value={current.cepage} onChange={e => updateBottle('cepage', e.target.value)} disabled={!current.region}
                  className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-40">
                  <option value="">Sélectionner...</option>
                  {cepageOpts.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Millésime (optionnel)</label>
                <select value={current.millesime} onChange={e => updateBottle('millesime', e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600">
                  <option value="">Sélectionner...</option>
                  {MILLESIMES.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Nom de la bouteille (optionnel)</label>
                <input type="text" value={current.nom_bouteille} onChange={e => updateBottle('nom_bouteille', e.target.value)}
                  placeholder="Ex : Château Margaux"
                  className="w-full bg-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600" />
              </div>
            </div>

            <button onClick={() => { if (!canAdd) return; setBottles(p => [...p, { ...current }]); setCurrent(EMPTY_BOTTLE) }}
              disabled={!canAdd}
              className="w-full bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">
              + Ajouter cette bouteille
            </button>
          </div>

          {bottles.length > 0 && (
            <div className="space-y-2 mb-6">
              {bottles.map((b, i) => (
                <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-red-800 text-white text-xs font-bold px-2 py-0.5 rounded-full">{i + 1}</span>
                      {b.nom_bouteille && <span className="text-white text-sm font-medium">{b.nom_bouteille}</span>}
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">{b.pays} › {b.region} › {b.appellation} · {b.cepage}{b.millesime ? ` · ${b.millesime}` : ''}</p>
                  </div>
                  <button onClick={() => setBottles(p => p.filter((_, j) => j !== i))}
                    className="text-slate-600 hover:text-red-400 text-xl ml-3 transition-colors">×</button>
                </div>
              ))}
            </div>
          )}

          <button onClick={launchGame} disabled={bottles.length === 0 || busy}
            className="w-full bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl py-3 transition-colors">
            {busy ? 'Lancement...' : `Lancer la partie (${bottles.length} manche${bottles.length > 1 ? 's' : ''})`}
          </button>
        </div>
      </main>
    )
  }

  /* ── PLAYING (+ scoring when all done) ── */
  const activeRound = rounds.find(r => r.is_active) ?? null
  // Strict check : null/undefined (colonne absente) → pas terminé
  const allDone = rounds.length > 0 && rounds.every(r => r.is_completed === true)
  const totals = playerTotals()
  const medals = ['🥇', '🥈', '🥉']

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Gestion de la partie</h1>
            <p className="text-slate-400 text-sm">
              {playerCount} joueur{playerCount !== 1 ? 's' : ''} connecté{playerCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={resetGame} className="text-slate-600 hover:text-red-400 text-sm transition-colors">
            Réinitialiser
          </button>
        </div>

        {/* Players list */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-6">
          <p className="text-slate-400 text-sm mb-2">
            {playerCount === 0
              ? 'En attente des joueurs...'
              : `${playerCount} joueur${playerCount > 1 ? 's' : ''} inscrit${playerCount > 1 ? 's' : ''}`}
          </p>
          {players.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {players.map(p => (
                <span key={p} className="bg-slate-700 text-slate-200 text-xs px-3 py-1 rounded-full">{p}</span>
              ))}
            </div>
          )}
        </div>

        {/* Active round banner */}
        {activeRound && (
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 font-medium text-sm">Manche {activeRound.round_number} en cours</span>
              </div>
              <p className="text-white text-sm">
                {answerCounts[activeRound.round_number] ?? 0} / {playerCount} réponse{playerCount !== 1 ? 's' : ''} reçue{playerCount !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={() => endRound(activeRound.round_number)} disabled={busy}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-4 py-2 transition-colors">
              Terminer la manche
            </button>
          </div>
        )}

        {/* Rounds list */}
        <div className="space-y-3 mb-8">
          {rounds.map(round => {
            const cnt = answerCounts[round.round_number] ?? 0
            const canStart = !activeRound && round.is_completed !== true
            return (
              <div key={round.id} className={`rounded-xl p-4 border ${
                round.is_active ? 'bg-green-900/20 border-green-800' :
                round.is_completed ? 'bg-slate-800/40 border-slate-700/50 opacity-60' :
                'bg-slate-800 border-slate-700'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${round.is_active ? 'bg-green-800 text-green-200' : 'bg-slate-700 text-slate-300'}`}>
                        Manche {round.round_number}
                      </span>
                      {round.nom_bouteille && <span className="text-white text-sm font-medium">{round.nom_bouteille}</span>}
                      {round.is_completed && <span className="text-slate-500 text-xs">✓ {cnt} rép.</span>}
                    </div>
                    <p className="text-slate-400 text-xs">{round.pays} › {round.region} › {round.appellation} · {round.cepage}{round.millesime ? ` · ${round.millesime}` : ''}</p>
                    {round.is_active && <p className="text-green-400 text-xs mt-1">{cnt} / {playerCount} réponse{playerCount !== 1 ? 's' : ''}</p>}
                  </div>
                  {canStart && (
                    <button onClick={() => startRound(round.round_number)} disabled={busy}
                      className="ml-4 shrink-0 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-4 py-2 transition-colors">
                      Démarrer
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Scoring section — appears when all rounds done ── */}
        {allDone && (
          <div className="border-t border-slate-700 pt-8">
            <h2 className="text-xl font-bold text-white mb-1">Correction des scores</h2>
            <p className="text-slate-400 text-sm mb-6">
              Scores calculés automatiquement — pays +1, région +1, appellation +2, cépage +1, millésime exact +2 (±2 ans +1) — ajustez si besoin
            </p>

            {!scoringReady ? (
              <p className="text-slate-400 text-sm">Chargement des réponses...</p>
            ) : (
              <>
                <div className="space-y-6 mb-8">
                  {rounds.map(round => {
                    const roundAnswers = answers.filter(a => a.round_number === round.round_number)
                    return (
                      <div key={round.round_number} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                        <div className="bg-slate-700 px-5 py-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-red-800 text-white text-xs font-bold px-2 py-0.5 rounded-full">Manche {round.round_number}</span>
                            {round.nom_bouteille && <span className="text-white font-semibold text-sm">{round.nom_bouteille}</span>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 text-xs text-green-400">
                            <span>Pays : {round.pays}</span>
                            <span>Région : {round.region}</span>
                            <span>Appellation : {round.appellation} (+2)</span>
                            <span>Cépage : {round.cepage}</span>
                            {round.millesime && <span>Millésime : {round.millesime} (+2/+1)</span>}
                          </div>
                        </div>
                        <div className="divide-y divide-slate-700">
                          {roundAnswers.length === 0 ? (
                            <p className="text-slate-500 text-sm p-4">Aucune réponse</p>
                          ) : roundAnswers.map(a => (
                            <div key={a.id} className="p-4 flex items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-medium mb-2">{a.pseudo}</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                  <FieldRow label="Pays" value={a.pays} correct={round.pays} />
                                  <FieldRow label="Région" value={a.region} correct={round.region} />
                                  <FieldRow label="Appellation" value={a.appellation} correct={round.appellation} />
                                  <FieldRow label="Cépage" value={a.cepage} correct={round.cepage} />
                                  {round.millesime != null && (
                                    <MillesimeRow value={a.millesime} correct={round.millesime} />
                                  )}
                                </div>
                                {a.commentaire && <p className="text-slate-400 text-xs mt-1.5 italic">&ldquo;{a.commentaire}&rdquo;</p>}
                              </div>
                              <div className="shrink-0 text-center">
                                <p className="text-slate-400 text-xs mb-1">Pts</p>
                                <input type="number" min={0} max={20}
                                  value={getScore(a.pseudo, a.round_number)}
                                  onChange={e => setScore(a.pseudo, a.round_number, e.target.value)}
                                  className="w-14 bg-slate-700 text-white text-center rounded-lg py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Totals summary */}
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-4">
                  <h3 className="text-white font-semibold mb-3">Récapitulatif</h3>
                  <div className="space-y-2">
                    {totals.map((p, i) => (
                      <div key={p.pseudo} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-center">{medals[i] ?? `${i + 1}.`}</span>
                          <span className="text-white">{p.pseudo}</span>
                        </div>
                        <span className="text-white font-semibold">{p.total} pts</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={publishScores} disabled={busy || answers.length === 0}
                  className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors">
                  {busy ? 'Publication...' : '🏆 Publier le classement final'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

/* ── Sub-component ─────────────────────────────────────── */

function FieldRow({ label, value, correct }: { label: string; value: string | null; correct: string }) {
  const ok = value === correct
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-500 w-20 shrink-0">{label} :</span>
      <span className={value ? (ok ? 'text-green-400' : 'text-red-400') : 'text-slate-600'}>{value ?? '—'}</span>
      {!ok && value && <span className="text-slate-600 text-xs">(→ {correct})</span>}
    </div>
  )
}

function MillesimeRow({ value, correct }: { value: number | null; correct: number }) {
  const diff = value != null ? Math.abs(value - correct) : null
  const color = diff == null ? 'text-slate-600' : diff === 0 ? 'text-green-400' : diff <= 2 ? 'text-yellow-400' : 'text-red-400'
  const hint = diff == null ? null : diff === 0 ? '+2' : diff <= 2 ? '+1' : `(→ ${correct})`
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-500 w-20 shrink-0">Millésime :</span>
      <span className={color}>{value ?? '—'}</span>
      {hint && <span className="text-slate-500 text-xs">{hint}</span>}
    </div>
  )
}
