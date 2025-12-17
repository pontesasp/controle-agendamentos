"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FiX, FiRotateCw, FiAlertTriangle } from "react-icons/fi";

type RemessaBase = {
  id: string;
  numero_remessa: string;
  numero_nota: string;
  cliente_nome: string;
  status: string;
  data_criacao: string;
  transportadora: string | null;
  observacoes: string | null;
};

type RemessaCancelada = RemessaBase & {
  cancelada_em: string | null;
  cancelada_por: string | null;
};

type Historico = {
  id: string;
  remessa_id: string;
  status: string;
  descricao: string;
  usuario: string | null;
  created_at: string;
};

type FiltroPeriodo = {
  inicio: string;
  fim: string;
};

export default function CanceladosPage() {
  const [remessas, setRemessas] = useState<RemessaCancelada[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [filtroTransportadora, setFiltroTransportadora] =
    useState<string>("todas");
  const [buscaTexto, setBuscaTexto] = useState<string>("");
  const [periodo, setPeriodo] = useState<FiltroPeriodo>({
    inicio: "",
    fim: "",
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [remessaSelecionada, setRemessaSelecionada] =
    useState<RemessaCancelada | null>(null);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  useEffect(() => {
    carregarRemessasCanceladas();
  }, []);

  async function carregarRemessasCanceladas() {
    setLoading(true);
    setErro(null);
    setMensagemSucesso(null);

    try {
      const { data: remessasData, error: remessasError } = await supabase
        .from("remessas")
        .select("*")
        .eq("status", "cancelada")
        .order("data_criacao", { ascending: false });

      if (remessasError) {
        console.error(remessasError);
        setErro("Erro ao carregar remessas canceladas.");
        setRemessas([]);
        return;
      }

      const listaBase = (remessasData || []) as RemessaBase[];

      if (listaBase.length === 0) {
        setRemessas([]);
        return;
      }

      // normaliza ids
      const ids = listaBase.map((r) => String(r.id).trim());

      // busca TODO histórico das remessas e depois filtra cancelamento em código
      const { data: histData, error: histError } = await supabase
        .from("remessa_historico")
        .select("*")
        .in("remessa_id", ids)
        .order("created_at", { ascending: false });

      if (histError) {
        console.error(histError);
      }

      const histLista = (histData || []) as Historico[];

      const infoCancelamento = new Map<
        string,
        { data: string; usuario: string | null }
      >();

      histLista.forEach((h) => {
        const statusNorm = (h.status || "").toLowerCase().trim();
        if (statusNorm !== "cancelada") return;

        const histId = String(h.remessa_id).trim();
        const existente = infoCancelamento.get(histId);

        if (!existente) {
          infoCancelamento.set(histId, {
            data: h.created_at,
            usuario: h.usuario,
          });
        } else {
          if (new Date(h.created_at) > new Date(existente.data)) {
            infoCancelamento.set(histId, {
              data: h.created_at,
              usuario: h.usuario,
            });
          }
        }
      });

      const comCancelamento: RemessaCancelada[] = listaBase.map((r) => {
        const info = infoCancelamento.get(String(r.id).trim());
        return {
          ...r,
          cancelada_em: info ? info.data : null,
          cancelada_por: info ? info.usuario : null,
        };
      });

      setRemessas(comCancelamento);
    } catch (err) {
      console.error(err);
      setErro("Erro inesperado ao carregar cancelamentos.");
      setRemessas([]);
    } finally {
      setLoading(false);
    }
  }

  async function carregarHistoricoDaRemessa(remessaId: string) {
    setLoadingHistorico(true);
    setHistorico([]);

    const { data, error } = await supabase
      .from("remessa_historico")
      .select("*")
      .eq("remessa_id", remessaId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setHistorico([]);
    } else {
      setHistorico((data || []) as Historico[]);
    }

    setLoadingHistorico(false);
  }

  async function registrarHistorico(
    remessaId: string,
    status: string,
    descricao: string,
    usuario: string
  ) {
    await supabase.from("remessa_historico").insert({
      remessa_id: remessaId,
      status,
      descricao,
      usuario,
    });
  }

  function abrirDrawer(remessa: RemessaCancelada) {
    setRemessaSelecionada(remessa);
    setDrawerOpen(true);
    carregarHistoricoDaRemessa(remessa.id);
  }

  function fecharDrawer() {
    setDrawerOpen(false);
    setRemessaSelecionada(null);
    setHistorico([]);
  }

  async function handleRestaurarRemessa() {
    if (!remessaSelecionada) return;

    const confirma = window.confirm(
      `Deseja realmente restaurar a remessa ${remessaSelecionada.numero_remessa}? Ela voltará para "aguardando_agendamento".`
    );

    if (!confirma) return;

    setSaving(true);
    setErro(null);
    setMensagemSucesso(null);

    try {
      const { error } = await supabase
        .from("remessas")
        .update({ status: "aguardando_agendamento" })
        .eq("id", remessaSelecionada.id);

      if (error) {
        console.error(error);
        setErro("Erro ao restaurar a remessa.");
        return;
      }

      await registrarHistorico(
        remessaSelecionada.id,
        "restaurada",
        "Remessa restaurada a partir do status cancelado.",
        "karimex"
      );

      setMensagemSucesso("Remessa restaurada com sucesso.");
      await carregarRemessasCanceladas();
      fecharDrawer();
    } finally {
      setSaving(false);
    }
  }

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

  const remessasFiltradas = useMemo(() => {
    return remessas.filter((r) => {
      if (filtroTransportadora !== "todas") {
        const nome =
          r.transportadora && r.transportadora.trim() !== ""
            ? r.transportadora.trim()
            : "Sem transportadora";

        if (nome !== filtroTransportadora) return false;
      }

      if (buscaTexto.trim() !== "") {
        const query = buscaTexto.trim().toLowerCase();
        const match =
          r.numero_remessa.toLowerCase().includes(query) ||
          r.numero_nota.toLowerCase().includes(query) ||
          r.cliente_nome.toLowerCase().includes(query);
        if (!match) return false;
      }

      if ((periodo.inicio || periodo.fim) && !r.cancelada_em) {
        return false;
      }

      if (r.cancelada_em) {
        const dt = new Date(r.cancelada_em);

        if (periodo.inicio) {
          const dtInicio = new Date(periodo.inicio + "T00:00:00");
          if (dt < dtInicio) return false;
        }

        if (periodo.fim) {
          const dtFim = new Date(periodo.fim + "T23:59:59");
          if (dt > dtFim) return false;
        }
      }

      return true;
    });
  }, [remessas, filtroTransportadora, buscaTexto, periodo]);

  const totalCanceladas = remessas.length;
  const totalFiltradas = remessasFiltradas.length;

  const totalUltimos7Dias = useMemo(() => {
    const agora = new Date();
    const limite = new Date();
    limite.setDate(agora.getDate() - 7);

    return remessas.filter((r) => {
      if (!r.cancelada_em) return false;
      const dt = new Date(r.cancelada_em);
      return dt >= limite && dt <= agora;
    }).length;
  }, [remessas]);

  function limparFiltros() {
    setFiltroTransportadora("todas");
    setBuscaTexto("");
    setPeriodo({ inicio: "", fim: "" });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-orange-400 drop-shadow-[0_0_12px_rgba(255,120,20,0.8)]">
          Remessas Canceladas
        </h1>
        <p className="text-slate-300 text-sm">
          Visão dedicada às remessas que foram canceladas, com detalhes,
          histórico e opção de restauração quando necessário.
        </p>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="kx-card">
          <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">
            Canceladas totais
          </p>
          <p className="text-3xl font-bold text-orange-400">
            {totalCanceladas}
          </p>
        </div>

        <div className="kx-card">
          <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">
            Últimos 7 dias
          </p>
          <p className="text-3xl font-bold text-orange-400">
            {totalUltimos7Dias}
          </p>
        </div>

        <div className="kx-card">
          <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">
            Filtradas
          </p>
          <p className="text-3xl font-bold text-orange-400">
            {totalFiltradas}
          </p>
        </div>
      </div>

      {erro && (
        <div className="kx-card text-red-400 flex items-center gap-2">
          <FiAlertTriangle /> {erro}
        </div>
      )}

      {mensagemSucesso && (
        <div className="kx-card text-emerald-400">{mensagemSucesso}</div>
      )}

      {/* FILTROS */}
      <div className="kx-card flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Transportadora</label>
            <select
              className="bg-[#05070d] border border-orange-500/40 text-slate-100 rounded-md px-3 py-2 text-sm"
              value={filtroTransportadora}
              onChange={(e) => setFiltroTransportadora(e.target.value)}
            >
              <option value="todas">Todas</option>
              {transportadorasDisponiveis.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">
              Canceladas a partir de
            </label>
            <input
              type="date"
              className="bg-[#05070d] border border-orange-500/40 text-slate-100 rounded-md px-3 py-2 text-sm"
              value={periodo.inicio}
              onChange={(e) =>
                setPeriodo((p) => ({ ...p, inicio: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Até</label>
            <input
              type="date"
              className="bg-[#05070d] border border-orange-500/40 text-slate-100 rounded-md px-3 py-2 text-sm"
              value={periodo.fim}
              onChange={(e) =>
                setPeriodo((p) => ({ ...p, fim: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">
              Buscar remessa / nota / cliente
            </label>
            <input
              type="text"
              className="bg-[#05070d] border border-orange-500/40 text-slate-100 rounded-md px-3 py-2 text-sm"
              placeholder="Digite..."
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={limparFiltros}
            className="px-4 py-2 rounded-md border border-orange-500/40 text-orange-300 text-sm hover:bg-orange-500/10"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {/* TABELA */}
      <div className="kx-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-orange-500/20">
                <th className="py-2 pr-3">Remessa</th>
                <th className="py-2 pr-3">Nota</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Transportadora</th>
                <th className="py-2 pr-3">Motivo</th>
                <th className="py-2 pr-3">Cancelada em</th>
                <th className="py-2 pr-3">Usuário</th>
                <th className="py-2 pr-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {remessasFiltradas.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-orange-500/10 hover:bg-orange-500/5 transition-colors"
                >
                  <td className="py-2 pr-3">{r.numero_remessa}</td>
                  <td className="py-2 pr-3">{r.numero_nota}</td>
                  <td className="py-2 pr-3">{r.cliente_nome}</td>
                  <td className="py-2 pr-3">
                    {r.transportadora && r.transportadora.trim() !== ""
                      ? r.transportadora
                      : "Sem transportadora"}
                  </td>
                  <td className="py-2 pr-3 max-w-xs truncate">
                    {r.observacoes || "-"}
                  </td>
                  <td className="py-2 pr-3">
                    {r.cancelada_em
                      ? new Date(r.cancelada_em).toLocaleString("pt-BR")
                      : "-"}
                  </td>
                  <td className="py-2 pr-3">{r.cancelada_por || "-"}</td>
                  <td className="py-2 pr-3 text-right">
                    <button
                      type="button"
                      onClick={() => abrirDrawer(r)}
                      className="text-xs px-3 py-1 rounded-md bg-orange-500/80 text-black hover:bg-orange-400"
                    >
                      Detalhes
                    </button>
                  </td>
                </tr>
              ))}

              {remessasFiltradas.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-6 text-center text-xs text-slate-500"
                  >
                    Nenhuma remessa cancelada encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRAWER */}
      {drawerOpen && remessaSelecionada && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="flex-1 bg-black/60"
            onClick={fecharDrawer}
          />

          <div className="w-full max-w-lg bg-[#05070d] border-l border-orange-500/40 shadow-[0_0_25px_rgba(255,120,20,0.7)] p-6 relative">
            <button
              className="absolute right-4 top-4 text-slate-400 hover:text-orange-400"
              onClick={fecharDrawer}
            >
              <FiX size={22} />
            </button>

            <h2 className="text-xl font-semibold text-orange-400 mb-1">
              Detalhes do cancelamento
            </h2>

            <p className="text-xs text-slate-400 mb-4">
              Remessa {remessaSelecionada.numero_remessa} • Nota{" "}
              {remessaSelecionada.numero_nota} <br />
              Cliente: {remessaSelecionada.cliente_nome}
            </p>

            <div className="mb-4 space-y-2 text-sm text-slate-200">
              <p>
                Cancelada em:{" "}
                <span className="text-orange-300">
                  {remessaSelecionada.cancelada_em
                    ? new Date(
                        remessaSelecionada.cancelada_em
                      ).toLocaleString("pt-BR")
                    : "-"}
                </span>
              </p>
              <p>
                Usuário responsável:{" "}
                <span className="text-orange-300">
                  {remessaSelecionada.cancelada_por || "-"}
                </span>
              </p>

              <p className="mt-2 text-xs text-slate-400 uppercase tracking-wide">
                Motivo do cancelamento
              </p>
              <p className="bg-black/40 border border-orange-500/30 rounded-md px-3 py-2 text-sm">
                {remessaSelecionada.observacoes || "Não informado."}
              </p>
            </div>

            <div className="mb-5">
              <button
                type="button"
                disabled={saving}
                onClick={handleRestaurarRemessa}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_18px_rgba(16,185,129,0.7)]"
              >
                <FiRotateCw size={14} />
                {saving ? "Restaurando..." : "Restaurar remessa"}
              </button>
            </div>

            <div className="border-t border-orange-500/30 pt-4 mt-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                Histórico completo
              </p>

              {loadingHistorico && (
                <p className="text-xs text-slate-400">Carregando...</p>
              )}

              {!loadingHistorico && historico.length === 0 && (
                <p className="text-xs text-slate-500">
                  Nenhum histórico encontrado.
                </p>
              )}

              {!loadingHistorico && historico.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1 text-xs">
                  {historico.map((h) => (
                    <div
                      key={h.id}
                      className="bg-black/40 border border-orange-500/20 rounded-md px-3 py-2"
                    >
                      <p className="text-[11px] text-slate-400 mb-1">
                        {new Date(h.created_at).toLocaleString("pt-BR")}
                        {" • "}
                        <span className="uppercase tracking-wide text-orange-300">
                          {h.status}
                        </span>
                      </p>

                      <p className="text-[12px] text-slate-200">
                        {h.descricao}
                      </p>

                      {h.usuario && (
                        <p className="text-[11px] text-slate-500 mt-1">
                          Usuário: {h.usuario}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
