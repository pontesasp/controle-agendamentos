"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { supabase } from "@/lib/supabaseClient";
import { FiX } from "react-icons/fi";

// ------------------------- TYPES -------------------------
type Remessa = {
  id: string;
  numero_remessa: string;
  numero_nota: string;
  cliente_nome: string;
  status: string;
  data_criacao: string;
  transportadora?: string | null;

  etiqueta_criada?: boolean | null;
  etiqueta_criada_em?: string | null;
  etiqueta_recebida?: boolean | null;
  etiqueta_recebida_em?: string | null;

  tipo_carregamento?: "PALETIZADA" | "BATIDA" | null;

  data_entrega?: string | null;
  data_carregamento?: string | null;
  data_carregada_em?: string | null;
  data_em_rota_em?: string | null;

  observacoes?: string | null;
};

type Historico = {
  id: string;
  status: string;
  descricao: string;
  usuario: string;
  criado_em: string;
};

type PanelMode =
  | "idle"
  | "agendar_entrega"
  | "agendar_carregamento"
  | "marcar_carregada"
  | "cancelar"
  | "refaturar"
  | "definir_transportadora"
  | "tipo_carregamento"
  | "editar_remessa";

// ------------------------- HELPERS -------------------------
function isTrue(v: any) {
  return v === true;
}

function safeDateLabel(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
}

function actionBtnClass(done: boolean, pending: boolean) {
  if (done) {
    return "kx-btn !border !border-green-500/40 !bg-green-500/15 !text-green-300 hover:!bg-green-500/20";
  }
  if (pending) {
    return "kx-btn !border !border-red-500/40 !bg-red-500/10 !text-red-200 hover:!bg-red-500/15";
  }
  return "kx-btn";
}

function isoToDatetimeLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

