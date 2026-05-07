'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import vinsData from '../../../data/vins.json'

export default function SetupPage() {
  const [rounds, setRounds] = useState<any[]>([])
  const [currentRound, setCurrentRound] = useState({ pays: '', region: '', appellation: '', cepage: '' })

  const addRound = () => {
    setRounds([...rounds, currentRound])
    setCurrentRound({ pays: '', region: '', appellation: '', cepage: '' })
  }

  const saveGame = async () => {
    const toInsert = rounds.map((r, i) => ({
      round_number: i + 1,
      correct_data: r,
      is_active: i === 0 // La manche 1 est active par défaut
    }))
    const { error } = await supabase.from('games').insert(toInsert)
    if (error) alert(error.message)
    else alert("Partie enregistrée ! Direction la console MJ.")
  }

  return (
    <div className="p-8 bg-slate-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-6">⚙️ Préparation du Quizz</h1>
      
      <div className="bg-slate-800 p-6 rounded-xl mb-6 space-y-4">
        <h2 className="font-bold text-red-400">Ajouter la Bouteille {rounds.length + 1}</h2>
        <select 
          className="w-full p-2 bg-slate-700 rounded"
          onChange={(e) => setCurrentRound({...currentRound, pays: e.target.value})}
        >
          <option>Choisir Pays...</option>
          {vinsData.pays.map(p => <option key={p.nom}>{p.nom}</option>)}
        </select>
        <input 
          placeholder="Appellation" 
          className="w-full p-2 bg-slate-700 rounded"
          value={currentRound.appellation}
          onChange={(e) => setCurrentRound({...currentRound, appellation: e.target.value})}
        />
        <button onClick={addRound} className="w-full bg-blue-600 py-2 rounded">Ajouter à la liste</button>
      </div>

      <div className="space-y-2">
        {rounds.map((r, i) => (
          <div key={i} className="p-3 bg-slate-700 rounded flex justify-between">
            <span>Manche {i+1} : {r.appellation}</span>
          </div>
        ))}
      </div>

      {rounds.length > 0 && (
        <button onClick={saveGame} className="mt-8 w-full bg-green-600 py-4 rounded-xl font-bold">
          Lancer la partie
        </button>
      )}
    </div>
  )
}