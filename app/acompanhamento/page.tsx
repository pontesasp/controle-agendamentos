"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  FaClock,
  FaTruck,
  FaTrash,
  FaInfoCircle,
  FaSearch,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";

type Remessa = {
  id: string;
  numero_remessa: string;
  numero_nota: string;
  cliente_nome: string;
  status: string;
  data_criacao: string;
  data_carregamento: string | null;
  data_entrega: string | null;
  transportadora: string | null;   // sempre nome agora
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

type StatusFiltro = "todos" | "aguardando" | "carregamento" | "rota" | "cancelada" | "refaturada";

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

/* ===================== NOVO – DEVE FICAR AQUI ===================== */
function isRemessaAtrasada(r: Remessa) {
  if (!r.data_entrega) return false;

  const statusFinalizado =
    r.status === "entregue" ||
    r.status === "cancelada" ||
    r.status === "refaturada";

  if (statusFinalizado) return false;

  const dtEntrega = new Date(r.data_entrega);
  if (Number.isNaN(dtEntrega.getTime())) return false;

  const agora = new Date();
  return dtEntrega.getTime() < agora.getTime();
}
/* ================================================================ */


export default function AcompanhamentoPage() {
  const [remessas, setRemessas] = useState<Remessa[]>([]);
  const [historicos, setHistoricos] = useState<RemessaHistorico[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todos");
  const [transportadoraFiltro, setTransportadoraFiltro] = useState<string>("todas");
  const [busca, setBusca] = useState("");

  const [remessaSelecionada, setRemessaSelecionada] = useState<Remessa | null>(null);
  const [drawerAberto, setDrawerAberto] = useState(false);

  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  // ---------------------- NOVO: MARCAR COMO ENTREGUE -------------------------
const [marcandoEntregue, setMarcandoEntregue] = useState(false);
const [erroEntregue, setErroEntregue] = useState<string | null>(null);


  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    setErro(null);
    try {
      const { data: remData, error: remErr } = await supabase
        .from("remessas")
        .select(`
          id,
          numero_remessa,
          numero_nota,
          cliente_nome,
          status,
          data_criacao,
          data_carregamento,
          data_entrega,
          transportadora,
          observacoes
        `)
        .order("data_criacao", { ascending: false });

      if (remErr) {
        console.error(remErr);
        setErro("Erro ao carregar remessas.");
        setLoading(false);
        return;
      }

      const { data: histData, error: histErr } = await supabase
        .from("remessa_historico")
        .select(`
          id,
          remessa_id,
          status,
          descricao,
          usuario,
          criado_em
        `)
        .order("criado_em", { ascending: true });

      if (histErr) {
        console.error(histErr);
        setErro("Erro ao carregar histórico das remessas.");
        setLoading(false);
        return;
      }

      setRemessas(remData || []);
      setHistoricos(histData || []);
    } finally {
      setLoading(false);
    }
  }

  const historicoPorRemessa = useMemo(() => {
    const map = new Map<string, RemessaHistorico[]>();
    historicos.forEach((h) => {
      const arr = map.get(h.remessa_id) ?? [];
      arr.push(h);
      map.set(h.remessa_id, arr);
    });
    return map;
  }, [historicos]);

  const transportadorasDisponiveis = useMemo(() => {
    const setT = new Set<string>();
    remessas.forEach((r) => {
      const nome = r.transportadora && r.transportadora.trim() !== ""
        ? r.transportadora.trim()
        : "Sem transportadora";

      setT.add(nome);
    });
    return Array.from(setT).sort((a, b) => a.localeCompare(b));
  }, [remessas]);

  const remessasFiltradas = useMemo(() => {
    return remessas.filter((r) => {
      if (statusFiltro !== "todos") {
        if (statusFiltro === "aguardando" &&
          !(r.status === "aguardando_agendamento" || r.status === "agendada")) return false;

        if (statusFiltro === "carregamento" &&
          !(r.status === "aguardando_carregamento" || r.status === "carregada")) return false;

        if (statusFiltro === "rota" &&
          !(r.status === "em_rota" || r.status === "entregue")) return false;

        if (statusFiltro === "cancelada" && r.status !== "cancelada") return false;

        if (statusFiltro === "refaturada" && r.status !== "refaturada") return false;
      }

      if (transportadoraFiltro !== "todas") {
        const nome = r.transportadora?.trim() || "Sem transportadora";
        if (nome !== transportadoraFiltro) return false;
      }

      if (busca.trim() !== "") {
        const q = busca.toLowerCase();
        const texto = `${r.numero_remessa} ${r.numero_nota} ${r.cliente_nome}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }

      return true;
    });
  }, [remessas, statusFiltro, transportadoraFiltro, busca]);

  function abrirDrawer(remessa: Remessa) {
    setRemessaSelecionada(remessa);
    setDrawerAberto(true);
  }

  function fecharDrawer() {
    setDrawerAberto(false);
    setRemessaSelecionada(null);
    setModalExcluirAberto(false);
  }

  const historicoSelecionado = useMemo(() => {
    if (!remessaSelecionada) return [];
    return historicoPorRemessa.get(remessaSelecionada.id) ?? [];
  }, [remessaSelecionada, historicoPorRemessa]);
  
  // ---------------------- NOVO: MARCAR COMO ENTREGUE -------------------------
async function marcarComoEntregue() {
  if (!remessaSelecionada) return;

  const ok = confirm(
    `Confirmar entrega da remessa ${remessaSelecionada.numero_remessa} (nota ${remessaSelecionada.numero_nota})?`
  );
  if (!ok) return;

  setMarcandoEntregue(true);
  setErroEntregue(null);

  try {
    const agora = new Date();

    // 1) Atualiza remessa para entregue
    const { error: upErr } = await supabase
      .from("remessas")
      .update({
        status: "entregue",
      })
      .eq("id", remessaSelecionada.id);

    if (upErr) {
      console.error(upErr);
      setErroEntregue("Erro ao marcar como entregue.");
      setMarcandoEntregue(false);
      return;
    }

    // 2) Registra histórico
    const { error: histErr } = await supabase.from("remessa_historico").insert({
      remessa_id: remessaSelecionada.id,
      status: "entregue",
      descricao: `Entrega confirmada em ${agora.toLocaleString("pt-BR")}.`,
      usuario: "karimex",
    });

    if (histErr) {
      console.error(histErr);
      // não trava o fluxo, mas informa
      setErroEntregue("Entregue marcado, mas houve erro ao registrar histórico.");
    }

    // 3) Atualiza estado local sem recarregar tudo
    setRemessas((prev) =>
      prev.map((r) =>
        r.id === remessaSelecionada.id
          ? { ...r, status: "entregue" }
          : r
      )
    );

    // 4) atualiza drawer selecionada
    setRemessaSelecionada((prev) =>
      prev ? { ...prev, status: "entregue" } : prev
    );

    // 5) recarrega histórico (opcional mas deixa o drawer atualizado)
    await carregarDados();
  } finally {
    setMarcandoEntregue(false);
  }
}



  async function confirmarExclusaoRemessa() {
    if (!remessaSelecionada) return;
    setExcluindo(true);
    setErro(null);

    try {
      await supabase.from("remessa_historico").delete().eq("remessa_id", remessaSelecionada.id);

      const { error } = await supabase.from("remessas").delete().eq("id", remessaSelecionada.id);

      if (error) {
        console.error(error);
        setErro("Erro ao excluir remessa.");
        setExcluindo(false);
        return;
      }

      setRemessas((prev) => prev.filter((r) => r.id !== remessaSelecionada.id));
      setHistoricos((prev) => prev.filter((h) => h.remessa_id !== remessaSelecionada.id));

      fecharDrawer();
    } finally {
      setExcluindo(false);
    }
  }

  function limparFiltros() {
    setStatusFiltro("todos");
    setTransportadoraFiltro("todas");
    setBusca("");
  }

  return (
    <div className="space-y-8">

      {/* ---------------------- TÍTULO ------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-orange-400 drop-shadow-[0_0_12px_rgba(255,120,20,0.8)]">
            Acompanhamento das Remessas
          </h1>
          <p className="text-slate-300 text-sm">
            Visualize todo o fluxo da remessa: criação, agendamento, carregamento, rota,
            entrega, refaturamento e cancelamentos.
          </p>
        </div>
      </div>

      {/* ---------------------- FILTROS ------------------------- */}
      <div className="kx-card flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* filtro status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Status</label>
            <select
              className="bg-[#05070d] border border-orange-500/40 text-slate-100 rounded-md px-3 py-2 text-sm"
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value as StatusFiltro)}
            >
              <option value="todos">Todos</option>
              <option value="aguardando">Aguardando agendamento/carregamento</option>
              <option value="carregamento">Fase de carregamento</option>
              <option value="rota">Em rota / Entregue</option>
              <option value="refaturada">Refaturadas</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </div>

          {/* filtro transportadora */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Transportadora</label>
            <select
              className="bg-[#05070d] border border-orange-500/40 text-slate-100 rounded-md px-3 py-2 text-sm"
              value={transportadoraFiltro}
              onChange={(e) => setTransportadoraFiltro(e.target.value)}
            >
              <option value="todas">Todas</option>
              {transportadorasDisponiveis.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* busca */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Buscar (remessa, nota ou cliente)</label>
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

      {/* ---------------------- LISTA PRINCIPAL ------------------------- */}
      <div className="kx-card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-orange-400">Remessas em acompanhamento</h2>
          {loading && <span className="text-xs text-slate-400">Carregando dados...</span>}
        </div>

        {erro && <p className="mb-3 text-sm text-red-400">{erro}</p>}

        {remessasFiltradas.length === 0 && !loading ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            Nenhuma remessa encontrada com os filtros atuais.
          </p>
        ) : (
          <div className="space-y-3">
            {remessasFiltradas.map((r) => {
              const hist = historicoPorRemessa.get(r.id) ?? [];
              const ultimos = hist.slice(-2);
              
              const atrasada = isRemessaAtrasada(r);


              const nomeTransportadora =
                r.transportadora && r.transportadora.trim() !== ""
                  ? r.transportadora.trim()
                  : "Sem transportadora";

              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => abrirDrawer(r)}
                  className={`w-full text-left rounded-lg border transition-all px-4 py-3
  ${atrasada
    ? "border-red-500/60 bg-red-500/10 hover:bg-red-500/15"
    : "border-orange-500/20 bg-black/20 hover:bg-orange-500/5 hover:border-orange-500/50"
  }`}

                >
                  <div className="flex flex-wrap items-center justify-between gap-2">

                    {/* bloco remessa/nota */}
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-500">Remessa · Nota</span>
                      <span className="text-sm font-semibold text-slate-100">
                        {r.numero_remessa} · {r.numero_nota}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">
                        Cliente: <span className="text-slate-100">{r.cliente_nome}</span>
                      </span>
                    </div>

                    {/* bloco transportadora */}
                    <div className="flex flex-col min-w-[180px]">
                      <span className="text-[11px] text-slate-500">Transportadora</span>
                      <div className="flex items-center gap-2 text-sm text-slate-100">
                        <FaTruck className="text-xs text-orange-400" />
                        <span>{nomeTransportadora}</span>
                      </div>
                    </div>

                    {/* status */}
                    <div className="flex flex-col items-start md:items-center">
                      <span className="text-[11px] text-slate-500">Status atual</span>
                      <span
                        className={`mt-1 inline-flex items-center gap-1 border rounded-full px-3 py-1 text-[11px] uppercase tracking-wide ${statusChipClasses(r.status)}`}
                      >
                        {r.status === "entregue" && <FaCheckCircle className="text-[10px]" />}
                        {labelStatus(r.status)}
                        {atrasada && (
  <span className="mt-1 inline-flex items-center gap-2 border border-red-500/60 bg-red-500/10 text-red-300 rounded-full px-3 py-1 text-[11px] uppercase tracking-wide">
    <FaExclamationTriangle className="text-[11px]" />
    Atraso
  </span>
)}

                      </span>
                    </div>

                    {/* datas */}
                    <div className="flex flex-col text-[11px] text-slate-400 min-w-[220px]">
                      <span className="flex items-center gap-2">
                        <FaClock className="text-xs text-slate-500" />
                        Criada: <span className="text-slate-100">{formatarData(r.data_criacao)}</span>
                      </span>
                      <span className="flex items-center gap-2 mt-1">
                        <FaClock className="text-xs text-blue-400" />
                        Carregamento: <span className="text-slate-100">{formatarData(r.data_carregamento)}</span>
                      </span>
                      <span className="flex items-center gap-2 mt-1">
                        <FaClock className="text-xs text-emerald-400" />
                        Entrega: <span className="text-slate-100">{formatarData(r.data_entrega)}</span>
                      </span>
                    </div>
                  </div>

                  {/* mini histórico */}
                  {ultimos.length > 0 && (
                    <div className="mt-3 border-t border-orange-500/10 pt-2">
                      <p className="text-[11px] text-slate-500 mb-1">Últimos registros desta remessa:</p>
                      <div className="space-y-1">
                        {ultimos.map((h) => (
                          <p key={h.id} className="text-[11px] text-slate-300 flex items-start gap-2">
                            <span className="mt-[2px]"><FaInfoCircle className="text-[10px] text-orange-400" /></span>
                            <span>
                              <span className="text-slate-500">{formatarData(h.criado_em)} – </span>
                              <span className="text-orange-300">{labelStatus(h.status)}:</span>{" "}
                              {h.descricao}{" "}
                              <span className="text-slate-500">(usuário: {h.usuario})</span>
                            </span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------------- DRAWER DETALHES ------------------------- */}
      {drawerAberto && remessaSelecionada && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/60" onClick={fecharDrawer} />

          <div className="w-full max-w-lg bg-[#05070d] border-l border-orange-500/40 shadow-[0_0_25px_rgba(255,120,20,0.7)] p-6 relative overflow-y-auto">
            <button
              className="absolute right-4 top-4 text-slate-400 hover:text-orange-400 text-sm"
              onClick={fecharDrawer}
            >
              ✕
            </button>

            <h2 className="text-xl font-bold text-orange-400 mb-2">Detalhes da remessa</h2>
            <p className="text-xs text-slate-400 mb-4">Aqui você acompanha tudo o que já foi realizado com esta remessa.</p>

            {/* Informações principais */}
            <div className="mb-4 space-y-2 text-sm text-slate-100">
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="text-[11px] text-slate-500">Remessa</span>
                  <p className="font-semibold">{remessaSelecionada.numero_remessa}</p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Nota</span>
                  <p className="font-semibold">{remessaSelecionada.numero_nota}</p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Cliente</span>
                  <p>{remessaSelecionada.cliente_nome}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-2">
                <div className="flex items-center gap-2 text-sm">
                  <FaTruck className="text-xs text-orange-400" />
                  <span className="text-[11px] text-slate-500">Transportadora:</span>
                  <span className="text-slate-100">
                    {remessaSelecionada.transportadora?.trim() !== ""
                      ? remessaSelecionada.transportadora
                      : "Não definida"}
                  </span>
                </div>

                <span className={`inline-flex items-center gap-1 border rounded-full px-3 py-1 text-[11px] uppercase tracking-wide ${statusChipClasses(remessaSelecionada.status)}`}>
                  {labelStatus(remessaSelecionada.status)}
                </span>
              </div>

              <div className="mt-2 text-[11px] text-slate-400 space-y-1">
                <p>
                  <FaClock className="inline mr-1 text-xs text-slate-500" />
                  Criada em: <span className="text-slate-100">{formatarData(remessaSelecionada.data_criacao)}</span>
                </p>
                <p>
                  <FaClock className="inline mr-1 text-xs text-blue-400" />
                  Carregamento: <span className="text-slate-100">{formatarData(remessaSelecionada.data_carregamento)}</span>
                </p>
                <p>
                  <FaClock className="inline mr-1 text-xs text-emerald-400" />
                  Entrega: <span className="text-slate-100">{formatarData(remessaSelecionada.data_entrega)}</span>
                </p>
              </div>
            </div>

            {/* Observações */}
            {remessaSelecionada.observacoes && (
              <div className="mb-5">
                <p className="text-[11px] text-slate-400 mb-1">Observações</p>
                <div className="bg-black/40 border border-orange-500/20 rounded-md px-3 py-2 text-xs text-slate-200">
                  {remessaSelecionada.observacoes}
                </div>
              </div>
            )}

            {/* Histórico */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-orange-300 mb-2 flex items-center gap-2">
                <FaInfoCircle className="text-xs" /> Histórico de eventos
              </h3>

              {historicoSelecionado.length === 0 ? (
                <p className="text-[11px] text-slate-500">Nenhum registro de histórico para esta remessa.</p>
              ) : (
                <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                  {historicoSelecionado.map((h) => (
                    <div key={h.id} className="border-l-2 border-orange-500/40 pl-3">
                      <p className="text-[11px] text-slate-500 mb-0.5">
                        {formatarData(h.criado_em)} · <span className="text-orange-300">{labelStatus(h.status)}</span>
                      </p>
                      <p className="text-xs text-slate-200">{h.descricao}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Usuário: {h.usuario}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ---------------------- NOVO: AÇÕES DE FINALIZAÇÃO ------------------------- */}
<div className="mb-4 flex flex-wrap gap-2">
  <button
    type="button"
    disabled={marcandoEntregue || remessaSelecionada.status === "entregue"}
    onClick={marcarComoEntregue}
    className="px-4 py-2 rounded-md bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 shadow-[0_0_15px_rgba(16,185,129,0.35)]"
  >
    <FaCheckCircle className="inline mr-2 text-[12px]" />
    {remessaSelecionada.status === "entregue"
      ? "Já entregue"
      : marcandoEntregue
      ? "Marcando..."
      : "Marcar como entregue"}
  </button>

  {isRemessaAtrasada(remessaSelecionada) && remessaSelecionada.status !== "entregue" && (
    <div className="flex items-center gap-2 text-xs text-red-300 border border-red-500/40 bg-red-500/10 px-3 py-2 rounded-md">
      <FaExclamationTriangle className="text-[12px]" />
      Remessa em atraso
    </div>
  )}
</div>

{erroEntregue && (
  <p className="text-xs text-red-400 mb-3">{erroEntregue}</p>
)}


            {/* Ações */}
            <div className="border-t border-orange-500/20 pt-4 flex justify-between items-center gap-3">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <FaExclamationTriangle className="text-red-400" />
                <span>Excluir a remessa remove também todo o histórico vinculado.</span>
              </div>

              <button
                type="button"
                onClick={() => setModalExcluirAberto(true)}
                className="px-4 py-2 rounded-md bg-red-600 text-xs font-semibold text-white hover:bg-red-500 shadow-[0_0_15px_rgba(248,113,113,0.6)]"
              >
                <FaTrash className="inline mr-2 text-[11px]" />
                Excluir remessa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------- MODAL EXCLUSÃO ------------------------- */}
      {modalExcluirAberto && remessaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-[#05070d] border border-red-500/60 rounded-xl p-6 max-w-md w-full shadow-[0_0_30px_rgba(248,113,113,0.7)]">
            <div className="flex items-center gap-3 mb-3">
              <FaExclamationTriangle className="text-red-400 text-xl" />
              <h3 className="text-lg font-semibold text-red-400">Confirmar exclusão da remessa</h3>
            </div>

            <p className="text-sm text-slate-200 mb-3">
              Tem certeza que deseja excluir permanentemente a remessa{" "}
              <span className="text-orange-300">{remessaSelecionada.numero_remessa}</span> (nota{" "}
              <span className="text-orange-300">{remessaSelecionada.numero_nota}</span>)?
              Esta ação irá remover também todos os registros de histórico relacionados a ela.
            </p>

            {erro && <p className="text-xs text-red-400 mb-2">{erro}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                disabled={excluindo}
                onClick={() => setModalExcluirAberto(false)}
                className="px-4 py-2 rounded-md border border-slate-600 text-xs text-slate-200 hover:bg-slate-800"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={excluindo}
                onClick={confirmarExclusaoRemessa}
                className="px-4 py-2 rounded-md bg-red-600 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
              >
                {excluindo ? "Excluindo..." : "Sim, excluir remessa"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