// ------------------------- COMPONENTE PRINCIPAL -------------------------
export default function AgendamentosPage() {
  const [numeroRemessa, setNumeroRemessa] = useState("");
  const [numeroNota, setNumeroNota] = useState("");
  const [clienteNome, setClienteNome] = useState("");

  const [remessas, setRemessas] = useState<Remessa[]>([]);
  const [historico, setHistorico] = useState<Historico[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [panelMode, setPanelMode] = useState<PanelMode>("idle");
  const [remessaSelecionada, setRemessaSelecionada] = useState<Remessa | null>(null);

  const [dataEntrega, setDataEntrega] = useState("");
  const [dataCarregamento, setDataCarregamento] = useState("");
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [novaRemessa, setNovaRemessa] = useState("");
  const [novaNota, setNovaNota] = useState("");

  const [listaTransportadoras, setListaTransportadoras] = useState<{ id: string; nome: string }[]>([]);
  const [transportadoraSelecionadaId, setTransportadoraSelecionadaId] = useState("");

  const [tipoCarregamento, setTipoCarregamento] = useState<"PALETIZADA" | "BATIDA" | "">("");

  // ✅ campos de edição
  const [editNumeroRemessa, setEditNumeroRemessa] = useState("");
  const [editNumeroNota, setEditNumeroNota] = useState("");
  const [editClienteNome, setEditClienteNome] = useState("");

  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    buscarRemessas();
    carregarTransportadoras();
  }, []);

  async function carregarTransportadoras() {
    try {
      const { data, error } = await supabase.from("transportadoras").select("id, nome").order("nome");
      if (error) throw error;
      setListaTransportadoras(data || []);
    } catch (e) {
      console.error(e);
      setListaTransportadoras([]);
    }
  }

  async function buscarRemessas() {
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.from("remessas").select("*").order("data_criacao", {
        ascending: false,
      });
      if (error) throw error;
      setRemessas((data || []) as Remessa[]);
    } catch (e) {
      console.error(e);
      setErrorMsg("Erro ao carregar remessas.");
      setRemessas([]);
    } finally {
      setLoading(false);
    }
  }

  async function carregarHistorico(remessaId: string) {
    try {
      const { data, error } = await supabase
        .from("remessa_historico")
        .select("*")
        .eq("remessa_id", remessaId)
        .order("criado_em", { ascending: true });

      if (error) throw error;

      setHistorico((data || []) as Historico[]);
    } catch (e) {
      console.error(e);
      setHistorico([]);
    }
  }

  async function registrarHistorico(
    remessaId: string,
    status: string,
    descricao: string,
    usuario: string = "karimex"
  ) {
    const { error } = await supabase.from("remessa_historico").insert({
      remessa_id: remessaId,
      status,
      descricao,
      usuario,
    });
    if (error) console.error(error);
  }

  function resetCamposAcao() {
    setDataEntrega("");
    setDataCarregamento("");
    setMotivoCancelamento("");
    setNovaRemessa("");
    setNovaNota("");
    setTransportadoraSelecionadaId("");
  }

  // ------------------------- SELECIONAR REMESSA -------------------------
  async function selecionarRemessa(remessa: Remessa) {
    setErrorMsg(null);
    setRemessaSelecionada(remessa);
    setPanelMode("idle");

    resetCamposAcao();

    // já pré-carrega inputs com o que existe no banco (se tiver)
    setDataEntrega(isoToDatetimeLocal(remessa.data_entrega));
    setDataCarregamento(isoToDatetimeLocal(remessa.data_carregamento));

    setTipoCarregamento((remessa.tipo_carregamento as any) || "");

    // preparar campos de edição
    setEditNumeroRemessa(remessa.numero_remessa || "");
    setEditNumeroNota(remessa.numero_nota || "");
    setEditClienteNome(remessa.cliente_nome || "");

    await carregarHistorico(remessa.id);

    setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function fecharPainel() {
    setRemessaSelecionada(null);
    setPanelMode("idle");
    setHistorico([]);
    resetCamposAcao();
    setTipoCarregamento("");
    setEditNumeroRemessa("");
    setEditNumeroNota("");
    setEditClienteNome("");
  }

  // ------------------------- CRIAR REMESSA -------------------------
  async function handleCriarRemessa(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!numeroRemessa || !numeroNota || !clienteNome) {
      setErrorMsg("Preencha todos os campos.");
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from("remessas")
        .insert({
          numero_remessa: numeroRemessa,
          numero_nota: numeroNota,
          cliente_nome: clienteNome,
          status: "aguardando_agendamento",
          etiqueta_criada: false,
          etiqueta_recebida: false,
          tipo_carregamento: null,
        })
        .select("*")
        .single();

      if (error || !data) throw error;

      await registrarHistorico(data.id, "aguardando_agendamento", "Remessa criada.");

      setNumeroRemessa("");
      setNumeroNota("");
      setClienteNome("");

      await buscarRemessas();
    } catch (e) {
      console.error(e);
      setErrorMsg("Erro ao salvar remessa.");
    } finally {
      setSaving(false);
    }
  }

  // ------------------------- EDITAR REMESSA -------------------------
  async function handleSalvarEdicaoRemessa() {
    if (!remessaSelecionada) return;

    const nr = (editNumeroRemessa || "").trim();
    const nn = (editNumeroNota || "").trim();
    const cn = (editClienteNome || "").trim();

    if (!nr || !nn || !cn) {
      setErrorMsg("Preencha número da remessa, número da nota e nome do cliente.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const changes: string[] = [];
      if (nr !== remessaSelecionada.numero_remessa) changes.push(`Remessa: ${remessaSelecionada.numero_remessa} → ${nr}`);
      if (nn !== remessaSelecionada.numero_nota) changes.push(`Nota: ${remessaSelecionada.numero_nota} → ${nn}`);
      if (cn !== remessaSelecionada.cliente_nome) changes.push(`Cliente: ${remessaSelecionada.cliente_nome} → ${cn}`);

      const { error } = await supabase
        .from("remessas")
        .update({
          numero_remessa: nr,
          numero_nota: nn,
          cliente_nome: cn,
        })
        .eq("id", remessaSelecionada.id);

      if (error) throw error;

      await registrarHistorico(
        remessaSelecionada.id,
        "edicao_remessa",
        changes.length ? `Edição: ${changes.join(" | ")}` : "Edição: campos confirmados (sem alteração)."
      );

      await buscarRemessas();

      setRemessaSelecionada({
        ...remessaSelecionada,
        numero_remessa: nr,
        numero_nota: nn,
        cliente_nome: cn,
      });

      await carregarHistorico(remessaSelecionada.id);
      setPanelMode("idle");
    } catch (e) {
      console.error(e);
      setErrorMsg("Erro ao salvar edição da remessa.");
    } finally {
      setSaving(false);
    }
  }

  // ------------------------- AÇÕES -------------------------
  async function handleAgendarEntrega() {
    if (!remessaSelecionada || !dataEntrega) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const dt = new Date(dataEntrega);

      const { error } = await supabase
        .from("remessas")
        .update({
          data_entrega: dt,
          status: "agendada",
        })
        .eq("id", remessaSelecionada.id);

      if (error) throw error;

      await registrarHistorico(remessaSelecionada.id, "agendada", `Entrega agendada para ${dataEntrega}`);

      await buscarRemessas();
      setRemessaSelecionada({
        ...remessaSelecionada,
        data_entrega: dt.toISOString(),
        status: "agendada",
      });

      await carregarHistorico(remessaSelecionada.id);
      setPanelMode("idle");
    } catch (e) {
      console.error(e);
      setErrorMsg("Erro ao agendar entrega.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAgendarCarregamento() {
    if (!remessaSelecionada || !dataCarregamento) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const dt = new Date(dataCarregamento);

      const { error } = await supabase
        .from("remessas")
        .update({
          data_carregamento: dt,
        })
        .eq("id", remessaSelecionada.id);

      if (error) throw error;

      await registrarHistorico(remessaSelecionada.id, "carregamento_agendado", `Carregamento agendado para ${dataCarregamento}`);

      await buscarRemessas();
      setRemessaSelecionada({
        ...remessaSelecionada,
        data_carregamento: dt.toISOString(),
      });

      await carregarHistorico(remessaSelecionada.id);
      setPanelMode("idle");
    } catch (e) {
      console.error(e);
      setErrorMsg("Erro ao agendar carregamento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarcarCarregada() {
    if (!remessaSelecionada) return;

    const agora = new Date();
    setSaving(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from("remessas")
        .update({
          status: "em_rota",
          data_carregada_em: agora,
          data_em_rota_em: agora,
        })
        .eq("id", remessaSelecionada.id);

      if (error) throw error;

      await registrarHistorico(remessaSelecionada.id, "carregada", "Remessa carregada.");
      await registrarHistorico(remessaSelecionada.id, "em_rota", "Remessa saiu para rota.");

      await buscarRemessas();
      setRemessaSelecionada({
        ...remessaSelecionada,
        status: "em_rota",
        data_carregada_em: agora.toISOString(),
        data_em_rota_em: agora.toISOString(),
      });

      await carregarHistorico(remessaSelecionada.id);
      setPanelMode("idle");
    } catch (e) {
      console.error(e);
      setErrorMsg("Erro ao marcar como carregada.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelar() {
    if (!remessaSelecionada || !motivoCancelamento) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from("remessas")
        .update({
          status: "cancelada",
          observacoes: motivoCancelamento,
        })
        .eq("id", remessaSelecionada.id);

      if (error) throw error;

      await registrarHistorico(remessaSelecionada.id, "cancelada", `Cancelada. Motivo: ${motivoCancelamento}`);

      await buscarRemessas();
      setRemessaSelecionada({
        ...remessaSelecionada,
        status: "cancelada",
        observacoes: motivoCancelamento,
      });

      await carregarHistorico(remessaSelecionada.id);
      setPanelMode("idle");
    } catch (e) {
      console.error(e);
      setErrorMsg("Erro ao cancelar remessa.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRefaturar() {
    if (!remessaSelecionada || !novaRemessa || !novaNota) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const { error: e1 } = await supabase
        .from("remessas")
        .update({ status: "refaturada" })
        .eq("id", remessaSelecionada.id);
      if (e1) throw e1;

      const { data: nova, error: e2 } = await supabase
        .from("remessas")
        .insert({
          numero_remessa: novaRemessa,
          numero_nota: novaNota,
          cliente_nome: remessaSelecionada.cliente_nome,
          status: "aguardando_agendamento",
          etiqueta_criada: false,
          etiqueta_recebida: false,
          tipo_carregamento: null,
        })
        .select("*")
        .single();

      if (e2) throw e2;

      await registrarHistorico(remessaSelecionada.id, "refaturada", `Refaturada → Nova remessa ${novaRemessa}, nova nota ${novaNota}`);

      if (nova?.id) {
        await registrarHistorico(nova.id, "aguardando_agendamento", `Criada a partir da remessa ${remessaSelecionada.numero_remessa}`);
      }

      await buscarRemessas();
      fecharPainel();
    } catch (e) {
      console.error(e);
      setErrorMsg("Erro ao refaturar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDefinirTransportadora() {
    if (!remessaSelecionada || !transportadoraSelecionadaId) {
      setErrorMsg("Selecione uma transportadora.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const nomeTransportadora =
        listaTransportadoras.find((t) => t.id === transportadoraSelecionadaId)?.nome || null;

      const { error } = await supabase
        .from("remessas")
        .update({ transportadora: nomeTransportadora })
        .eq("id", remessaSelecionada.id);

      if (error) throw error;

      await registrarHistorico(remessaSelecionada.id, "transportadora_definida", `Transportadora definida: ${nomeTransportadora}`);

      await buscarRemessas();
      setRemessaSelecionada({ ...remessaSelecionada, transportadora: nomeTransportadora });

      await carregarHistorico(remessaSelecionada.id);
      setPanelMode("idle");
    } catch (e) {
      console.error(e);
      setErrorMsg("Erro ao definir transportadora.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDefinirTipoCarregamento() {
    if (!remessaSelecionada || !tipoCarregamento) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from("remessas")
        .update({ tipo_carregamento: tipoCarregamento })
        .eq("id", remessaSelecionada.id);

      if (error) throw error;

      await registrarHistorico(remessaSelecionada.id, "tipo_carregamento", `Tipo de carregamento definido como ${tipoCarregamento}`);

      await buscarRemessas();
      setRemessaSelecionada({ ...remessaSelecionada, tipo_carregamento: tipoCarregamento as any });

      await carregarHistorico(remessaSelecionada.id);
      setPanelMode("idle");
    } catch (e) {
      console.error(e);
      setErrorMsg("Erro ao definir tipo de carregamento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEtiquetaCriada() {
    if (!remessaSelecionada) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const agora = new Date();

      const { error } = await supabase
        .from("remessas")
        .update({ etiqueta_criada: true, etiqueta_criada_em: agora })
        .eq("id", remessaSelecionada.id);

      if (error) throw error;

      await registrarHistorico(remessaSelecionada.id, "etiqueta_criada", "Etiqueta da nota/remessa foi criada.");

      await buscarRemessas();
      setRemessaSelecionada({
        ...remessaSelecionada,
        etiqueta_criada: true,
        etiqueta_criada_em: agora.toISOString(),
      });

      await carregarHistorico(remessaSelecionada.id);
      setPanelMode("idle");
    } catch (e) {
      console.error(e);
      setErrorMsg("Erro ao marcar etiqueta como criada.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEtiquetaRecebida() {
    if (!remessaSelecionada) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const agora = new Date();

      const { error } = await supabase
        .from("remessas")
        .update({ etiqueta_recebida: true, etiqueta_recebida_em: agora })
        .eq("id", remessaSelecionada.id);

      if (error) throw error;

      await registrarHistorico(remessaSelecionada.id, "etiqueta_recebida", "Etiqueta recebida e confirmada.");

      await buscarRemessas();
      setRemessaSelecionada({
        ...remessaSelecionada,
        etiqueta_recebida: true,
        etiqueta_recebida_em: agora.toISOString(),
      });

      await carregarHistorico(remessaSelecionada.id);
      setPanelMode("idle");
    } catch (e) {
      console.error(e);
      setErrorMsg("Erro ao marcar etiqueta como recebida.");
    } finally {
      setSaving(false);
    }
  }

  async function excluirRemessa() {
    if (!remessaSelecionada) return;

    if (!confirm(`Excluir remessa ${remessaSelecionada.numero_remessa}?`)) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.from("remessas").delete().eq("id", remessaSelecionada.id);
      if (error) throw error;

      await buscarRemessas();
      fecharPainel();
    } catch (e) {
      console.error(e);
      setErrorMsg("Erro ao excluir remessa.");
    } finally {
      setSaving(false);
    }
  }

  // ------------------------- PENDÊNCIAS -------------------------
  const pendencias = useMemo(() => {
    if (!remessaSelecionada) return null;

    const hasEntrega = !!remessaSelecionada.data_entrega;
    const hasCarregamento = !!remessaSelecionada.data_carregamento;
    const hasTransportadora = !!remessaSelecionada.transportadora;
    const hasTipoCarreg = !!remessaSelecionada.tipo_carregamento;
    const hasEtiquetaCriada = isTrue(remessaSelecionada.etiqueta_criada);
    const hasEtiquetaRecebida = isTrue(remessaSelecionada.etiqueta_recebida);

    return { hasEntrega, hasCarregamento, hasTransportadora, hasTipoCarreg, hasEtiquetaCriada, hasEtiquetaRecebida };
  }, [remessaSelecionada]);

  // ----------------------------------------------------
  // ------------------------- RENDER --------------------
  // ----------------------------------------------------
  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-bold text-orange-400">Agendamentos</h1>

      {/* ---------------- FORMULÁRIO ---------------- */}
      <div className="kx-card">
        <h2 className="text-xl font-semibold text-orange-400 mb-4">Nova Remessa</h2>

        {errorMsg && <p className="text-sm text-red-400 mb-3">{errorMsg}</p>}

        <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={handleCriarRemessa}>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Número da Remessa</label>
            <input
              type="text"
              className="bg-[#0d1117] border border-orange-500/40 text-white rounded-md px-3 py-2 text-sm"
              value={numeroRemessa}
              onChange={(e) => setNumeroRemessa(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Número da Nota</label>
            <input
              type="text"
              className="bg-[#0d1117] border border-orange-500/40 text-white rounded-md px-3 py-2 text-sm"
              value={numeroNota}
              onChange={(e) => setNumeroNota(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Nome do Cliente</label>
            <input
              type="text"
              className="bg-[#0d1117] border border-orange-500/40 text-white rounded-md px-3 py-2 text-sm"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
            />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button className="kx-btn" disabled={saving}>
              {saving ? "Salvando..." : "Salvar Remessa"}
            </button>
          </div>
        </form>
      </div>

      {/* ---------------- LISTAGEM + PAINEL ABAIXO ---------------- */}
      <div className="kx-card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-orange-400">Remessas Cadastradas</h2>
          {loading && <span className="text-xs text-slate-400">Carregando...</span>}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-orange-500/20">
              <th className="py-2">Remessa</th>
              <th className="py-2">Nota</th>
              <th className="py-2">Cliente</th>
              <th className="py-2">Transportadora</th>
              <th className="py-2">Status</th>
              <th className="py-2">Criada em</th>
              <th className="py-2">Entrega</th>
              <th className="py-2">Carregamento</th>
              <th className="py-2">Etiqueta Criada</th>
              <th className="py-2">Etiqueta Recebida</th>
              <th className="py-2">Tipo</th>
            </tr>
          </thead>

          <tbody>
            {remessas.length === 0 && !loading && (
              <tr>
                <td colSpan={11} className="py-4 text-center text-xs text-slate-500">
                  Nenhuma remessa cadastrada.
                </td>
              </tr>
            )}

            {remessas.map((r) => {
              const selected = remessaSelecionada?.id === r.id;

              return (
                <tr
                  key={r.id}
                  onClick={() => selecionarRemessa(r)}
                  className={[
                    "border-b border-orange-500/10 cursor-pointer",
                    "hover:bg-orange-500/10",
                    selected ? "bg-orange-500/10" : "",
                  ].join(" ")}
                >
                  <td className="py-2">{r.numero_remessa}</td>
                  <td className="py-2">{r.numero_nota}</td>
                  <td className="py-2">{r.cliente_nome}</td>

                  <td className="py-2 text-xs">
                    {r.transportadora ? (
                      <span className="text-slate-200">{r.transportadora}</span>
                    ) : (
                      <span className="text-red-300">PENDENTE</span>
                    )}
                  </td>

                  <td className="py-2 text-orange-300 text-xs uppercase">
                    {r.status.replaceAll("_", " ")}
                  </td>

                  <td className="py-2">
                    {r.data_criacao ? new Date(r.data_criacao).toLocaleString("pt-BR") : "-"}
                  </td>

                  <td className="py-2 text-xs">
                    {r.data_entrega ? (
                      <span className="text-green-300">{safeDateLabel(r.data_entrega)}</span>
                    ) : (
                      <span className="text-red-300">PENDENTE</span>
                    )}
                  </td>

                  <td className="py-2 text-xs">
                    {r.data_carregamento ? (
                      <span className="text-green-300">{safeDateLabel(r.data_carregamento)}</span>
                    ) : (
                      <span className="text-red-300">PENDENTE</span>
                    )}
                  </td>

                  <td className="py-2 text-xs">
                    {r.etiqueta_criada ? <span className="text-green-400">SIM</span> : <span className="text-red-300">NÃO</span>}
                  </td>

                  <td className="py-2 text-xs">
                    {r.etiqueta_recebida ? <span className="text-green-400">SIM</span> : <span className="text-red-300">NÃO</span>}
                  </td>

                  <td className="py-2 text-xs">
                    {r.tipo_carregamento ? (
                      <span className="text-orange-300">{r.tipo_carregamento}</span>
                    ) : (
                      <span className="text-red-300">PENDENTE</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ---------------- PAINEL ABAIXO ---------------- */}
        {remessaSelecionada && (
          <div ref={panelRef} className="mt-6 border border-orange-500/25 rounded-xl bg-[#05070d] p-5 relative">
            <button
              onClick={fecharPainel}
              className="absolute right-4 top-4 text-slate-400 hover:text-orange-400"
              title="Fechar"
              disabled={saving}
            >
              <FiX size={20} />
            </button>

            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-orange-400">Gerenciar Remessa</h2>

                <p className="text-xs text-slate-400 mt-2">
                  Remessa: <span className="text-slate-200">{remessaSelecionada.numero_remessa}</span> <br />
                  Nota: <span className="text-slate-200">{remessaSelecionada.numero_nota}</span> <br />
                  Cliente: <span className="text-slate-200">{remessaSelecionada.cliente_nome}</span> <br />
                  Transportadora:{" "}
                  {remessaSelecionada.transportadora ? (
                    <span className="text-green-300">{remessaSelecionada.transportadora}</span>
                  ) : (
                    <span className="text-red-300">não definida</span>
                  )}
                </p>

                {errorMsg && <p className="text-sm text-red-400 mt-3">{errorMsg}</p>}
              </div>

              <div className="shrink-0">
                <button className="kx-btn" onClick={() => setPanelMode("editar_remessa")} disabled={saving}>
                  Editar Remessa
                </button>
              </div>
            </div>

            {/* BOTÕES */}
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                className={actionBtnClass(!!pendencias?.hasEntrega, !pendencias?.hasEntrega)}
                onClick={() => setPanelMode("agendar_entrega")}
                disabled={saving}
              >
                Agendar Entrega
              </button>

              <button
                className={actionBtnClass(!!pendencias?.hasCarregamento, !pendencias?.hasCarregamento)}
                onClick={() => setPanelMode("agendar_carregamento")}
                disabled={saving}
              >
                Agendar Carregamento
              </button>

              <button className="kx-btn" onClick={() => setPanelMode("marcar_carregada")} disabled={saving}>
                Marcar Carregada
              </button>

              <button className="kx-btn" onClick={() => setPanelMode("refaturar")} disabled={saving}>
                Refaturar
              </button>

              <button
                className={actionBtnClass(!!pendencias?.hasTransportadora, !pendencias?.hasTransportadora)}
                onClick={() => setPanelMode("definir_transportadora")}
                disabled={saving}
              >
                Definir Transportadora
              </button>

              <button
                className={actionBtnClass(!!pendencias?.hasTipoCarreg, !pendencias?.hasTipoCarreg)}
                onClick={() => setPanelMode("tipo_carregamento")}
                disabled={saving}
              >
                Tipo de Carregamento
              </button>

              <button
                className={actionBtnClass(!!pendencias?.hasEtiquetaCriada, !pendencias?.hasEtiquetaCriada)}
                onClick={() => {
                  if (!remessaSelecionada.etiqueta_criada) {
                    if (confirm("Confirmar: etiqueta foi criada?")) handleEtiquetaCriada();
                  } else {
                    alert("Esta remessa já está marcada como ETIQUETA CRIADA.");
                  }
                }}
                disabled={saving}
              >
                Marcar Etiqueta Criada
              </button>

              <button
                className={actionBtnClass(!!pendencias?.hasEtiquetaRecebida, !pendencias?.hasEtiquetaRecebida)}
                onClick={() => {
                  if (!remessaSelecionada.etiqueta_recebida) {
                    if (confirm("Confirmar: etiqueta foi recebida?")) handleEtiquetaRecebida();
                  } else {
                    alert("Esta remessa já está marcada como ETIQUETA RECEBIDA.");
                  }
                }}
                disabled={saving}
              >
                Confirmar Etiqueta Recebida
              </button>

              <button className="kx-btn-danger" onClick={() => setPanelMode("cancelar")} disabled={saving}>
                Cancelar
              </button>

              <button className="kx-btn-danger" onClick={excluirRemessa} disabled={saving}>
                Excluir Remessa
              </button>
            </div>

            {/* CONTEÚDO DA AÇÃO (AQUI ESTAVA FALTANDO) */}
            <div className="mt-5 space-y-4">
              {panelMode === "idle" && <p className="text-xs text-slate-400">Selecione uma ação acima.</p>}

              {panelMode === "agendar_entrega" && (
                <div className="border border-orange-500/15 rounded-lg p-4 bg-[#0b0f18]">
                  <label className="text-xs text-slate-400">Data da entrega</label>
                  <input
                    type="datetime-local"
                    className="kx-input"
                    value={dataEntrega}
                    onChange={(e) => setDataEntrega(e.target.value)}
                  />

                  <div className="flex gap-2 mt-3">
                    <button className="kx-btn" onClick={handleAgendarEntrega} disabled={saving || !dataEntrega}>
                      {saving ? "Salvando..." : "Salvar Entrega"}
                    </button>
                    <button className="kx-btn" onClick={() => setPanelMode("idle")} disabled={saving}>
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {panelMode === "agendar_carregamento" && (
                <div className="border border-orange-500/15 rounded-lg p-4 bg-[#0b0f18]">
                  <label className="text-xs text-slate-400">Data do carregamento</label>
                  <input
                    type="datetime-local"
                    className="kx-input"
                    value={dataCarregamento}
                    onChange={(e) => setDataCarregamento(e.target.value)}
                  />

                  <div className="flex gap-2 mt-3">
                    <button className="kx-btn" onClick={handleAgendarCarregamento} disabled={saving || !dataCarregamento}>
                      {saving ? "Salvando..." : "Salvar Carregamento"}
                    </button>
                    <button className="kx-btn" onClick={() => setPanelMode("idle")} disabled={saving}>
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {panelMode === "marcar_carregada" && (
                <div className="border border-orange-500/15 rounded-lg p-4 bg-[#0b0f18]">
                  <p className="text-xs text-slate-300">
                    Confirmar que a remessa foi carregada no CD e saiu para rota?
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button className="kx-btn" onClick={handleMarcarCarregada} disabled={saving}>
                      {saving ? "Salvando..." : "Confirmar"}
                    </button>
                    <button className="kx-btn" onClick={() => setPanelMode("idle")} disabled={saving}>
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {panelMode === "cancelar" && (
                <div className="border border-orange-500/15 rounded-lg p-4 bg-[#0b0f18]">
                  <label className="text-xs text-slate-400">Motivo do cancelamento</label>
                  <textarea
                    className="kx-input"
                    rows={3}
                    value={motivoCancelamento}
                    onChange={(e) => setMotivoCancelamento(e.target.value)}
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      className="kx-btn-danger"
                      onClick={handleCancelar}
                      disabled={saving || !motivoCancelamento.trim()}
                    >
                      {saving ? "Salvando..." : "Confirmar Cancelamento"}
                    </button>
                    <button className="kx-btn" onClick={() => setPanelMode("idle")} disabled={saving}>
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {panelMode === "refaturar" && (
                <div className="border border-orange-500/15 rounded-lg p-4 bg-[#0b0f18]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400">Nova Remessa</label>
                      <input className="kx-input" value={novaRemessa} onChange={(e) => setNovaRemessa(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400">Nova Nota</label>
                      <input className="kx-input" value={novaNota} onChange={(e) => setNovaNota(e.target.value)} />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button className="kx-btn" onClick={handleRefaturar} disabled={saving || !novaRemessa.trim() || !novaNota.trim()}>
                      {saving ? "Salvando..." : "Confirmar Refaturamento"}
                    </button>
                    <button className="kx-btn" onClick={() => setPanelMode("idle")} disabled={saving}>
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {panelMode === "definir_transportadora" && (
                <div className="border border-orange-500/15 rounded-lg p-4 bg-[#0b0f18]">
                  <label className="text-xs text-slate-400">Transportadora</label>

                  <select
                    className="bg-[#0d1117] border border-orange-500/40 text-white rounded-md px-3 py-2 text-sm w-full"
                    value={transportadoraSelecionadaId}
                    onChange={(e) => setTransportadoraSelecionadaId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {listaTransportadoras.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2 mt-3">
                    <button className="kx-btn" onClick={handleDefinirTransportadora} disabled={saving || !transportadoraSelecionadaId}>
                      {saving ? "Salvando..." : "Salvar Transportadora"}
                    </button>
                    <button className="kx-btn" onClick={() => setPanelMode("idle")} disabled={saving}>
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {panelMode === "tipo_carregamento" && (
                <div className="border border-orange-500/15 rounded-lg p-4 bg-[#0b0f18]">
                  <label className="text-xs text-slate-400">Tipo de carregamento</label>

                  <select
                    className="bg-[#0d1117] border border-orange-500/40 text-white rounded-md px-3 py-2 text-sm w-full"
                    value={tipoCarregamento}
                    onChange={(e) => setTipoCarregamento(e.target.value as any)}
                  >
                    <option value="">Selecione...</option>
                    <option value="PALETIZADA">PALETIZADA</option>
                    <option value="BATIDA">BATIDA</option>
                  </select>

                  <div className="flex gap-2 mt-3">
                    <button className="kx-btn" onClick={handleDefinirTipoCarregamento} disabled={saving || !tipoCarregamento}>
                      {saving ? "Salvando..." : "Salvar Tipo"}
                    </button>
                    <button className="kx-btn" onClick={() => setPanelMode("idle")} disabled={saving}>
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {panelMode === "editar_remessa" && (
                <div className="border border-orange-500/15 rounded-lg p-4 bg-[#0b0f18]">
                  <p className="text-xs text-slate-400 mb-3">Edite os dados básicos da remessa:</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400">Número da Remessa</label>
                      <input className="kx-input" value={editNumeroRemessa} onChange={(e) => setEditNumeroRemessa(e.target.value)} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400">Número da Nota</label>
                      <input className="kx-input" value={editNumeroNota} onChange={(e) => setEditNumeroNota(e.target.value)} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400">Nome do Cliente</label>
                      <input className="kx-input" value={editClienteNome} onChange={(e) => setEditClienteNome(e.target.value)} />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button className="kx-btn" onClick={handleSalvarEdicaoRemessa} disabled={saving}>
                      {saving ? "Salvando..." : "Salvar Alterações"}
                    </button>
                    <button className="kx-btn" onClick={() => setPanelMode("idle")} disabled={saving}>
                      Voltar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* HISTÓRICO */}
            <h3 className="text-lg text-orange-400 mt-8 mb-2">Histórico</h3>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {historico.map((h) => (
                <div key={h.id} className="text-xs text-slate-300 border-b border-orange-500/10 pb-2">
                  <p className="text-orange-300 font-semibold">
                    {new Date(h.criado_em).toLocaleString("pt-BR")}
                  </p>
                  <p>{h.descricao}</p>
                  <p className="text-[10px] text-slate-500">Usuário: {h.usuario}</p>
                </div>
              ))}
              {historico.length === 0 && <p className="text-xs text-slate-500">Nenhum registro ainda.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
