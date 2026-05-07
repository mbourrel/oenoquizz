'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import vinsData from '../../../data/vins.json'

export default function SetupPage() {
  const [rounds, setRounds] = useState<any[]>([])
  const [currentRound, setCurrentRound] = useState({ pays: '', region: '', appellation: '', cepage: '' })

  const addRound = () => {
    if (!currentRound.pays || !currentRound.appellation) return alert("Remplis pays et appellation !")
    setRounds([...rounds, { ...currentRound }])
    setCurrentRound({ pays: '', region: '', appellation: '', cepage: '' })
  }

  const saveGame = async () => {
    // 1. Nettoyer l'ancienne partie
    await supabase.from('game_config').delete().neq('round_number', 0)
    await supabase.from('answers').delete().neq('round_number', 0)
    await supabase.from('players').update({ total_score: 0 }).neq('total_score', -1)

    // 2. Préparer les nouvelles manches (Note : bien utiliser "game_config")
    const toInsert = rounds.map((r, i) => ({
      round_number: i + 1,
      pays: r.pays,
      region: r.region,
      appellation: r.appellation,
      cepage: r.cepage,
      is_active: i === 0 
    }))

    const { error } = await supabase.from('game_config').insert(toInsert)
    
    if (error) alert("Erreur : " + error.message)
    else alert("Partie initialisée ! Va sur /mj pour piloter.")
  }

  return (
    <div className="p-8 bg-slate-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-6">⚙️ Configurer la soirée</h1>
      <div className="bg-slate-800 p-6 rounded-xl space-y-4">
        <select className="w-full p-2 bg-slate-700 text-white" value={currentRound.pays} onChange={e => setCurrentRound({...currentRound, pays: e.target.value})}>
           <option value="">Pays...</option>
           {vinsData.pays.map(p => <option key={p.nom}>{p.nom}</option>)}
        </select>
        <input className="w-full p-2 bg-slate-700 text-white" placeholder="Appellation" value={currentRound.appellation} onChange={e => setCurrentRound({...currentRound, appellation: e.target.value})} />
        <button onClick={addRound} className="w-full bg-blue-600 p-2 rounded">Ajouter Bouteille {rounds.length + 1}</button>
      </div>

      <div className="mt-6 space-y-2">
        {rounds.map((r, i) => <div key={i} className="p-2 bg-slate-700">Manche {i+1} : {r.appellation}</div>)}
      </div>

      {rounds.length > 0 && <button onClick={saveGame} className="mt-8 w-full bg-green-600 p-4 font-bold rounded-xl">LANCER LE QUIZZ</button>}
    </div>
  )
}