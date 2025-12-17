"use client";

import { useEffect, useState } from "react";
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

  // ================= EXISTENTE =================
  etiqueta_criada?: boolean | null;
  etiqueta_criada_em?: string | null;
  etiqueta_recebida?: boolean | null;
  etiqueta_recebida_em?: string | null;

  // ================= NOVO =================
  tipo_carregamento?: "PALETIZADA" | "BATIDA" | null;
};

type Historico = {
  id: string;
  status: string;
  descricao: string;
  usuario: string;
  criado_em: string;
};

type DrawerMode =
  | "idle"
  | "agendar_entrega"
  | "agendar_carregamento"
  | "marcar_carregada"
  | "cancelar"
  | "refaturar"
  | "definir_transportadora"
  | "tipo_carregamento"; // ✅ NOVO

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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("idle");
  const [remessaSelecionada, setRemessaSelecionada] = useState<Remessa | null>(null);

  const [dataEntrega, setDataEntrega] = useState("");
  const [dataCarregamento, setDataCarregamento] = useState("");
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [novaRemessa, setNovaRemessa] = useState("");
  const [novaNota, setNovaNota] = useState("");

  const [listaTransportadoras, setListaTransportadoras] = useState<
    { id: string; nome: string }[]
  >([]);

  const [transportadoraSelecionadaId, setTransportadoraSelecionadaId] = useState("");

  // ================= NOVO =================
  const [tipoCarregamento, setTipoCarregamento] =
    useState<"PALETIZADA" | "BATIDA" | "">("");

  useEffect(() => {
    buscarRemessas();
    carregarTransportadoras();
  }, []);

  async function carregarTransportadoras() {
    const { data } = await supabase
      .from("transportadoras")
      .select("id, nome")
      .order("nome");

    setListaTransportadoras(data || []);
  }

  async function buscarRemessas() {
    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("remessas")
      .select("*")
      .order("data_criacao", { ascending: false });

    if (error) {
      setErrorMsg("Erro ao carregar remessas.");
      setRemessas([]);
    } else {
      setRemessas((data || []) as Remessa[]);
    }

    setLoading(false);
  }

  async function carregarHistorico(remessaId: string) {
    const { data } = await supabase
      .from("remessa_historico")
      .select("*")
      .eq("remessa_id", remessaId)
      .order("criado_em", { ascending: true });

    setHistorico((data || []) as Historico[]);
  }

  async function registrarHistorico(
    remessaId: string,
    status: string,
    descricao: string,
    usuario: string = "karimex"
  ) {
    await supabase.from("remessa_historico").insert({
      remessa_id: remessaId,
      status,
      descricao,
      usuario,
    });
  }

  // ================= NOVO =================
  async function handleDefinirTipoCarregamento() {
    if (!remessaSelecionada || !tipoCarregamento) return;

    setSaving(true);

    await supabase
      .from("remessas")
      .update({
        tipo_carregamento: tipoCarregamento,
      })
      .eq("id", remessaSelecionada.id);

    await registrarHistorico(
      remessaSelecionada.id,
      "tipo_carregamento",
      `Tipo de carregamento definido como ${tipoCarregamento}`
    );

    await buscarRemessas();
    fecharDrawer();
    setSaving(false);
  }

  // ================= CONTINUA NO BLOCO 2 =================
  // ✅ NOVO: MARCAR ETIQUETA CRIADA
  async function handleEtiquetaCriada() {
    if (!remessaSelecionada) return;

    setSaving(true);

    const agora = new Date();

    const { error } = await supabase
      .from("remessas")
      .update({
        etiqueta_criada: true,
        etiqueta_criada_em: agora,
      })
      .eq("id", remessaSelecionada.id);

    if (error) {
      console.error(error);
      setErrorMsg("Erro ao marcar etiqueta como criada.");
      setSaving(false);
      return;
    }

    await registrarHistorico(
      remessaSelecionada.id,
      "etiqueta_criada",
      "Etiqueta da nota/remessa foi criada."
    );

    await buscarRemessas();
    fecharDrawer();
    setSaving(false);
  }

  // ✅ NOVO: MARCAR ETIQUETA RECEBIDA
  async function handleEtiquetaRecebida() {
    if (!remessaSelecionada) return;

    setSaving(true);

    const agora = new Date();

    const { error } = await supabase
      .from("remessas")
      .update({
        etiqueta_recebida: true,
        etiqueta_recebida_em: agora,
      })
      .eq("id", remessaSelecionada.id);

    if (error) {
      console.error(error);
      setErrorMsg("Erro ao marcar etiqueta como recebida.");
      setSaving(false);
      return;
    }

    await registrarHistorico(
      remessaSelecionada.id,
      "etiqueta_recebida",
      "Etiqueta recebida e confirmada."
    );

    await buscarRemessas();
    fecharDrawer();
    setSaving(false);
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

    const { data, error } = await supabase
      .from("remessas")
      .insert({
        numero_remessa: numeroRemessa,
        numero_nota: numeroNota,
        cliente_nome: clienteNome,
        status: "aguardando_agendamento",

        // ✅ EXISTENTE
        etiqueta_criada: false,
        etiqueta_recebida: false,

        // ✅ NOVO
        tipo_carregamento: null,
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error(error);
      setErrorMsg("Erro ao salvar remessa.");
      setSaving(false);
      return;
    }

    await registrarHistorico(data.id, "aguardando_agendamento", "Remessa criada.");
    setNumeroRemessa("");
    setNumeroNota("");
    setClienteNome("");
    await buscarRemessas();
    setSaving(false);
  }

  // ------------------------- ABRIR DRAWER -------------------------
  async function abrirDrawer(remessa: Remessa) {
    setRemessaSelecionada(remessa);
    setDrawerMode("idle");
    setDrawerOpen(true);

    setDataEntrega("");
    setDataCarregamento("");
    setMotivoCancelamento("");
    setNovaRemessa("");
    setNovaNota("");

    setTransportadoraSelecionadaId("");

    // ✅ NOVO
    setTipoCarregamento((remessa.tipo_carregamento as any) || "");

    await carregarHistorico(remessa.id);
  }

  // ------------------------- FECHAR DRAWER -------------------------
  function fecharDrawer() {
    setDrawerOpen(false);
    setDrawerMode("idle");
    setRemessaSelecionada(null);
    setHistorico([]);
    setTransportadoraSelecionadaId("");

    // ✅ NOVO
    setTipoCarregamento("");
  }

  // ------------------------- AGENDAR ENTREGA -------------------------
  async function handleAgendarEntrega() {
    if (!remessaSelecionada || !dataEntrega) return;

    setSaving(true);

    await supabase
      .from("remessas")
      .update({
        data_entrega: new Date(dataEntrega),
        status: "agendada",
      })
      .eq("id", remessaSelecionada.id);

    await registrarHistorico(
      remessaSelecionada.id,
      "agendada",
      `Entrega agendada para ${dataEntrega}`
    );

    await buscarRemessas();
    fecharDrawer();
    setSaving(false);
  }

  // ------------------------- AGENDAR CARREGAMENTO -------------------------
  async function handleAgendarCarregamento() {
    if (!remessaSelecionada || !dataCarregamento) return;

    setSaving(true);

    await supabase
      .from("remessas")
      .update({
        data_carregamento: new Date(dataCarregamento),
      })
      .eq("id", remessaSelecionada.id);

    await registrarHistorico(
      remessaSelecionada.id,
      "carregamento_agendado",
      `Carregamento agendado para ${dataCarregamento}`
    );

    await buscarRemessas();
    fecharDrawer();
  }

  // ------------------------- Marcar Carregada -------------------------
  async function handleMarcarCarregada() {
    if (!remessaSelecionada) return;

    const agora = new Date();
    setSaving(true);

    await supabase
      .from("remessas")
      .update({
        status: "em_rota",
        data_carregada_em: agora,
        data_em_rota_em: agora,
      })
      .eq("id", remessaSelecionada.id);

    await registrarHistorico(remessaSelecionada.id, "carregada", "Remessa carregada.");
    await registrarHistorico(remessaSelecionada.id, "em_rota", "Remessa saiu para rota.");

    await buscarRemessas();
    fecharDrawer();
  }

  // ------------------------- Cancelar -------------------------
  async function handleCancelar() {
    if (!remessaSelecionada || !motivoCancelamento) return;

    await supabase
      .from("remessas")
      .update({
        status: "cancelada",
        observacoes: motivoCancelamento,
      })
      .eq("id", remessaSelecionada.id);

    await registrarHistorico(
      remessaSelecionada.id,
      "cancelada",
      `Cancelada. Motivo: ${motivoCancelamento}`
    );

    await buscarRemessas();
    fecharDrawer();
  }

  // ------------------------- REFATURAR -------------------------
  async function handleRefaturar() {
    if (!remessaSelecionada || !novaRemessa || !novaNota) return;

    setSaving(true);

    await supabase
      .from("remessas")
      .update({ status: "refaturada" })
      .eq("id", remessaSelecionada.id);

    const { data: nova } = await supabase
      .from("remessas")
      .insert({
        numero_remessa: novaRemessa,
        numero_nota: novaNota,
        cliente_nome: remessaSelecionada.cliente_nome,
        status: "aguardando_agendamento",

        etiqueta_criada: false,
        etiqueta_recebida: false,

        // ✅ NOVO
        tipo_carregamento: null,
      })
      .select("*")
      .single();

    if (nova) {
      await registrarHistorico(
        remessaSelecionada.id,
        "refaturada",
        `Refaturada → Nova remessa ${novaRemessa}, nova nota ${novaNota}`
      );

      await registrarHistorico(
        nova.id,
        "aguardando_agendamento",
        `Criada a partir da remessa ${remessaSelecionada.numero_remessa}`
      );
    }

    await buscarRemessas();
    fecharDrawer();
    setSaving(false);
  }

  // ------------------------- DEFINIR TRANSPORTADORA -------------------------
  async function handleDefinirTransportadora() {
    if (!remessaSelecionada || !transportadoraSelecionadaId) {
      setErrorMsg("Selecione uma transportadora.");
      return;
    }

    const nomeTransportadora =
      listaTransportadoras.find((t) => t.id === transportadoraSelecionadaId)?.nome ||
      null;

    await supabase
      .from("remessas")
      .update({
        transportadora: nomeTransportadora,
      })
      .eq("id", remessaSelecionada.id);

    await registrarHistorico(
      remessaSelecionada.id,
      "transportadora_definida",
      `Transportadora definida: ${nomeTransportadora}`
    );

    await buscarRemessas();
    fecharDrawer();
  }

  // ------------------------- Excluir Remessa -------------------------
  async function excluirRemessa() {
    if (!remessaSelecionada) return;

    if (!confirm(`Excluir remessa ${remessaSelecionada.numero_remessa}?`)) return;

    await supabase.from("remessas").delete().eq("id", remessaSelecionada.id);

    await buscarRemessas();
    fecharDrawer();
  }

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

      {/* ---------------- LISTAGEM ---------------- */}
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
              <th className="py-2">Etiqueta Criada</th>
              <th className="py-2">Etiqueta Recebida</th>

              {/* ✅ NOVO */}
              <th className="py-2">Carregamento</th>
            </tr>
          </thead>

          <tbody>
            {remessas.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="py-4 text-center text-xs text-slate-500">
                  Nenhuma remessa cadastrada.
                </td>
              </tr>
            )}

            {remessas.map((r) => (
              <tr
                key={r.id}
                onClick={() => abrirDrawer(r)}
                className="hover:bg-orange-500/10 border-b border-orange-500/10 cursor-pointer"
              >
                <td className="py-2">{r.numero_remessa}</td>
                <td className="py-2">{r.numero_nota}</td>
                <td className="py-2">{r.cliente_nome}</td>
                <td className="py-2">{r.transportadora || "-"}</td>

                <td className="py-2 text-orange-300 text-xs uppercase">
                  {r.status.replaceAll("_", " ")}
                </td>

                <td className="py-2">
                  {r.data_criacao ? new Date(r.data_criacao).toLocaleString("pt-BR") : "-"}
                </td>

                <td className="py-2 text-xs">
                  {r.etiqueta_criada ? (
                    <span className="text-green-400">SIM</span>
                  ) : (
                    <span className="text-slate-500">NÃO</span>
                  )}
                </td>

                <td className="py-2 text-xs">
                  {r.etiqueta_recebida ? (
                    <span className="text-blue-400">SIM</span>
                  ) : (
                    <span className="text-slate-500">NÃO</span>
                  )}
                </td>

                {/* ✅ NOVO */}
                <td className="py-2 text-xs">
                  {r.tipo_carregamento ? (
                    <span className="text-orange-300">{r.tipo_carregamento}</span>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------------- DRAWER ---------------- */}
      {drawerOpen && remessaSelecionada && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={fecharDrawer} />

          <div className="w-full max-w-md bg-[#05070d] border-l border-orange-500/40 p-6 relative">
            <button
              onClick={fecharDrawer}
              className="absolute right-6 top-6 text-slate-400 hover:text-orange-400"
            >
              <FiX size={22} />
            </button>

            <h2 className="text-xl font-semibold text-orange-400 mb-1">Gerenciar Remessa</h2>

            <p className="text-xs text-slate-400 mb-4">
              Remessa: {remessaSelecionada.numero_remessa} <br />
              Nota: {remessaSelecionada.numero_nota} <br />
              Cliente: {remessaSelecionada.cliente_nome} <br />
              Transportadora: {remessaSelecionada.transportadora || "não definida"} <br />
              Etiqueta criada:{" "}
              {remessaSelecionada.etiqueta_criada ? (
                <span className="text-green-400">SIM</span>
              ) : (
                <span className="text-slate-500">NÃO</span>
              )}
              <br />
              Etiqueta recebida:{" "}
              {remessaSelecionada.etiqueta_recebida ? (
                <span className="text-blue-400">SIM</span>
              ) : (
                <span className="text-slate-500">NÃO</span>
              )}
              <br />
              {/* ✅ NOVO */}
              Tipo de carregamento:{" "}
              {remessaSelecionada.tipo_carregamento ? (
                <span className="text-orange-300">{remessaSelecionada.tipo_carregamento}</span>
              ) : (
                <span className="text-slate-500">não definido</span>
              )}
            </p>

            {/* BOTÕES */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button className="kx-btn" onClick={() => setDrawerMode("agendar_entrega")}>
                Agendar Entrega
              </button>

              <button className="kx-btn" onClick={() => setDrawerMode("agendar_carregamento")}>
                Agendar Carregamento
              </button>

              <button className="kx-btn" onClick={() => setDrawerMode("marcar_carregada")}>
                Marcar Carregada
              </button>

              <button className="kx-btn" onClick={() => setDrawerMode("refaturar")}>
                Refaturar
              </button>

              <button className="kx-btn" onClick={() => setDrawerMode("definir_transportadora")}>
                Definir Transportadora
              </button>

              {/* ✅ NOVO */}
              <button className="kx-btn" onClick={() => setDrawerMode("tipo_carregamento")}>
                Tipo de Carregamento
              </button>

              <button
                className="kx-btn"
                onClick={() => {
                  if (!remessaSelecionada.etiqueta_criada) {
                    if (confirm("Confirmar: etiqueta foi criada?")) {
                      handleEtiquetaCriada();
                    }
                  } else {
                    alert("Esta remessa já está marcada como ETIQUETA CRIADA.");
                  }
                }}
                disabled={saving}
              >
                Marcar Etiqueta Criada
              </button>

              <button
                className="kx-btn"
                onClick={() => {
                  if (!remessaSelecionada.etiqueta_recebida) {
                    if (confirm("Confirmar: etiqueta foi recebida?")) {
                      handleEtiquetaRecebida();
                    }
                  } else {
                    alert("Esta remessa já está marcada como ETIQUETA RECEBIDA.");
                  }
                }}
                disabled={saving}
              >
                Confirmar Etiqueta Recebida
              </button>

              <button className="kx-btn-danger" onClick={() => setDrawerMode("cancelar")}>
                Cancelar
              </button>

              <button className="kx-btn-danger" onClick={excluirRemessa}>
                Excluir Remessa
              </button>
            </div>

            {/* CONTEÚDO DA AÇÃO */}
            <div className="space-y-4">
              {drawerMode === "idle" && (
                <p className="text-xs text-slate-400">Selecione uma ação acima.</p>
              )}

              {drawerMode === "agendar_entrega" && (
                <div>
                  <label className="text-xs text-slate-400">Data da entrega</label>
                  <input
                    type="datetime-local"
                    className="kx-input"
                    value={dataEntrega}
                    onChange={(e) => setDataEntrega(e.target.value)}
                  />
                  <button className="kx-btn mt-3" onClick={handleAgendarEntrega} disabled={saving}>
                    Salvar
                  </button>
                </div>
              )}

              {drawerMode === "agendar_carregamento" && (
                <div>
                  <label className="text-xs text-slate-400">Data do carregamento</label>
                  <input
                    type="datetime-local"
                    className="kx-input"
                    value={dataCarregamento}
                    onChange={(e) => setDataCarregamento(e.target.value)}
                  />
                  <button className="kx-btn mt-3" onClick={handleAgendarCarregamento} disabled={saving}>
                    Salvar
                  </button>
                </div>
              )}

              {drawerMode === "marcar_carregada" && (
                <div>
                  <p className="text-xs text-slate-400 mb-3">Confirmar que a remessa foi carregada no CD?</p>
                  <button className="kx-btn mt-3" onClick={handleMarcarCarregada} disabled={saving}>
                    Confirmar
                  </button>
                </div>
              )}

              {drawerMode === "cancelar" && (
                <div>
                  <label className="text-xs text-slate-400">Motivo do cancelamento</label>
                  <textarea
                    className="kx-input"
                    rows={3}
                    value={motivoCancelamento}
                    onChange={(e) => setMotivoCancelamento(e.target.value)}
                  />
                  <button className="kx-btn-danger mt-3" onClick={handleCancelar}>
                    Confirmar Cancelamento
                  </button>
                </div>
              )}

              {drawerMode === "refaturar" && (
                <div>
                  <label className="text-xs text-slate-400">Nova Remessa</label>
                  <input className="kx-input" value={novaRemessa} onChange={(e) => setNovaRemessa(e.target.value)} />

                  <label className="text-xs text-slate-400 mt-2">Nova Nota</label>
                  <input className="kx-input" value={novaNota} onChange={(e) => setNovaNota(e.target.value)} />

                  <button className="kx-btn mt-3" onClick={handleRefaturar}>
                    Confirmar Refaturamento
                  </button>
                </div>
              )}

              {drawerMode === "definir_transportadora" && (
                <div>
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

                  <button className="kx-btn mt-3" onClick={handleDefinirTransportadora} disabled={saving}>
                    Salvar Transportadora
                  </button>
                </div>
              )}

              {/* ✅ NOVO: tipo de carregamento */}
              {drawerMode === "tipo_carregamento" && (
                <div>
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

                  <button
                    className="kx-btn mt-3"
                    onClick={() => {
                      if (!tipoCarregamento) {
                        alert("Selecione PALETIZADA ou BATIDA.");
                        return;
                      }
                      handleDefinirTipoCarregamento();
                    }}
                    disabled={saving}
                  >
                    Salvar Tipo de Carregamento
                  </button>
                </div>
              )}
            </div>

            {/* ---------------- HISTÓRICO ---------------- */}
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
        </div>
      )}
    </div>
  );
}
