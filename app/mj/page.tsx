'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function PageMJ() {
  const [reponses, setReponses] = useState<any[]>([])
  const [mancheActive, setMancheActive] = useState<any>(null)
  const [pointsConfig, setPointsConfig] = useState({ pays: 1, region: 3, cepage: 5, appellation: 10, commentaire: 1 })

  const chargerDonnees = async () => {
    // 1. Charger la manche active et la "vérité"
    const { data: config } = await supabase
      .from('game_config')
      .select('*')
      .eq('is_active', true)
      .single()
    setMancheActive(config)

    // 2. Charger les réponses de cette manche
    if (config) {
      const { data: resp } = await supabase
        .from('answers')
        .select('*')
        .eq('round_number', config.round_number)
        .order('created_at', { ascending: true })
      setReponses(resp || [])
    }
  }

  // Calcul automatique basé sur la pré-correction
  const calculerScoreAuto = (repData: any) => {
    if (!mancheActive) return 0
    let total = 0
    if (repData.pays === mancheActive.pays) total += pointsConfig.pays
    if (repData.region === mancheActive.region) total += pointsConfig.region
    if (repData.appellation === mancheActive.appellation) total += pointsConfig.appellation
    if (repData.cepage === mancheActive.cepage) total += pointsConfig.cepage
    if (repData.commentaire) total += pointsConfig.commentaire // On donne le point bonus si rempli
    return total
  }

  const passerMancheSuivante = async () => {
    if (!mancheActive) return
    const prochaine = mancheActive.round_number + 1
    
    // Désactiver l'actuelle, activer la suivante
    await supabase.from('game_config').update({ is_active: false }).eq('round_number', mancheActive.round_number)
    const { error } = await supabase.from('game_config').update({ is_active: true }).eq('round_number', prochaine)
    
    if (error) alert("Pas de manche " + prochaine + " configurée !")
    else chargerDonnees()
  }

  useEffect(() => {
    chargerDonnees()
    const channel = supabase.channel('mj-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers' }, () => chargerDonnees())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_config' }, () => chargerDonnees())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [mancheActive?.round_number])

  return (
    <div className="p-4 md:p-8 bg-slate-900 min-h-screen text-white">
      <div className="max-w-5xl mx-auto">
        
        {/* Barre de contrôle MJ */}
        <div className="bg-slate-800 p-6 rounded-2xl mb-8 border-b-4 border-red-600 shadow-xl">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-red-500">Console MJ - Manche {mancheActive?.round_number || '?'}</h1>
              <p className="text-slate-400">Solution : <span className="text-green-400 font-bold">{mancheActive?.appellation || "Non définie"}</span></p>
            </div>
            <button onClick={passerMancheSuivante} className="bg-red-600 hover:bg-red-500 px-6 py-3 rounded-xl font-bold transition-all shadow-lg">
              Terminer & Manche Suivante ⏭️
            </button>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {Object.entries(pointsConfig).map(([k, v]) => (
              <div key={k} className="bg-slate-900 p-2 rounded text-center border border-slate-700">
                <p className="text-[9px] uppercase text-slate-500">{k}</p>
                <input type="number" value={v} onChange={(e) => setPointsConfig({...pointsConfig, [k]: parseInt(e.target.value)})} className="bg-transparent text-yellow-500 font-bold w-full text-center outline-none"/>
              </div>
            ))}
          </div>
        </div>

        {/* Liste des Joueurs */}
        <div className="space-y-4">
          {reponses.map((rep, index) => {
            const score = calculerScoreAuto(rep.data)
            return (
              <div key={rep.id} className="bg-slate-800 p-4 rounded-xl flex items-center gap-4 border border-slate-700">
                <div className="text-slate-500 font-mono text-sm">#{index + 1}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">{rep.data.pseudo}</h3>
                    <span className="text-xs text-slate-500">{new Date(rep.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm">
                    <span className={rep.data.pays === mancheActive?.pays ? "text-green-400" : "text-slate-500"}>🌍 {rep.data.pays}</span>
                    <span className={rep.data.cepage === mancheActive?.cepage ? "text-green-400" : "text-slate-500"}>🍇 {rep.data.cepage}</span>
                    <span className={rep.data.appellation === mancheActive?.appellation ? "text-green-400" : "text-slate-500"}>🏷️ {rep.data.appellation}</span>
                    <span className="text-blue-400 italic">💬 {rep.data.commentaire ? "Oui" : "Non"}</span>
                  </div>
                </div>
                <div className="bg-yellow-500 text-slate-900 px-4 py-2 rounded-lg font-black text-xl">
                  {score}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}