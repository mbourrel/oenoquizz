'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function PageMJ() {
  const [reponses, setReponses] = useState<any[]>([])
  const [mancheActive, setMancheActive] = useState<any>(null)
  const [chargement, setChargement] = useState(true)
  const [pointsConfig, setPointsConfig] = useState({ pays: 1, region: 3, cepage: 5, appellation: 10, commentaire: 1 })

  const chargerDonnees = async () => {
    setChargement(true)
    const { data: config } = await supabase.from('game_config').select('*').eq('is_active', true).single()
    setMancheActive(config)

    if (config) {
      const { data: resp } = await supabase.from('answers').select('*')
        .eq('round_number', config.round_number)
        .order('created_at', { ascending: true })
      setReponses(resp || [])
    }
    setChargement(false)
  }

  const calculerScoreReponse = (repData: any) => {
    if (!mancheActive) return 0
    let total = 0
    if (repData.pays === mancheActive.pays) total += pointsConfig.pays
    if (repData.region === mancheActive.region) total += pointsConfig.region
    if (repData.appellation === mancheActive.appellation) total += pointsConfig.appellation
    if (repData.cepage === mancheActive.cepage) total += pointsConfig.cepage
    if (repData.commentaire) total += pointsConfig.commentaire
    return total
  }

  const validerEtEnregistrerPoints = async () => {
    if (!confirm("Ajouter ces points au classement général ?")) return
    
    for (const rep of reponses) {
      const scoreManche = calculerScoreReponse(rep.data)
      const { data: player } = await supabase.from('players').select('total_score').eq('pseudo', rep.pseudo).single()
      if (player) {
        await supabase.from('players').update({ total_score: player.total_score + scoreManche }).eq('pseudo', rep.pseudo)
      }
    }
    alert("Points validés !")
  }

  const passerMancheSuivante = async () => {
    if (!mancheActive) return
    const prochaine = mancheActive.round_number + 1
    if (confirm(`Passer à la manche ${prochaine} ?`)) {
      await supabase.from('game_config').update({ is_active: false }).eq('round_number', mancheActive.round_number)
      const { error } = await supabase.from('game_config').update({ is_active: true }).eq('round_number', prochaine)
      if (error) alert("Fin de partie ou configuration manquante.")
      else chargerDonnees()
    }
  }

  useEffect(() => {
    chargerDonnees()
    const channel = supabase.channel('mj-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers' }, () => chargerDonnees())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [mancheActive?.round_number])

  return (
    <div className="p-4 md:p-8 bg-slate-900 min-h-screen text-white">
      <div className="max-w-5xl mx-auto">
        <div className="bg-slate-800 p-6 rounded-2xl mb-8 border-b-4 border-red-600 shadow-xl">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-red-500">Manche {mancheActive?.round_number || '?'}</h1>
              <p className="text-slate-400">Solution : <span className="text-green-400 font-bold">{mancheActive?.appellation || "---"}</span></p>
            </div>
            <div className="flex gap-2">
              <button onClick={validerEtEnregistrerPoints} className="bg-yellow-600 px-4 py-2 rounded-xl font-bold text-xs">✅ Valider Points</button>
              <button onClick={passerMancheSuivante} className="bg-red-600 px-4 py-2 rounded-xl font-bold text-xs">Suivant ⏭️</button>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(pointsConfig).map(([k, v]) => (
              <div key={k} className="bg-slate-900 p-2 rounded text-center border border-slate-700">
                <p className="text-[9px] uppercase text-slate-500 font-bold">{k}</p>
                <input type="number" value={v} onChange={(e) => setPointsConfig({...pointsConfig, [k]: parseInt(e.target.value) || 0})} className="bg-transparent text-yellow-500 font-bold w-full text-center outline-none"/>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {reponses.map((rep) => (
            <div key={rep.id} className="bg-slate-800 p-4 rounded-xl flex items-center gap-4 border border-slate-700">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{rep.pseudo}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-2">
                  <span className={rep.data.pays === mancheActive?.pays ? "text-green-400" : "text-slate-500"}>🌍 {rep.data.pays}</span>
                  <span className={rep.data.cepage === mancheActive?.cepage ? "text-green-400" : "text-slate-500"}>🍇 {rep.data.cepage}</span>
                  <span className={rep.data.appellation === mancheActive?.appellation ? "text-green-400" : "text-slate-500"}>🏷️ {rep.data.appellation}</span>
                  <span className="text-blue-400 italic">💬 {rep.data.commentaire ? "Bonus" : "Non"}</span>
                </div>
              </div>
              <div className="bg-yellow-500 text-slate-900 w-12 h-12 rounded-lg flex items-center justify-center font-black text-xl shadow-lg">
                {calculerScoreReponse(rep.data)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}