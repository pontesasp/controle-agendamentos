import type { ReactNode } from "react";
import type { Metadata } from "next";

import "./globals.css";
import "../global-theme.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export const metadata: Metadata = {
  title: "Controle de Agendamentos - Karimex",
  description: "Sistema de agendamentos com tema Dark + Neon Karimex"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="main-layout">
          <Sidebar />
          <div className="main-content">
            <Topbar />
            <div className="page-area">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
