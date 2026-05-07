import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">🍷</div>
        <h1 className="text-5xl font-bold text-white mb-3">OenoQuizz</h1>
        <p className="text-slate-400 text-lg">Le jeu de dégustation à l&apos;aveugle</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-xl">
        <Link href="/joueur">
          <div className="bg-slate-800 hover:bg-red-900/30 border border-slate-700 hover:border-red-700 rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer">
            <div className="text-5xl mb-4">🥂</div>
            <h2 className="text-2xl font-bold text-white mb-2">Je suis joueur</h2>
            <p className="text-slate-400 text-sm">Rejoindre la dégustation et tester ses connaissances</p>
          </div>
        </Link>

        <Link href="/mj">
          <div className="bg-slate-800 hover:bg-amber-900/20 border border-slate-700 hover:border-amber-600 rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-2xl font-bold text-white mb-2">Maître du jeu</h2>
            <p className="text-slate-400 text-sm">Configurer et animer la soirée dégustation</p>
          </div>
        </Link>
      </div>
    </main>
  )
}
