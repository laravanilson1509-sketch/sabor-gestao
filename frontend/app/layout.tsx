import "./globals.css";

export const metadata = {
  title: "Sabor Gestão",
  description: "Sistema de gestão integrada para restaurante",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-body">{children}</body>
    </html>
  );
}
