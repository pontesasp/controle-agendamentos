"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  FaClock,
  FaTruck,
  FaExclamationTriangle,
  FaSearch,
  FaListAlt,
  FaBolt,
} from "react-icons/fa";
import { useRouter } from "next/navigation";

type Remessa = {
  id: string;
  numero_remessa: string;
  numero_nota: string;
  cliente_nome: string;
  status: string;
  data_criacao: string;
  data_carregamento: string | null;
  data_entrega: string | null;
  transportadora: string | null;
  observacoes: string | null;
};

type RemessaHistorico = {
  id: string;
  remessa_id: string;
  status: string;
  descricao: string;
  usuario: string;
  criado_em: string;
};

type TipoPendencia =
  | "sem_agendamento"
  | "sem_data_carregamento"
  | "sem_data_entrega"
  | "atraso_carregamento"
  | "atraso_entrega";

type Pendencia = {
  remessa: Remessa;
  tipo: TipoPendencia;
};

type TipoPendenciaFiltro = "todas" | TipoPendencia;

function formatarData(dataStr: string | null | undefined) {
  if (!dataStr) return "-";
  const d = new Date(dataStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
}

function labelStatus(status: string) {
  switch (status) {
    case "aguardando_agendamento":
      return "Aguardando agendamento";
    case "agendada":
      return "Agendada";
    case "aguardando_carregamento":
      return "Aguardando carregamento";
    case "carregada":
      return "Carregada";
    case "em_rota":
      return "Em rota";
    case "entregue":
      return "Entregue";
    case "cancelada":
      return "Cancelada";
    case "refaturada":
      return "Refaturada";
    default:
      return status;
  }
}

function labelPendencia(tipo: TipoPendencia) {
  switch (tipo) {
    case "sem_agendamento":
      return "Sem agendamento definido";
    case "sem_data_carregamento":
      return "Sem data de carregamento";
    case "sem_data_entrega":
      return "Sem data de entrega";
    case "atraso_carregamento":
      return "Carregamento em atraso";
    case "atraso_entrega":
      return "Entrega em atraso";
    default:
      return tipo;
  }
}

function pendenciaChipClasses(tipo: TipoPendencia) {
  switch (tipo) {
    case "sem_agendamento":
      return "bg-yellow-500/10 text-yellow-200 border-yellow-400/60";
    case "sem_data_carregamento":
      return "bg-blue-500/10 text-blue-200 border-blue-400/60";
    case "sem_data_entrega":
      return "bg-sky-500/10 text-sky-200 border-sky-400/60";
    case "atraso_carregamento":
      return "bg-orange-500/10 text-orange-200 border-orange-400/60";
    case "atraso_entrega":
      return "bg-red-500/10 text-red-200 border-red-400/70";
    default:
      return "bg-slate-500/10 text-slate-200 border-slate-400/60";
  }
}

function statusChipClasses(status: string) {
  switch (status) {
    case "aguardando_agendamento":
    case "agendada":
      return "bg-yellow-500/10 text-yellow-300 border-yellow-400/60";
    case "aguardando_carregamento":
      return "bg-blue-500/10 text-blue-300 border-blue-400/60";
    case "carregada":
      return "bg-sky-500/10 text-sky-300 border-sky-400/60";
    case "em_rota":
      return "bg-indigo-500/10 text-indigo-300 border-indigo-400/60";
    case "entregue":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-400/60";
    case "cancelada":
      return "bg-red-500/10 text-red-300 border-red-400/60";
    case "refaturada":
      return "bg-orange-500/10 text-orange-300 border-orange-400/60";
    default:
      return "bg-slate-500/10 text-slate-300 border-slate-400/60";
  }
}

export default function PendenciasPage() {
  const router = useRouter();

  const [remessas, setRemessas] = useState<Remessa[]>([]);
  const [historicos, setHistoricos] = useState<RemessaHistorico[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // filtros
  const [tipoPendenciaFiltro, setTipoPendenciaFiltro] =
    useState<TipoPendenciaFiltro>("todas");
  const [transportadoraFiltro, setTransportadoraFiltro] =
    useState<string>("todas");
  const [busca, setBusca] = useState("");

  // seleção (drawer)
  const [pendenciaSelecionada, setPendenciaSelecionada] =
    useState<Pendencia | null>(null);
  const [drawerAberto, setDrawerAberto] = useState(false);

  // carregar dados iniciais
  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    setErro(null);
    try {
      const { data: remData, error: remErr } = await supabase
        .from("remessas")
        .select("*")
        .order("data_criacao", { ascending: false });

      if (remErr) {
        console.error(remErr);
        setErro("Erro ao carregar remessas.");
        setLoading(false);
        return;
      }

      const { data: histData, error: histErr } = await supabase
        .from("remessa_historico")
        .select("*")
        .order("criado_em", { ascending: true });

      if (histErr) {
        console.error(histErr);
        setErro("Erro ao carregar histórico das remessas.");
        setLoading(false);
        return;
      }

      setRemessas((remData || []) as Remessa[]);
      setHistoricos((histData || []) as RemessaHistorico[]);
    } finally {
      setLoading(false);
    }
  }

  // histórico por remessa
  const historicoPorRemessa = useMemo(() => {
    const map = new Map<string, RemessaHistorico[]>();
    historicos.forEach((h) => {
      const arr = map.get(h.remessa_id) ?? [];
      arr.push(h);
      map.set(h.remessa_id, arr);
    });
    return map;
  }, [historicos]);

  // pendências detectadas a partir das remessas
  const pendenciasBase: Pendencia[] = useMemo(() => {
    const resultado: Pendencia[] = [];
    const agora = new Date();

    remessas.forEach((r) => {
      // Sem agendamento de nada ainda
      if (r.status === "aguardando_agendamento") {
        resultado.push({ remessa: r, tipo: "sem_agendamento" });
      }

      // Sem data de carregamento
      if (
        !r.data_carregamento &&
        (r.status === "agendada" || r.status === "aguardando_carregamento")
      ) {
        resultado.push({ remessa: r, tipo: "sem_data_carregamento" });
      }

      // Sem data de entrega mesmo já tendo avançado
      if (
        !r.data_entrega &&
        (r.status === "carregada" || r.status === "em_rota" || r.status === "entregue")
      ) {
        resultado.push({ remessa: r, tipo: "sem_data_entrega" });
      }

      // Atraso de carregamento
      if (r.data_carregamento) {
        const dt = new Date(r.data_carregamento);
        if (
          dt < agora &&
          (r.status === "aguardando_carregamento" || r.status === "agendada")
        ) {
          resultado.push({ remessa: r, tipo: "atraso_carregamento" });
        }
      }

      // Atraso de entrega
      if (r.data_entrega) {
        const dtE = new Date(r.data_entrega);
        if (dtE < agora && r.status !== "entregue" && r.status !== "cancelada") {
          resultado.push({ remessa: r, tipo: "atraso_entrega" });
        }
      }
    });

    return resultado;
  }, [remessas]);

  // lista de transportadoras para filtro
  const transportadorasDisponiveis = useMemo(() => {
    const setT = new Set<string>();
    remessas.forEach((r) => {
      const nome =
        r.transportadora && r.transportadora.trim() !== ""
          ? r.transportadora.trim()
          : "Sem transportadora";
      setT.add(nome);
    });
    return Array.from(setT).sort((a, b) => a.localeCompare(b));
  }, [remessas]);

  // KPIs
  const kpiTotalPendencias = pendenciasBase.length;
  const kpiSemAgendamento = pendenciasBase.filter(
    (p) => p.tipo === "sem_agendamento"
  ).length;
  const kpiAtrasoCarregamento = pendenciasBase.filter(
    (p) => p.tipo === "atraso_carregamento"
  ).length;
  const kpiAtrasoEntrega = pendenciasBase.filter(
    (p) => p.tipo === "atraso_entrega"
  ).length;

  // aplicar filtros nas pendências
  const pendenciasFiltradas: Pendencia[] = useMemo(() => {
    return pendenciasBase.filter((p) => {
      const r = p.remessa;

      // filtro tipo
      if (tipoPendenciaFiltro !== "todas" && p.tipo !== tipoPendenciaFiltro) {
        return false;
      }

      // filtro transportadora
      if (transportadoraFiltro !== "todas") {
        const nome =
          r.transportadora && r.transportadora.trim() !== ""
            ? r.transportadora.trim()
            : "Sem transportadora";
        if (nome !== transportadoraFiltro) return false;
      }

      // busca: remessa, nota, cliente
      if (busca.trim() !== "") {
        const q = busca.toLowerCase();
        const texto = `${r.numero_remessa} ${r.numero_nota} ${
          r.cliente_nome
        }`.toLowerCase();
        if (!texto.includes(q)) return false;
      }

      return true;
    });
  }, [pendenciasBase, tipoPendenciaFiltro, transportadoraFiltro, busca]);

  // ordenar: primeiro atrasos mais críticos
  const pendenciasOrdenadas = useMemo(() => {
    const pesoTipo = (tipo: TipoPendencia) => {
      switch (tipo) {
        case "atraso_entrega":
          return 1;
        case "atraso_carregamento":
          return 2;
        case "sem_data_entrega":
          return 3;
        case "sem_data_carregamento":
          return 4;
        case "sem_agendamento":
          return 5;
        default:
          return 999;
      }
    };

    const clone = [...pendenciasFiltradas];
    clone.sort((a, b) => {
      const pa = pesoTipo(a.tipo);
      const pb = pesoTipo(b.tipo);
      if (pa !== pb) return pa - pb;

      // se mesmo peso, ordena por data de criação (mais antiga primeiro)
      const dA = new Date(a.remessa.data_criacao).getTime();
      const dB = new Date(b.remessa.data_criacao).getTime();
      return dA - dB;
    });

    return clone;
  }, [pendenciasFiltradas]);

  // histórico da pendência selecionada
  const historicoSelecionado: RemessaHistorico[] = useMemo(() => {
    if (!pendenciaSelecionada) return [];
    const hist = historicoPorRemessa.get(pendenciaSelecionada.remessa.id) ?? [];
    return hist;
  }, [pendenciaSelecionada, historicoPorRemessa]);

  function limparFiltros() {
    setTipoPendenciaFiltro("todas");
    setTransportadoraFiltro("todas");
    setBusca("");
  }

  function abrirDrawerPendencia(p: Pendencia) {
    setPendenciaSelecionada(p);
    setDrawerAberto(true);
  }

  function fecharDrawer() {
    setDrawerAberto(false);
    setPendenciaSelecionada(null);
  }

  // navegação rápida
  function irParaAgendamentos() {
    router.push("/agendamentos");
  }

  function irParaAcompanhamento() {
    router.push("/acompanhamento");
  }

  return (
    <div className="space-y-10">
      {/* TÍTULO + CONTEXTO */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-orange-400 drop-shadow-[0_0_12px_rgba(255,120,20,0.8)]">
            Pendências Operacionais
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Visão dedicada para remessas com risco operacional: sem
            agendamento, sem datas definidas ou com atraso de carregamento /
            entrega.
          </p>
        </div>
      </div>

      {/* CARDS KPI NEON */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="kx-card flex flex-col gap-2">
          <span className="text-xs text-slate-400 uppercase tracking-wide">
            Pendências totais
          </span>
          <span className="text-4xl font-bold text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]">
            {kpiTotalPendencias}
          </span>
          <span className="text-[11px] text-slate-500">
            Todas as remessas com algum tipo de pendência
          </span>
        </div>

        <div className="kx-card flex flex-col gap-2">
          <span className="text-xs text-slate-400 uppercase tracking-wide">
            Sem agendamento
          </span>
          <span className="text-4xl font-bold text-yellow-300 drop-shadow-[0_0_12px_rgba(234,179,8,0.6)]">
            {kpiSemAgendamento}
          </span>
          <span className="text-[11px] text-slate-500">
            Remessas criadas sem janela definida
          </span>
        </div>

        <div className="kx-card flex flex-col gap-2">
          <span className="text-xs text-slate-400 uppercase tracking-wide">
            Atraso de carregamento
          </span>
          <span className="text-4xl font-bold text-orange-300 drop-shadow-[0_0_12px_rgba(249,115,22,0.6)]">
            {kpiAtrasoCarregamento}
          </span>
          <span className="text-[11px] text-slate-500">
            Carregamentos vencidos e não concluídos
          </span>
        </div>

        <div className="kx-card flex flex-col gap-2">
          <span className="text-xs text-slate-400 uppercase tracking-wide">
            Atraso de entrega
          </span>
          <span className="text-4xl font-bold text-red-300 drop-shadow-[0_0_12px_rgba(248,113,113,0.6)]">
            {kpiAtrasoEntrega}
          </span>
          <span className="text-[11px] text-slate-500">
            Entregas vencidas e não concluídas
          </span>
        </div>
      </div>

      {/* FILTROS */}
      <div className="kx-card flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* tipo pendência */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Tipo de pendência</label>
            <select
              className="bg-[#05070d] border border-orange-500/40 text-slate-100 rounded-md px-3 py-2 text-sm"
              value={tipoPendenciaFiltro}
              onChange={(e) =>
                setTipoPendenciaFiltro(e.target.value as TipoPendenciaFiltro)
              }
            >
              <option value="todas">Todas</option>
              <option value="sem_agendamento">Sem agendamento</option>
              <option value="sem_data_carregamento">
                Sem data de carregamento
              </option>
              <option value="sem_data_entrega">Sem data de entrega</option>
              <option value="atraso_carregamento">
                Atraso de carregamento
              </option>
              <option value="atraso_entrega">Atraso de entrega</option>
            </select>
          </div>

          {/* transportadora */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Transportadora</label>
            <select
              className="bg-[#05070d] border border-orange-500/40 text-slate-100 rounded-md px-3 py-2 text-sm"
              value={transportadoraFiltro}
              onChange={(e) => setTransportadoraFiltro(e.target.value)}
            >
              <option value="todas">Todas</option>
              {transportadorasDisponiveis.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* busca livre */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">
              Buscar (remessa, nota ou cliente)
            </label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500" />
              <input
                type="text"
                className="w-full bg-[#05070d] border border-orange-500/40 text-slate-100 rounded-md pl-8 pr-3 py-2 text-sm"
                placeholder="Digite parte do número ou nome"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={limparFiltros}
            className="px-4 py-2 rounded-md border border-orange-500/40 text-orange-300 text-sm hover:bg-orange-500/10"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {/* LISTA DE PENDÊNCIAS */}
      <div className="kx-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-orange-400 flex items-center gap-2">
            <FaListAlt className="text-lg" />
            Pendências detectadas
          </h2>
          {loading && (
            <span className="text-xs text-slate-400">
              Carregando pendências...
            </span>
          )}
        </div>

        {erro && (
          <p className="mb-3 text-sm text-red-400">
            {erro}
          </p>
        )}

        {pendenciasOrdenadas.length === 0 && !loading ? (
          <p className="py-6 text-center text-xs text-slate-500">
            Nenhuma pendência encontrada com os filtros atuais.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-orange-500/20">
                  <th className="py-2 pr-3">Pendência</th>
                  <th className="py-2 pr-3">Remessa / Nota</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Transportadora</th>
                  <th className="py-2 pr-3">Status atual</th>
                  <th className="py-2 pr-3">Datas chave</th>
                  <th className="py-2 pl-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pendenciasOrdenadas.map((p, idx) => {
                  const r = p.remessa;

                  const nomeTransportadora =
                    r.transportadora && r.transportadora.trim() !== ""
                      ? r.transportadora.trim()
                      : "Sem transportadora";

                  const hist = historicoPorRemessa.get(r.id) ?? [];
                  const ultimoHist = hist[hist.length - 1];

                  return (
                    <tr
                      key={`${p.tipo}-${r.id}-${idx}`}
                      className="border-b border-orange-500/10 hover:bg-orange-500/5 transition-colors"
                    >
                      {/* tipo pendência */}
                      <td className="py-3 pr-3 align-top">
                        <span
                          className={`inline-flex items-center gap-1 border rounded-full px-3 py-1 text-[11px] uppercase tracking-wide ${pendenciaChipClasses(
                            p.tipo
                          )}`}
                        >
                          <FaExclamationTriangle className="text-[10px]" />
                          {labelPendencia(p.tipo)}
                        </span>
                        {ultimoHist && (
                          <p className="mt-2 text-[11px] text-slate-400">
                            Último evento:{" "}
                            <span className="text-slate-200">
                              {formatarData(ultimoHist.criado_em)}
                            </span>
                          </p>
                        )}
                      </td>

                      {/* remessa / nota */}
                      <td className="py-3 pr-3 align-top">
                        <p className="text-sm text-slate-100 font-semibold">
                          {r.numero_remessa}
                        </p>
                        <p className="text-xs text-slate-400">
                          Nota:{" "}
                          <span className="text-slate-200">
                            {r.numero_nota}
                          </span>
                        </p>
                      </td>

                      {/* cliente */}
                      <td className="py-3 pr-3 align-top">
                        <p className="text-sm text-slate-100">
                          {r.cliente_nome}
                        </p>
                      </td>

                      {/* transportadora */}
                      <td className="py-3 pr-3 align-top">
                        <div className="flex items-center gap-2 text-sm text-slate-100">
                          <FaTruck className="text-xs text-orange-400" />
                          <span>{nomeTransportadora}</span>
                        </div>
                      </td>

                      {/* status atual */}
                      <td className="py-3 pr-3 align-top">
                        <span
                          className={`inline-flex items-center gap-1 border rounded-full px-3 py-1 text-[11px] uppercase tracking-wide ${statusChipClasses(
                            r.status
                          )}`}
                        >
                          {labelStatus(r.status)}
                        </span>
                      </td>

                      {/* datas */}
                      <td className="py-3 pr-3 align-top text-[11px] text-slate-400">
                        <p>
                          <FaClock className="inline mr-1 text-xs text-slate-500" />
                          Criada:{" "}
                          <span className="text-slate-100">
                            {formatarData(r.data_criacao)}
                          </span>
                        </p>
                        <p className="mt-1">
                          <FaClock className="inline mr-1 text-xs text-blue-400" />
                          Carregamento:{" "}
                          <span className="text-slate-100">
                            {formatarData(r.data_carregamento)}
                          </span>
                        </p>
                        <p className="mt-1">
                          <FaClock className="inline mr-1 text-xs text-emerald-400" />
                          Entrega:{" "}
                          <span className="text-slate-100">
                            {formatarData(r.data_entrega)}
                          </span>
                        </p>
                      </td>

                      {/* ações */}
                      <td className="py-3 pl-3 align-top text-right">
                        <div className="flex flex-col gap-2 items-end">
                          <button
                            type="button"
                            onClick={() => abrirDrawerPendencia(p)}
                            className="px-3 py-1.5 rounded-md bg-orange-500 text-black text-[11px] font-semibold hover:bg-orange-400 shadow-[0_0_10px_rgba(255,120,20,0.7)]"
                          >
                            Detalhar pendência
                          </button>
                          <button
                            type="button"
                            onClick={irParaAgendamentos}
                            className="px-3 py-1.5 rounded-md border border-orange-500/40 text-[11px] text-orange-200 hover:bg-orange-500/10"
                          >
                            Ajustar em Agendamentos
                          </button>
                          <button
                            type="button"
                            onClick={irParaAcompanhamento}
                            className="px-3 py-1.5 rounded-md border border-slate-600 text-[11px] text-slate-200 hover:bg-slate-800/70"
                          >
                            Ver fluxo completo
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DRAWER DETALHES DA PENDÊNCIA */}
      {drawerAberto && pendenciaSelecionada && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="flex-1 bg-black/60"
            onClick={fecharDrawer}
          />

          <div className="w-full max-w-lg bg-[#05070d] border-l border-orange-500/40 shadow-[0_0_25px_rgba(255,120,20,0.7)] p-6 relative overflow-y-auto">
            <button
              className="absolute right-4 top-4 text-slate-400 hover:text-orange-400 text-sm"
              onClick={fecharDrawer}
            >
              ✕
            </button>

            <h2 className="text-xl font-bold text-orange-400 mb-2 flex items-center gap-2">
              <FaBolt className="text-lg" />
              Detalhes da pendência
            </h2>

            <p className="text-xs text-slate-400 mb-4">
              Entenda rapidamente o contexto da remessa e vá direto para a tela
              ideal para correção.
            </p>

            {/* RESUMO PRINCIPAL */}
            <div className="mb-4 space-y-2 text-sm text-slate-100">
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="text-[11px] text-slate-500">Remessa</span>
                  <p className="font-semibold">
                    {pendenciaSelecionada.remessa.numero_remessa}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Nota</span>
                  <p className="font-semibold">
                    {pendenciaSelecionada.remessa.numero_nota}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Cliente</span>
                  <p>{pendenciaSelecionada.remessa.cliente_nome}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-2">
                <span
                  className={`inline-flex items-center gap-1 border rounded-full px-3 py-1 text-[11px] uppercase tracking-wide ${pendenciaChipClasses(
                    pendenciaSelecionada.tipo
                  )}`}
                >
                  <FaExclamationTriangle className="text-[10px]" />
                  {labelPendencia(pendenciaSelecionada.tipo)}
                </span>

                <span
                  className={`inline-flex items-center gap-1 border rounded-full px-3 py-1 text-[11px] uppercase tracking-wide ${statusChipClasses(
                    pendenciaSelecionada.remessa.status
                  )}`}
                >
                  {labelStatus(pendenciaSelecionada.remessa.status)}
                </span>
              </div>

              <div className="mt-2 text-[11px] text-slate-400 space-y-1">
                <p>
                  <FaClock className="inline mr-1 text-xs text-slate-500" />
                  Criada em:{" "}
                  <span className="text-slate-100">
                    {formatarData(pendenciaSelecionada.remessa.data_criacao)}
                  </span>
                </p>
                <p>
                  <FaClock className="inline mr-1 text-xs text-blue-400" />
                  Carregamento:{" "}
                  <span className="text-slate-100">
                    {formatarData(
                      pendenciaSelecionada.remessa.data_carregamento
                    )}
                  </span>
                </p>
                <p>
                  <FaClock className="inline mr-1 text-xs text-emerald-400" />
                  Entrega:{" "}
                  <span className="text-slate-100">
                    {formatarData(
                      pendenciaSelecionada.remessa.data_entrega
                    )}
                  </span>
                </p>
              </div>
            </div>

            {/* HISTÓRICO */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-orange-300 mb-2">
                Linha do tempo da remessa
              </h3>
              {historicoSelecionado.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  Nenhum histórico registrado para esta remessa.
                </p>
              ) : (
                <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                  {historicoSelecionado.map((h) => (
                    <div
                      key={h.id}
                      className="border-l-2 border-orange-500/40 pl-3"
                    >
                      <p className="text-[11px] text-slate-500 mb-0.5">
                        {formatarData(h.criado_em)} ·{" "}
                        <span className="text-orange-300">
                          {labelStatus(h.status)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-200">
                        {h.descricao}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Usuário: {h.usuario}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AÇÕES RÁPIDAS */}
            <div className="border-t border-orange-500/20 pt-4 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={irParaAgendamentos}
                className="px-4 py-2 rounded-md bg-orange-500 text-black text-xs font-semibold hover:bg-orange-400 shadow-[0_0_15px_rgba(255,120,20,0.7)]"
              >
                Corrigir em Agendamentos
              </button>
              <button
                type="button"
                onClick={irParaAcompanhamento}
                className="px-4 py-2 rounded-md border border-slate-600 text-xs text-slate-200 hover:bg-slate-800/70"
              >
                Ver fluxo completo
              </button>
              <button
                type="button"
                onClick={fecharDrawer}
                className="px-4 py-2 rounded-md border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
