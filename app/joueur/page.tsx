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
  const [selection, setSelection] = useState({ pays: '', region: '', appellation: '', cepage: '', commentaire: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const syncData = async () => {
      const { data: config } = await supabase.from('game_config').select('*').eq('is_active', true).single()
      if (config) {
        if (mancheActive?.round_number !== config.round_number) setReponseEnvoyee(false)
        setMancheActive(config)
      } else {
        setMancheActive(null)
      }
      const { data: score } = await supabase.from('players').select('*').order('total_score', { ascending: false })
      setClassement(score || [])
    }

    syncData()
    const channel = supabase.channel('game-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_config' }, () => syncData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => syncData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [mancheActive?.round_number])

  const rejoindrePartie = async () => {
    if (!pseudo) return
    setLoading(true)
    const { error } = await supabase.from('players').upsert({ pseudo }, { onConflict: 'pseudo' })
    if (!error) setIsRegistered(true)
    setLoading(false)
  }

  const paysDispo = vinsData.pays
  const regionsDispo = selection.pays ? paysDispo.find(p => p.nom === selection.pays)?.regions || [] : []
  const regionData = regionsDispo.find(r => r.nom === selection.region)

  const envoyerReponse = async () => {
    if (!selection.appellation || !mancheActive) return
    setLoading(true)
    const { error } = await supabase.from('answers').insert([{
      pseudo: pseudo,
      round_number: mancheActive.round_number,
      data: { ...selection }
    }])
    if (!error) setReponseEnvoyee(true)
    setLoading(false)
  }

  if (!isRegistered) {
    return (
      <div className="p-6 max-w-md mx-auto mt-20 text-center space-y-6">
        <h1 className="text-4xl font-black text-red-800">OenoQuizz 🍷</h1>
        <input 
          type="text" className="w-full p-4 border-2 rounded-2xl text-center text-black outline-none focus:border-red-500"
          placeholder="Ton pseudo..." value={pseudo} onChange={(e) => setPseudo(e.target.value)}
        />
        <button onClick={rejoindrePartie} className="w-full bg-red-800 text-white py-4 rounded-2xl font-bold">REJOINDRE</button>
      </div>
    )
  }

  if (reponseEnvoyee || !mancheActive) {
    return (
      <div className="p-6 max-w-md mx-auto space-y-8 bg-slate-50 min-h-screen text-black font-sans">
        <div className="text-center">
          <h2 className="text-xl font-bold text-green-700">Réponse envoyée ! 🍷</h2>
          <p className="text-slate-400 text-sm italic">Préparez-vous pour le vin suivant...</p>
        </div>
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-red-800 p-4 text-white font-bold text-center italic">Le Classement</div>
          <div className="p-4 space-y-3">
            {classement.map((p, i) => (
              <div key={p.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-700">#{i+1} {p.pseudo}</span>
                <span className="bg-yellow-400 text-slate-900 px-3 py-1 rounded-full font-black">{p.total_score} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-6 bg-white min-h-screen text-slate-900 font-sans">
      <div className="flex justify-between items-center border-b pb-4">
        <span className="font-black text-red-800 uppercase tracking-tighter">Manche {mancheActive.round_number}</span>
        <span className="text-[10px] font-bold bg-slate-100 px-3 py-1 rounded-full uppercase">{pseudo}</span>
      </div>
      <div className="space-y-4">
        <select className="w-full p-4 border rounded-2xl bg-slate-50 text-black" value={selection.pays} onChange={(e) => setSelection({ ...selection, pays: e.target.value, region: '', appellation: '', cepage: '' })}>
          <option value="">Pays...</option>
          {paysDispo.map(p => <option key={p.nom} value={p.nom}>{p.nom}</option>)}
        </select>
        {selection.pays && (
          <select className="w-full p-4 border rounded-2xl bg-slate-50 text-black" value={selection.region} onChange={(e) => setSelection({ ...selection, region: e.target.value, appellation: '', cepage: '' })}>
            <option value="">Région...</option>
            {regionsDispo.map(r => <option key={r.nom} value={r.nom}>{r.nom}</option>)}
          </select>
        )}
        {selection.region && (
          <>
            <select className="w-full p-4 border rounded-2xl bg-slate-50 text-black font-bold" value={selection.appellation} onChange={(e) => setSelection({ ...selection, appellation: e.target.value })}>
              <option value="">Appellation...</option>
              {regionData?.appellations.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select className="w-full p-4 border rounded-2xl bg-slate-50 text-black" value={selection.cepage} onChange={(e) => setSelection({ ...selection, cepage: e.target.value })}>
              <option value="">Cépage dominant...</option>
              {regionData?.cepages.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </>
        )}
        <textarea className="w-full p-4 border rounded-2xl bg-slate-50 text-black text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="Un mot sur le domaine ?" rows={2} value={selection.commentaire} onChange={(e) => setSelection({ ...selection, commentaire: e.target.value })}/>
      </div>
      <button onClick={envoyerReponse} disabled={loading} className="w-full bg-red-800 text-white py-5 rounded-2xl font-black text-lg shadow-lg">ENVOYER</button>
    </div>
  )
}