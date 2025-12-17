import Link from "next/link";
import { FaCalendarCheck, FaCalendarAlt, FaList, FaHome, FaTruck } from "react-icons/fa";

type SidebarItemProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
};

function SidebarItem({ href, icon, label }: SidebarItemProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 text-slate-300 rounded-lg px-4 py-3 
      hover:bg-orange-500/10 hover:text-orange-400 transition-all
      hover:shadow-[0_0_12px_rgba(255,120,20,0.6)]"
    >
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-[#05070d] border-r border-orange-500/30 shadow-[0_0_15px_rgba(255,120,20,0.2)] flex flex-col justify-between">
      <div>
        <div className="p-6 flex items-center gap-3">
          <img
            src="/karimex-logo.png"
            className="w-12 h-12 drop-shadow-[0_0_10px_rgba(255,120,20,0.7)]"
            alt="Karimex Logo"
          />
          <h1 className="text-xl font-bold tracking-widest text-orange-500 drop-shadow-[0_0_12px_rgba(255,120,20,0.8)]">
            KARIMEX
          </h1>
        </div>

        <nav className="flex flex-col px-4 mt-6 text-sm">

          {/* Dashboard */}
          <SidebarItem href="/" label="Dashboard" icon={<FaHome />} />

          {/* Agendamentos */}
          <SidebarItem
            href="/agendamentos"
            label="Agendamentos"
            icon={<FaCalendarCheck />}
          />

          {/* Acompanhamento */}
          <SidebarItem
            href="/acompanhamento"
            label="Acompanhamento"
            icon={<FaCalendarAlt />}
          />

          {/* Pendências */}
          <SidebarItem
            href="/pendencias"
            label="Pendências"
            icon={<FaList />}
          />

          {/* Cancelados */}
          <SidebarItem
            href="/cancelados"
            label="Cancelados"
            icon={<FaCalendarAlt />}
          />

          {/* Calendário */}
          <SidebarItem
            href="/calendario"
            label="Calendário"
            icon={<FaCalendarAlt />}
          />

          {/* Transportadoras (INTERNO) */}
          <SidebarItem
            href="/transportadoras"
            label="Transportadoras"
            icon={<FaTruck />}
          />

        </nav>
      </div>

      <p className="text-xs text-slate-600 text-center mb-6">
        Karimex Tech © 2025
      </p>
    </aside>
  );
}
