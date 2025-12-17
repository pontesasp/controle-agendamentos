export default function Topbar() {
  return (
    <header className="w-full h-20 bg-gradient-to-r from-[#0a0d14] to-[#111624] border-b border-orange-500/20 
      shadow-[0_0_12px_rgba(255,120,20,0.25)] flex items-center justify-between px-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-wide drop-shadow-[0_0_8px_rgba(255,120,20,0.5)]">
          Controle de Agendamentos
        </h1>
        <p className="text-slate-400 text-sm">Dashboard - Logística Inteligente</p>
      </div>

      <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-black font-bold shadow-[0_0_12px_rgba(255,120,20,1)]">
        A
      </div>
    </header>
  );
}
