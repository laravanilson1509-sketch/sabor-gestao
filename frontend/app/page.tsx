import { redirect } from "next/navigation";

export default function Home() {
  // enquanto não existe login/dashboard multi-tela, entra direto na tela
  // que está em uso agora. Troque para "/dashboard" quando ela existir.
  redirect("/whatsapp");
}
