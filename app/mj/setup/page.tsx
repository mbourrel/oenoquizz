'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import vinsData from '@/data/vins.json'

interface BottleConfig {
  pays: string
  region: string
  appellation: string
  cepage: string
  nom_bouteille: string
}

const EMPTY: BottleConfig = { pays: '', region: '', appellation: '', cepage: '', nom_bouteille: '' }

export default function SetupPage() {
  const router = useRouter()
  const [rounds, setRounds] = useState<BottleConfig[]>([])
  const [current, setCurrent] = useState<BottleConfig>(EMPTY)
  const [saving, setSaving] = useState(false)

  const selectedPays = vinsData.pays.find(p => p.nom === current.pays)
  const regionOptions = selectedPays?.regions.map(r => r.nom) ?? []
  const selectedRegion = selectedPays?.regions.find(r => r.nom === current.region)
  const appellationOptions = selectedRegion?.appellations ?? []
  const cepageOptions = selectedRegion?.cepages ?? []

  function update(field: keyof BottleConfig, value: string) {
    setCurrent(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'pays') { next.region = ''; next.appellation = ''; next.cepage = '' }
      if (field === 'region') { next.appellation = ''; next.cepage = '' }
      return next
    })
  }

  function addBottle() {
    if (!current.pays || !current.region || !current.appellation || !current.cepage) return
    setRounds(prev => [...prev, { ...current }])
    setCurrent(EMPTY)
  }

  function removeBottle(index: number) {
    setRounds(prev => prev.filter((_, i) => i !== index))
  }

  async function launchGame() {
    if (rounds.length === 0) return
    setSaving(true)

    await Promise.all([
      supabase.from('game_config').delete().gte('id', 0),
      supabase.from('answers').delete().gte('id', 0),
      supabase.from('players').update({ total_score: 0 }).gte('id', 0),
    ])

    await supabase.from('game_config').insert(
      rounds.map((r, i) => ({
        round_number: i + 1,
        pays: r.pays,
        region: r.region,
        appellation: r.appellation,
        cepage: r.cepage,
        nom_bouteille: r.nom_bouteille || null,
        is_active: false,
        is_completed: false,
      }))
    )

    await supabase.from('game_state').upsert({ id: 1, status: 'playing' })

    setSaving(false)
    router.push('/mj/jeu')
  }

  const canAdd = current.pays && current.region && current.appellation && current.cepage

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/mj')} className="text-slate-400 hover:text-white transition-colors">
            ← Retour
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Configurer les bouteilles</h1>
            <p className="text-slate-400 text-sm">Une bouteille par manche — les joueurs devront les identifier</p>
          </div>
        </div>

        {/* Add bottle form */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mb-6">
          <h2 className="text-white font-semibold mb-4">
            Ajouter la bouteille {rounds.length + 1}
          </h2>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Pays *</label>
              <select
                value={current.pays}
                onChange={e => update('pays', e.target.value)}
                className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <option value="">Sélectionner...</option>
                {vinsData.pays.map(p => <option key={p.nom} value={p.nom}>{p.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Région *</label>
              <select
                value={current.region}
                onChange={e => update('region', e.target.value)}
                disabled={!current.pays}
                className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-40"
              >
                <option value="">Sélectionner...</option>
                {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Appellation *</label>
              <select
                value={current.appellation}
                onChange={e => update('appellation', e.target.value)}
                disabled={!current.region}
                className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-40"
              >
                <option value="">Sélectionner...</option>
                {appellationOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Cépage *</label>
              <select
                value={current.cepage}
                onChange={e => update('cepage', e.target.value)}
                disabled={!current.region}
                className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-40"
              >
                <option value="">Sélectionner...</option>
                {cepageOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-slate-400 text-xs mb-1 block">Nom de la bouteille (optionnel)</label>
            <input
              type="text"
              value={current.nom_bouteille}
              onChange={e => update('nom_bouteille', e.target.value)}
              placeholder="Ex : Château Margaux 2018"
              className="w-full bg-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <button
            onClick={addBottle}
            disabled={!canAdd}
            className="w-full bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
          >
            + Ajouter cette bouteille
          </button>
        </div>

        {/* Rounds list */}
        {rounds.length > 0 && (
          <div className="space-y-3 mb-6">
            <h2 className="text-white font-semibold text-sm uppercase tracking-wide">
              Manches configurées ({rounds.length})
            </h2>
            {rounds.map((r, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-red-800 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      Manche {i + 1}
                    </span>
                    {r.nom_bouteille && (
                      <span className="text-slate-200 text-sm font-medium">{r.nom_bouteille}</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">
                    {r.pays} › {r.region} › {r.appellation} · {r.cepage}
                  </p>
                </div>
                <button
                  onClick={() => removeBottle(i)}
                  className="text-slate-600 hover:text-red-400 ml-4 text-lg leading-none transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={launchGame}
          disabled={rounds.length === 0 || saving}
          className="w-full bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl py-3 transition-colors"
        >
          {saving
            ? 'Lancement...'
            : `Lancer la partie (${rounds.length} manche${rounds.length > 1 ? 's' : ''})`}
        </button>
      </div>
    </main>
  )
}
