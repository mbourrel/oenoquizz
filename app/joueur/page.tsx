'use client'
import { useState, useEffect } from 'react'
import vinsData from '../../data/vins.json'
import { supabase } from '../../lib/supabase'

export default function PageJoueur() {
  const [pseudo, setPseudo] = useState('')
  const [isRegistered, setIsRegistered] = useState(false)
  const [mancheActive, setMancheActive] = useState<any>(null)
  const [reponseEnvoyee, setReponseEnvoyee] = useState(false)
  const [classement, setClassement] = useState<any[]>([])
  
  const [selection, setSelection] = useState({ 
    pays: '', region: '', appellation: '', cepage: '', commentaire: '' 
  })
  const [loading, setLoading] = useState(false)

  // 1. Écouter les changements de manche en temps réel
  useEffect(() => {
    const fetchGameStatus = async () => {
      const { data } = await supabase.from('game_config').select('*').eq('is_active', true).single()
      if (data) {
        if (mancheActive?.round_number !== data.round_number) {
          setReponseEnvoyee(false) // Reset le formulaire pour la nouvelle manche
        }
        setMancheActive(data)
      } else {
        setMancheActive(null)
      }
    }

    const fetchClassement = async () => {
      const { data } = await supabase.from('players').select('*').order('total_score', { ascending: false })
      setClassement(data || [])
    }

    fetchGameStatus()
    fetchClassement()

    const channel = supabase.channel('game-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_config' }, () => fetchGameStatus())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => fetchClassement())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [mancheActive])

  // 2. S'enregistrer au début
  const rejoindrePartie = async () => {
    if (!pseudo) return
    setLoading(true)
    const { error } = await supabase.from('players').upsert({ pseudo }, { onConflict: 'pseudo' })
    if (!error) setIsRegistered(true)
    setLoading(false)
  }

  const paysDisponibles = vinsData.pays
  const regionsDisponibles = selection.pays ? paysDisponibles.find(p => p.nom === selection.pays)?.regions || [] : []
  const regionData = regionsDisponibles.find(r => r.nom === selection.region)

  const envoyerReponse = async () => {
    if (!selection.appellation || !mancheActive) return
    setLoading(true)
    const { error } = await supabase.from('answers').insert([{
      pseudo: pseudo,
      round_number: mancheActive.round_number,
      data: { ...selection, pseudo }
    }])

    if (!error) {
      setReponseEnvoyee(true)
      setSelection({ pays: '', region: '', appellation: '', cepage: '', commentaire: '' })
    } else {
      alert("Erreur: " + error.message)
    }
    setLoading(false)
  }

  // --- RENDU : ÉCRAN D'ACCUEIL ---
  if (!isRegistered) {
    return (
      <div className="p-6 max-w-md mx-auto mt-20 text-center space-y-6">
        <h1 className="text-4xl font-bold text-red-800">🍷 OenoQuizz</h1>
        <p className="text-slate-600">Entre ton pseudo pour rejoindre la dégustation</p>
        <input 
          type="text" className="w-full p-4 border-2 rounded-xl text-center text-xl outline-none focus:border-red-500 text-black"
          placeholder="Ton nom d'expert..." value={pseudo} onChange={(e) => setPseudo(e.target.value)}
        />
        <button onClick={rejoindrePartie} disabled={loading} className="w-full bg-red-800 text-white py-4 rounded-2xl font-bold text-xl">
          {loading ? "Connexion..." : "C'est parti !"}
        </button>
      </div>
    )
  }

  // --- RENDU : ATTENTE OU CLASSEMENT ---
  if (reponseEnvoyee || !mancheActive) {
    return (
      <div className="p-6 max-w-md mx-auto space-y-8 bg-slate-50 min-h-screen text-black">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-green-700">✓ Réponse enregistrée</h2>
          <p className="text-slate-500">En attente des autres joueurs et des résultats...</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-red-800 p-4 text-white font-bold text-center italic">Le Classement Général</div>
          <div className="p-4 space-y-4">
            {classement.map((p, i) => (
              <div key={p.id} className="flex justify-between items-center border-b pb-2">
                <span className="font-bold text-slate-400">#{i+1} {p.pseudo}</span>
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-black">{p.total_score} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // --- RENDU : FORMULAIRE DE JEU ---
  return (
    <div className="p-6 max-w-md mx-auto space-y-6 bg-white min-h-screen text-slate-900">
      <div className="flex justify-between items-center border-b pb-4">
        <span className="font-black text-red-800">MANCHE {mancheActive.round_number}</span>
        <span className="text-sm font-bold bg-slate-100 px-3 py-1 rounded-full">{pseudo}</span>
      </div>

      <div className="space-y-4 pt-4">
        <label className="block font-bold">Pays</label>
        <select className="w-full p-3 border rounded-lg bg-slate-50 text-black" value={selection.pays} onChange={(e) => setSelection({ ...selection, pays: e.target.value, region: '', appellation: '', cepage: '' })}>
          <option value="">Choisir...</option>
          {paysDisponibles.map(p => <option key={p.nom} value={p.nom}>{p.nom}</option>)}
        </select>

        {selection.pays && (
          <div>
            <label className="block font-bold mb-1">Région</label>
            <select className="w-full p-3 border rounded-lg bg-slate-50 text-black" value={selection.region} onChange={(e) => setSelection({ ...selection, region: e.target.value, appellation: '', cepage: '' })}>
              <option value="">Choisir...</option>
              {regionsDisponibles.map(r => <option key={r.nom} value={r.nom}>{r.nom}</option>)}
            </select>
          </div>
        )}

        {selection.region && (
          <>
            <div>
              <label className="block font-bold mb-1">Appellation</label>
              <select className="w-full p-3 border rounded-lg bg-slate-50 text-black" value={selection.appellation} onChange={(e) => setSelection({ ...selection, appellation: e.target.value })}>
                <option value="">Choisir...</option>
                {regionData?.appellations.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Cépage</label>
              <select className="w-full p-3 border rounded-lg bg-slate-50 text-black" value={selection.cepage} onChange={(e) => setSelection({ ...selection, cepage: e.target.value })}>
                <option value="">Choisir...</option>
                {regionData?.cepages.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </>
        )}

        <div>
          <label className="block font-bold mb-1 text-sm text-blue-600">Commentaire bonus (Domaine...)</label>
          <textarea className="w-full p-3 border rounded-lg bg-slate-50 text-black focus:ring-2 focus:ring-red-500 outline-none" placeholder="Un indice sur le domaine ?" rows={2} value={selection.commentaire} onChange={(e) => setSelection({ ...selection, commentaire: e.target.value })}/>
        </div>
      </div>

      <button onClick={envoyerReponse} disabled={loading} className="w-full bg-red-800 text-white py-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-all disabled:bg-slate-300">
        {loading ? "Envoi..." : "Envoyer ma réponse"}
      </button>
    </div>
  )
}