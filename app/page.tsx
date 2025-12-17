"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  FaTruck,
  FaCheckCircle,
  FaExclamationTriangle,
  FaClock,
  FaUsers,
} from "react-icons/fa";

/* ===================== TYPES ===================== */

type Remessa = {
  id: string;
  numero_remessa: string;
  numero_nota: string;
  cliente_nome: string;
  transportadora: string | null;
  status: string;
  data_criacao: string;
  data_carregamento: string | null;
  data_entrega: string | null;
  observacoes: string | null;
};

type KPI = {
  totalRemessas: number;
  remessasAndamento: number;
  remessasEntregues: number;
  ocorrenciasAbertas: number;
  transportadoras: number;
};

/* ===================== PAGE ===================== */

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KPI>({
    totalRemessas: 0,
    remessasAndamento: 0,
    remessasEntregues: 0,
    ocorrenciasAbertas: 0,
    transportadoras: 0,
  });

  const [remessas, setRemessas] = useState<Remessa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDashboard();
  }, []);

  async function carregarDashboard() {
    setLoading(true);

    const [
  totalRemessas,
  andamento,
  entregues,
  ocorrencias,
  transportadoras,
  remessasData,
] = await Promise.all([
  supabase.from("remessas").select("id", { count: "exact", head: true }),

  // Em andamento (tudo que NÃO é entregue)
  supabase
    .from("remessas")
    .select("id", { count: "exact", head: true })
    .not("status", "ilike", "entregue"),

  // Entregues
  supabase
    .from("remessas")
    .select("id", { count: "exact", head: true })
    .ilike("status", "entregue"),

  supabase
    .from("ocorrencias")
    .select("id", { count: "exact", head: true })
    .neq("status", "RESOLVIDA"),

  supabase
    .from("transportadoras")
    .select("id", { count: "exact", head: true }),

  supabase
    .from("remessas")
    .select(`
      id,
      numero_remessa,
      numero_nota,
      cliente_nome,
      transportadora,
      status,
      data_criacao,
      data_carregamento,
      data_entrega,
      observacoes
    `)
    .order("data_criacao", { ascending: false }),
]);


    setKpi({
      totalRemessas: totalRemessas.count || 0,
      remessasAndamento: andamento.count || 0,
      remessasEntregues: entregues.count || 0,
      ocorrenciasAbertas: ocorrencias.count || 0,
      transportadoras: transportadoras.count || 0,
    });

    setRemessas(remessasData.data || []);
    setLoading(false);
  }

  if (loading) {
    return <div className="p-6 text-gray-400">Carregando dashboard...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Título */}
      <h1 className="text-2xl font-bold text-white">
        Dashboard – Controle de Agendamentos
      </h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <KpiCard title="Total de Remessas" value={kpi.totalRemessas} icon={<FaTruck />} />
        <KpiCard title="Em Andamento" value={kpi.remessasAndamento} icon={<FaClock />} />
        <KpiCard title="Entregues" value={kpi.remessasEntregues} icon={<FaCheckCircle />} />
        <KpiCard title="Ocorrências Abertas" value={kpi.ocorrenciasAbertas} icon={<FaExclamationTriangle />} />
        <KpiCard title="Transportadoras" value={kpi.transportadoras} icon={<FaUsers />} />
      </div>

      {/* TABELA DE NOTAS / REMESSAS */}
      <div className="bg-zinc-900 rounded-lg p-4 overflow-x-auto">
        <h2 className="text-lg font-semibold text-white mb-4">
          Notas / Remessas Lançadas
        </h2>

        <table className="min-w-full text-sm text-left">
          <thead className="text-gray-400 border-b border-zinc-700">
            <tr>
              <th className="py-2 px-3">Remessa</th>
              <th className="py-2 px-3">Nota</th>
              <th className="py-2 px-3">Cliente</th>
              <th className="py-2 px-3">Transportadora</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Criação</th>
              <th className="py-2 px-3">Carregamento</th>
              <th className="py-2 px-3">Entrega</th>
              <th className="py-2 px-3">Observações</th>
            </tr>
          </thead>

          <tbody>
            {remessas.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-4 text-center text-gray-500">
                  Nenhuma remessa cadastrada.
                </td>
              </tr>
            ) : (
              remessas.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-800 hover:bg-zinc-800/60"
                >
                  <td className="py-2 px-3 text-white">{r.numero_remessa}</td>
                  <td className="py-2 px-3 text-white">{r.numero_nota}</td>
                  <td className="py-2 px-3 text-white">{r.cliente_nome}</td>
                  <td className="py-2 px-3 text-white">{r.transportadora || "-"}</td>
                  <td className="py-2 px-3 text-orange-400 font-medium">
                    {r.status}
                  </td>
                  <td className="py-2 px-3 text-gray-300">
                    {new Date(r.data_criacao).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="py-2 px-3 text-gray-300">
                    {r.data_carregamento
                      ? new Date(r.data_carregamento).toLocaleDateString("pt-BR")
                      : "-"}
                  </td>
                  <td className="py-2 px-3 text-gray-300">
                    {r.data_entrega
                      ? new Date(r.data_entrega).toLocaleDateString("pt-BR")
                      : "-"}
                  </td>
                  <td className="py-2 px-3 text-gray-400">
                    {r.observacoes || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= COMPONENTE KPI ================= */

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 rounded-lg p-4 flex items-center gap-4">
      <div className="text-orange-500 text-2xl">{icon}</div>
      <div>
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
