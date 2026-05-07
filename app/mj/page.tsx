'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function PageMJ() {
  const [reponses, setReponses] = useState<any[]>([])
  const [chargement, setChargement] = useState(true)

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
    if (confirm("Voulez-vous vraiment effacer toutes les réponses ?")) {
      const { error } = await supabase
        .from('answers')
        .delete()
        .gte('round_number', 0) 

      if (error) {
        console.error("Erreur suppression:", error.message)
        alert("Erreur lors du nettoyage : " + error.message)
      } else {
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

  return (
    <div className="p-8 bg-slate-900 min-h-screen text-white font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
          <h1 className="text-3xl font-bold text-red-500">
            🍷 Console MJ
          </h1>
          <div className="space-x-4">
            <button onClick={chargerDonnees} className="text-sm bg-slate-700 px-3 py-1 rounded">Actualiser</button>
            <button onClick={viderReponses} className="text-sm bg-red-900 px-3 py-1 rounded hover:bg-red-700 transition-colors">Réinitialiser</button>
          </div>
        </div>

        <div className="grid gap-6">
          {reponses.length === 0 && !chargement ? (
            <div className="text-center p-12 border-2 border-dashed border-slate-700 rounded-2xl">
              <p className="text-slate-500 text-lg">En attente des dégustateurs...</p>
            </div>
          ) : (
            reponses.map((rep) => (
              <div key={rep.id} className="bg-slate-800 p-6 rounded-2xl shadow-2xl border-l-8 border-red-700 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-center">
                  <div className="text-center md:text-left">
                    <p className="text-red-500 font-black uppercase text-[10px] tracking-widest mb-1">Dégustateur</p>
                    <p className="text-2xl font-bold text-white">{rep.data.pseudo || 'Anonyme'}</p>
                    <p className="text-slate-500 text-xs mt-1">{new Date(rep.created_at).toLocaleTimeString()}</p>
                  </div>

                  <div className="flex-1 md:ml-8 grid grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-xl w-full">
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold">Région</span>
                      <span className="text-sm font-semibold text-white">{rep.data.pays} / {rep.data.region}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold">Appellation</span>
                      <span className="text-sm font-semibold text-yellow-500">{rep.data.appellation}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold">Cépage :</span>
                      <span className="text-sm font-medium text-purple-400 italic">{rep.data.cepage || "Non précisé"}</span>
                    </div>
                  </div>
                </div>

                {/* AFFICHAGE DU COMMENTAIRE BONUS */}
                {rep.data.commentaire && (
                  <div className="bg-red-900/20 border border-red-900/50 p-3 rounded-lg mt-2">
                    <p className="text-red-400 text-[10px] font-bold uppercase mb-1">Note de dégustation / Bonus :</p>
                    <p className="text-slate-200 italic text-sm italic">"{rep.data.commentaire}"</p>
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