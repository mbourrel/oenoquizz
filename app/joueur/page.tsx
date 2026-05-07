'use client'
import { useState } from 'react'
import vinsData from '../../data/vins.json'
import { supabase } from '../../lib/supabase'

export default function PageJoueur() {
  const [pseudo, setPseudo] = useState('')
  const [selection, setSelection] = useState({ 
    pays: '', 
    region: '', 
    appellation: '', 
    cepage: '',
    commentaire: '' // Nouveau champ
  })
  const [loading, setLoading] = useState(false)

  const paysDisponibles = vinsData.pays;
  const regionsDisponibles = selection.pays 
    ? paysDisponibles.find(p => p.nom === selection.pays)?.regions || [] 
    : [];
  const regionData = regionsDisponibles.find(r => r.nom === selection.region);

  const envoyerReponse = async () => {
    if (!pseudo || !selection.appellation) {
      alert("N'oublie pas ton pseudo et l'appellation ! 🍷");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('answers')
        .insert([{
          data: { 
            ...selection, 
            pseudo: pseudo 
          },
          round_number: 1 
        }]);

      if (error) throw error;

      alert("Réponse envoyée ! Bonne dégustation. 🍷");
      setSelection({ pays: '', region: '', appellation: '', cepage: '', commentaire: '' });
    } catch (error: any) {
      console.error(error);
      alert("Erreur : " + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-6 bg-white min-h-screen shadow-lg text-slate-900">
      <h1 className="text-2xl font-bold text-center text-red-800">🍷 Ma Réponse</h1>
      
      <div className="space-y-2">
        <label className="font-bold">Ton Pseudo</label>
        <input 
          type="text" 
          placeholder="Ex: Robert Parker" 
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        <div>
          <label className="block font-bold mb-1">Pays</label>
          <select 
            className="w-full p-3 border rounded-lg bg-slate-50 text-black"
            value={selection.pays}
            onChange={(e) => setSelection({ ...selection, pays: e.target.value, region: '', appellation: '', cepage: '' })}
          >
            <option value="">Choisir...</option>
            {paysDisponibles.map(p => <option key={p.nom} value={p.nom}>{p.nom}</option>)}
          </select>
        </div>

        {selection.pays && (
          <div>
            <label className="block font-bold mb-1">Région</label>
            <select 
              className="w-full p-3 border rounded-lg bg-slate-50 text-black"
              value={selection.region}
              onChange={(e) => setSelection({ ...selection, region: e.target.value, appellation: '', cepage: '' })}
            >
              <option value="">Choisir...</option>
              {regionsDisponibles.map(r => <option key={r.nom} value={r.nom}>{r.nom}</option>)}
            </select>
          </div>
        )}

        {selection.region && (
          <>
            <div>
              <label className="block font-bold mb-1">Appellation</label>
              <select 
                className="w-full p-3 border rounded-lg bg-slate-50 text-black"
                value={selection.appellation}
                onChange={(e) => setSelection({ ...selection, appellation: e.target.value })}
              >
                <option value="">Choisir...</option>
                {regionData?.appellations.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1">Cépage dominant</label>
              <select 
                className="w-full p-3 border rounded-lg bg-slate-50 text-black"
                value={selection.cepage}
                onChange={(e) => setSelection({ ...selection, cepage: e.target.value })}
              >
                <option value="">Choisir...</option>
                {regionData?.cepages.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </>
        )}

        {/* NOUVEAU CHAMP COMMENTAIRE */}
        <div>
          <label className="block font-bold mb-1">Commentaire bonus (Domaine, vinification...)</label>
          <textarea 
            className="w-full p-3 border rounded-lg bg-slate-50 text-black focus:ring-2 focus:ring-red-500 outline-none"
            placeholder="Ex: Domaine de la Romanée-Conti, Elevage en fûts neufs..."
            rows={3}
            value={selection.commentaire}
            onChange={(e) => setSelection({ ...selection, commentaire: e.target.value })}
          />
        </div>
      </div>

      <button 
        onClick={envoyerReponse}
        disabled={loading}
        className="w-full bg-red-800 text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-all disabled:bg-gray-400"
      >
        {loading ? "Envoi en cours..." : "Envoyer ma réponse"}
      </button>
    </div>
  )
}