'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function PageMJ() {
  const [reponses, setReponses] = useState<any[]>([])
  const [chargement, setChargement] = useState(true)
  
  // --- CONFIGURATION DU JEU ---
  const [mancheActuelle, setMancheActuelle] = useState(1)
  const [pointsConfig, setPointsConfig] = useState({
    pays: 1,
    region: 3,
    cepage: 5,
    appellation: 10,
    commentaire: 1
  })

  const chargerDonnees = async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('answers')
      .select('*') 
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Erreur de chargement:", error.message)
    } else {
      setReponses(data || [])
    }
    setChargement(false)
  }

  const viderReponses = async () => {
    if (confirm(`Voulez-vous vraiment passer à la manche ${mancheActuelle + 1} et effacer les réponses actuelles ?`)) {
      const { error } = await supabase
        .from('answers')
        .delete()
        .gte('round_number', 0) 

      if (error) {
        console.error("Erreur suppression:", error.message)
        alert("Erreur lors du nettoyage : " + error.message)
      } else {
        setMancheActuelle(prev => prev + 1)
        chargerDonnees()
      }
    }
  }

  useEffect(() => {
    chargerDonnees()
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers' }, () => {
        chargerDonnees()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'answers' }, () => {
        chargerDonnees()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // --- CALCUL DU SCORE POTENTIEL ---
  const calculerScore = (rep: any) => {
    let total = 0;
    if (rep.data.pays) total += pointsConfig.pays;
    if (rep.data.region) total += pointsConfig.region;
    if (rep.data.cepage) total += pointsConfig.cepage;
    if (rep.data.appellation) total += pointsConfig.appellation;
    if (rep.data.commentaire) total += pointsConfig.commentaire;
    return total;
  }

  return (
    <div className="p-4 md:p-8 bg-slate-900 min-h-screen text-white font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* --- HEADER & REGLAGES POINTS --- */}
        <div className="bg-slate-800 p-6 rounded-2xl mb-8 border border-slate-700 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <h1 className="text-3xl font-bold text-red-500">
              🍷 Console MJ - Manche {mancheActuelle}
            </h1>
            <div className="flex gap-3">
              <button onClick={chargerDonnees} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl text-sm transition-colors">
                Actualiser
              </button>
              <button onClick={viderReponses} className="bg-red-900 hover:bg-red-700 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                Manche Suivante
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(pointsConfig).map(([label, pts]) => (
              <div key={label} className="bg-slate-900 p-3 rounded-xl border border-slate-700 flex flex-col items-center">
                <span className="text-[10px] uppercase text-slate-500 font-bold mb-1">{label}</span>
                <input 
                  type="number" 
                  value={pts}
                  onChange={(e) => setPointsConfig({...pointsConfig, [label]: parseInt(e.target.value) || 0})}
                  className="bg-transparent text-center text-xl font-bold text-yellow-500 w-full outline-none focus:ring-1 focus:ring-yellow-500 rounded"
                />
              </div>
            ))}
          </div>
        </div>

        {/* --- LISTE DES RÉPONSES --- */}
        <div className="grid gap-6">
          {reponses.length === 0 && !chargement ? (
            <div className="text-center p-12 border-2 border-dashed border-slate-700 rounded-2xl">
              <p className="text-slate-500 text-lg">En attente des dégustateurs pour la manche {mancheActuelle}...</p>
            </div>
          ) : (
            reponses.map((rep) => (
              <div key={rep.id} className="bg-slate-800 p-6 rounded-2xl shadow-2xl border-l-8 border-red-700 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  
                  {/* Pseudo + Score */}
                  <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className="bg-yellow-500 text-slate-900 min-w-[50px] h-[50px] rounded-full flex items-center justify-center font-black text-xl shadow-lg border-2 border-yellow-200">
                      {calculerScore(rep)}
                    </div>
                    <div className="text-left">
                      <p className="text-red-500 font-black uppercase text-[10px] tracking-widest mb-1">Dégustateur</p>
                      <p className="text-2xl font-bold text-white">{rep.data.pseudo || 'Anonyme'}</p>
                      <p className="text-slate-500 text-[10px]">{new Date(rep.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>

                  {/* Détails du Vin */}
                  <div className="flex-1 grid grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-xl w-full">
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold">Région</span>
                      <span className="text-sm font-semibold text-white">{rep.data.pays || '-'} / {rep.data.region || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold">Appellation</span>
                      <span className="text-sm font-semibold text-yellow-500">{rep.data.appellation || '-'}</span>
                    </div>
                    <div className="col-span-2 border-t border-slate-800 pt-2">
                      <span className="text-[10px] text-slate-500 uppercase font-bold mr-2">Cépage :</span>
                      <span className="text-sm font-medium text-purple-400 italic">{rep.data.cepage || "Non précisé"}</span>
                    </div>
                  </div>
                </div>

                {/* Commentaire Bonus */}
                {rep.data.commentaire && (
                  <div className="bg-red-900/20 border border-red-900/50 p-3 rounded-lg">
                    <p className="text-red-400 text-[10px] font-bold uppercase mb-1">Note de dégustation / Bonus :</p>
                    <p className="text-slate-200 italic text-sm">"{rep.data.commentaire}"</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}