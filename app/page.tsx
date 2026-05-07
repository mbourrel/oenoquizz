import { redirect } from "next/navigation";

export default function Home() {
  // Cette ligne redirige IMMEDIATEMENT vers la page joueur
  // sans casser les accès aux dossiers /mj ou /mj/setup
  redirect("/joueur");
}