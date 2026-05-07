'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import vinsData from '../../../data/vins.json'

export default function SetupPage() {
  const [rounds, setRounds] = useState<any[]>([])
  const [currentRound, setCurrentRound] = useState({ pays: '', region: '', appellation: '', cepage: '' })

  const paysData = vinsData.pays
  const regionsDispo = currentRound.pays ? paysData.find(p => p.nom === currentRound.pays)?.regions || [] : []
  const regionData = regionsDispo.find(r => r.nom === currentRound.region)

  const addRound = () => {
    if (!currentRound.pays || !currentRound.appellation) return alert("Remplis au moins le pays et l'appellation !")
    setRounds([...rounds, { ...currentRound }])
    setCurrentRound({ pays: '', region: '', appellation: '', cepage: '' })
  }

  const saveGame = async () => {
    // On vide l'ancienne config avant d'injecter la nouvelle
    await supabase.from('game_config').delete().gte('round_number', 0)

    const toInsert = rounds.map((r, i) => ({
      round_number: i + 1,
      ...r,
      is_active: i === 0 // La manche 1 est active immédiatement
    }))

    const { error } = await supabase.from('game_config').insert(toInsert)
    
    if (error) {
      alert("Erreur : " + error.message)
    } else {
      alert("Partie prête ! Manche 1 activée. Direction la Console MJ.")
      setRounds([])
    }
  }

  return (
    <div className="p-8 bg-slate-900 min-h-screen text-white font-sans">
      <h1 className="text-3xl font-bold mb-8 text-red-500">⚙️ Préparation des Bouteilles</h1>
      
      <div className="bg-slate-800 p-6 rounded-2xl mb-8 border border-slate-700 shadow-xl space-y-4">
        <h2 className="font-bold text-lg">Prochaine bouteille (Manche {rounds.length + 1})</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select 
            className="p-3 bg-slate-700 rounded-xl outline-none"
            value={currentRound.pays}
            onChange={(e) => setCurrentRound({...currentRound, pays: e.target.value, region: '', appellation: '', cepage: ''})}
          >
            <option value="">Choisir Pays...</option>
            {paysData.map(p => <option key={p.nom} value={p.nom}>{p.nom}</option>)}
          </select>

          <select 
            className="p-3 bg-slate-700 rounded-xl outline-none"
            value={currentRound.region}
            onChange={(e) => setCurrentRound({...currentRound, region: e.target.value, appellation: '', cepage: ''})}
            disabled={!currentRound.pays}
          >
            <option value="">Choisir Région...</option>
            {regionsDispo.map(r => <option key={r.nom} value={r.nom}>{r.nom}</option>)}
          </select>

          <select 
            className="p-3 bg-slate-700 rounded-xl outline-none"
            value={currentRound.appellation}
            onChange={(e) => setCurrentRound({...currentRound, appellation: e.target.value})}
            disabled={!currentRound.region}
          >
            <option value="">Choisir Appellation...</option>
            {regionData?.appellations.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <select 
            className="p-3 bg-slate-700 rounded-xl outline-none"
            value={currentRound.cepage}
            onChange={(e) => setCurrentRound({...currentRound, cepage: e.target.value})}
            disabled={!currentRound.region}
          >
            <option value="">Choisir Cépage...</option>
            {regionData?.cepages.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <button onClick={addRound} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-all">
          Ajouter cette bouteille
        </button>
      </div>

      <div className="space-y-3">
        {rounds.map((r, i) => (
          <div key={i} className="p-4 bg-slate-800 border-l-4 border-yellow-500 rounded-r-xl flex justify-between items-center">
            <div>
              <span className="text-yellow-500 font-bold mr-4 uppercase text-xs">Bouteille {i+1}</span>
              <span className="font-semibold">{r.appellation} ({r.pays})</span>
            </div>
            <button onClick={() => setRounds(rounds.filter((_, idx) => idx !== i))} className="text-red-400 text-sm">Supprimer</button>
          </div>
        ))}
      </div>

      {rounds.length > 0 && (
        <button onClick={saveGame} className="mt-12 w-full bg-red-600 hover:bg-red-500 py-5 rounded-2xl font-black text-xl shadow-lg transition-all">
          LANCER LA DÉGUSTATION 🍷
        </button>
      )}
    </div>
  )
}