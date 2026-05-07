'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Round {
  round_number: number
  pays: string
  region: string
  appellation: string
  cepage: string
  nom_bouteille: string | null
}

interface Answer {
  id: number
  pseudo: string
  round_number: number
  pays: string | null
  region: string | null
  appellation: string | null
  cepage: string | null
  commentaire: string | null
  score: number | null
}

interface FinalPlayer {
  pseudo: string
  total: number
}

function autoScore(answer: Answer, round: Round): number {
  let pts = 0
  if (answer.pays === round.pays) pts += 1
  if (answer.region === round.region) pts += 1
  if (answer.appellation === round.appellation) pts += 2
  if (answer.cepage === round.cepage) pts += 1
  return pts
}

export default function CorrectionPage() {
  const router = useRouter()
  const [rounds, setRounds] = useState<Round[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  // key: `${pseudo}__${round_number}`
  const [scores, setScores] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [finalRanking, setFinalRanking] = useState<FinalPlayer[]>([])

  useEffect(() => {
    async function load() {
      const [roundsRes, answersRes] = await Promise.all([
        supabase.from('game_config').select('round_number, pays, region, appellation, cepage, nom_bouteille').order('round_number'),
        supabase.from('answers').select('id, pseudo, round_number, pays, region, appellation, cepage, commentaire, score').order('pseudo'),
      ])

      const roundsData: Round[] = roundsRes.data ?? []
      const answersData: Answer[] = answersRes.data ?? []

      setRounds(roundsData)
      setAnswers(answersData)

      const initial: Record<string, number> = {}
      answersData.forEach(a => {
        const round = roundsData.find(r => r.round_number === a.round_number)
        if (round) {
          initial[`${a.pseudo}__${a.round_number}`] = a.score ?? autoScore(a, round)
        }
      })
      setScores(initial)
      setLoading(false)
    }
    load()
  }, [])

  function setScore(pseudo: string, roundNumber: number, raw: string) {
    const val = Math.max(0, parseInt(raw) || 0)
    setScores(prev => ({ ...prev, [`${pseudo}__${roundNumber}`]: val }))
  }

  function getScore(pseudo: string, roundNumber: number): number {
    return scores[`${pseudo}__${roundNumber}`] ?? 0
  }

  function playerTotals(): FinalPlayer[] {
    const pseudos = [...new Set(answers.map(a => a.pseudo))]
    return pseudos
      .map(pseudo => ({
        pseudo,
        total: answers
          .filter(a => a.pseudo === pseudo)
          .reduce((sum, a) => sum + getScore(a.pseudo, a.round_number), 0),
      }))
      .sort((a, b) => b.total - a.total)
  }

  async function publish() {
    setPublishing(true)

    for (const answer of answers) {
      await supabase
        .from('answers')
        .update({ score: getScore(answer.pseudo, answer.round_number) })
        .eq('id', answer.id)
    }

    const totals = playerTotals()
    for (const { pseudo, total } of totals) {
      await supabase.from('players').update({ total_score: total }).eq('pseudo', pseudo)
    }

    await supabase.from('game_state').upsert({ id: 1, status: 'finished' })

    setFinalRanking(totals)
    setPublishing(false)
    setPublished(true)
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">Chargement...</p>
      </main>
    )
  }

  if (published) {
    const medals = ['🥇', '🥈', '🥉']
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-lg mx-auto text-center">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-3xl font-bold text-white mb-2">Classement publié !</h1>
          <p className="text-slate-400 mb-8">Les joueurs voient maintenant le classement final</p>

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

          <button
            onClick={() => router.push('/mj')}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-3 transition-colors"
          >
            Retour au tableau de bord
          </button>
        </div>
      </main>
    )
  }

  const totals = playerTotals()

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/mj/jeu')} className="text-slate-400 hover:text-white transition-colors">
            ← Retour
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Correction & Scores</h1>
            <p className="text-slate-400 text-sm">
              Scores calculés automatiquement — ajustez si nécessaire (5 pts max par manche)
            </p>
          </div>
        </div>

        {/* Round-by-round correction */}
        <div className="space-y-8 mb-10">
          {rounds.map(round => {
            const roundAnswers = answers.filter(a => a.round_number === round.round_number)
            return (
              <div key={round.round_number} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                <div className="bg-slate-700 px-6 py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-red-800 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      Manche {round.round_number}
                    </span>
                    {round.nom_bouteille && (
                      <span className="text-white font-semibold">{round.nom_bouteille}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span className="text-green-400">Pays : {round.pays}</span>
                    <span className="text-green-400">Région : {round.region}</span>
                    <span className="text-green-400">Appellation : {round.appellation} (+2)</span>
                    <span className="text-green-400">Cépage : {round.cepage}</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-700">
                  {roundAnswers.length === 0 ? (
                    <p className="text-slate-500 text-sm p-4">Aucune réponse</p>
                  ) : (
                    roundAnswers.map(answer => (
                      <div key={answer.id} className="p-4 flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium mb-2">{answer.pseudo}</p>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            <Field label="Pays" value={answer.pays} correct={round.pays} />
                            <Field label="Région" value={answer.region} correct={round.region} />
                            <Field label="Appellation" value={answer.appellation} correct={round.appellation} />
                            <Field label="Cépage" value={answer.cepage} correct={round.cepage} />
                          </div>
                          {answer.commentaire && (
                            <p className="text-slate-400 text-xs mt-2 italic">
                              &ldquo;{answer.commentaire}&rdquo;
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-center">
                          <p className="text-slate-400 text-xs mb-1">Pts</p>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={getScore(answer.pseudo, answer.round_number)}
                            onChange={e => setScore(answer.pseudo, answer.round_number, e.target.value)}
                            className="w-14 bg-slate-700 text-white text-center rounded-lg py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Score summary + publish */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Récapitulatif</h3>
          {totals.length === 0 ? (
            <p className="text-slate-500 text-sm">Aucun joueur</p>
          ) : (
            <div className="space-y-2">
              {totals.map((p, i) => (
                <div key={p.pseudo} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400 w-5">{i + 1}.</span>
                    <span className="text-white">{p.pseudo}</span>
                  </div>
                  <span className="text-white font-semibold">{p.total} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={publish}
          disabled={publishing || totals.length === 0}
          className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
        >
          {publishing ? 'Publication...' : '🏆 Publier le classement final'}
        </button>
      </div>
    </main>
  )
}

function Field({
  label,
  value,
  correct,
}: {
  label: string
  value: string | null
  correct: string
}) {
  const ok = value === correct
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 w-20 shrink-0">{label} :</span>
      <span className={value ? (ok ? 'text-green-400' : 'text-red-400') : 'text-slate-600'}>
        {value ?? '—'}
      </span>
      {!ok && value && (
        <span className="text-slate-600 text-xs truncate">(→ {correct})</span>
      )}
    </div>
  )
}
