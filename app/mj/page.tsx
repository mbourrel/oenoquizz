import { redirect } from 'next/navigation'

export default function Home() {
  // Redirige tout le monde vers la page joueur par défaut
  redirect('/joueur')
}