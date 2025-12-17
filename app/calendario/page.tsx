"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ===================== TIPOS ===================== */

type Remessa = {
  id: string;
  numero_remessa: string;
  numero_nota: string;
  cliente_nome: string;
  transportadora: string | null;
  data_carregamento: string | null;
  data_entrega: string | null;
  status: string;
};

type EventoCalendario = {
  id: string;
  tipo: "carregamento" | "entrega";
  data: string;
  titulo: string;
  descricao: string;
  cancelado?: boolean;
  finalizado?: boolean;
};

type AlertaIA = {
  id: string;
  tipo: "info" | "sucesso" | "atraso";
  mensagem: string;
};

/* ===================== COMPONENTE ===================== */

export default function CalendarioPage() {
  const [remessas, setRemessas] = useState<Remessa[]>([]);
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [alertasIA, setAlertasIA] = useState<AlertaIA[]>([]);

  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0, 10);

  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());

  const [popupOpen, setPopupOpen] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] =
    useState<EventoCalendario | null>(null);

  /* ===================== NOTIFICAÇÃO ===================== */

  function notificar(mensagem: string) {
    if (typeof window === "undefined") return;

    if (Notification.permission === "granted") {
      new Notification("Assistente Logístico", {
        body: mensagem,
        icon: "/favicon.ico",
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification("Assistente Logístico", {
            body: mensagem,
            icon: "/favicon.ico",
          });
        }
      });
    }
  }

  /* ===================== CARREGAR DADOS ===================== */

  useEffect(() => {
    carregarRemessas();
  }, []);

  async function carregarRemessas() {
    const { data } = await supabase
      .from("remessas")
      .select(
        "id, numero_remessa, numero_nota, cliente_nome, transportadora, data_carregamento, data_entrega, status"
      );

    if (data) {
      setRemessas(data as Remessa[]);
      gerarEventos(data as Remessa[]);
      gerarAlertasIA(data as Remessa[]);
    }
  }

  /* ===================== EVENTOS ===================== */

  function gerarEventos(lista: Remessa[]) {
  const evts: EventoCalendario[] = [];

  lista.forEach((r) => {
    const cancelada = r.status === "cancelada";
    const finalizado =
      r.status === "entregue" || r.status === "carregada";

    if (r.data_carregamento) {
      evts.push({
        id: r.id + "-carregamento",
        tipo: "carregamento",
        data: r.data_carregamento,
        titulo: `Carregamento - ${r.cliente_nome}`,
        descricao: `Remessa ${r.numero_remessa}, Nota ${r.numero_nota}\nTransportadora: ${
          r.transportadora || "Não definida"
        }`,
        cancelado: cancelada,
        finalizado: finalizado, // 👈 AQUI
      });
    }

    if (r.data_entrega) {
      evts.push({
        id: r.id + "-entrega",
        tipo: "entrega",
        data: r.data_entrega,
        titulo: `Entrega - ${r.cliente_nome}`,
        descricao: `Remessa ${r.numero_remessa}, Nota ${r.numero_nota}\nTransportadora: ${
          r.transportadora || "Não definida"
        }`,
        cancelado: cancelada,
        finalizado: finalizado, // 👈 AQUI
      });
    }
  });

  setEventos(evts);
}


  /* ===================== 🤖 INTELIGÊNCIA ===================== */

  function gerarAlertasIA(lista: Remessa[]) {
    const alertas: AlertaIA[] = [];

    const carregHoje = lista.filter(
      (r) => r.data_carregamento?.slice(0, 10) === hojeStr
    );

    const entregaHoje = lista.filter(
      (r) => r.data_entrega?.slice(0, 10) === hojeStr
    );

    const atrasadas = lista.filter(
      (r) =>
        r.data_entrega &&
        r.data_entrega.slice(0, 10) < hojeStr &&
        r.status !== "entregue"
    );

    if (carregHoje.length) {
      const msg = `Hoje há ${carregHoje.length} carregamento(s) programado(s).`;
      alertas.push({ id: "carreg-hoje", tipo: "info", mensagem: msg });
      notificar(msg);
    }

    if (entregaHoje.length) {
      const msg = `Hoje há ${entregaHoje.length} entrega(s) programada(s).`;
      alertas.push({ id: "entrega-hoje", tipo: "info", mensagem: msg });
      notificar(msg);
    }

    atrasadas.forEach((r) => {
      const msg = `Entrega da remessa ${r.numero_remessa} está atrasada.`;
      alertas.push({ id: r.id + "-atraso", tipo: "atraso", mensagem: msg });
      notificar(msg);
    });

    lista.forEach((r) => {
      if (r.status === "entregue" || r.status === "carregada") {
        const msg = `Remessa ${r.numero_remessa} foi marcada como ${r.status.toUpperCase()}.`;
        alertas.push({ id: r.id + "-status", tipo: "sucesso", mensagem: msg });
        notificar(msg);
      }
    });

    setAlertasIA(alertas);
  }

  /* ===================== CALENDÁRIO ===================== */

  function obterDiasDoMes(mes: number, ano: number) {
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    return { primeiroDia, ultimoDia };
  }

  function mudarMes(delta: number) {
    let novoMes = mesAtual + delta;
    let novoAno = anoAtual;

    if (novoMes > 11) {
      novoMes = 0;
      novoAno++;
    } else if (novoMes < 0) {
      novoMes = 11;
      novoAno--;
    }

    setMesAtual(novoMes);
    setAnoAtual(novoAno);
  }

  function abrirPopup(evt: EventoCalendario) {
    setEventoSelecionado(evt);
    setPopupOpen(true);
  }

  function fecharPopup() {
    setPopupOpen(false);
    setEventoSelecionado(null);
  }

  const { primeiroDia, ultimoDia } = obterDiasDoMes(mesAtual, anoAtual);
  const diasNoMes = Array.from(
    { length: ultimoDia.getDate() },
    (_, i) => i + 1
  );
  const diaSemanaPrimeiro = primeiroDia.getDay();

  /* ===================== RENDER ===================== */

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-bold text-orange-400">
        Calendário de Entregas e Carregamentos
      </h1>

      {/* 🤖 ASSISTENTE LOGÍSTICO */}
      {alertasIA.length > 0 && (
        <div className="bg-[#0d1117] border border-orange-500/40 rounded-lg p-4 space-y-2">
          <h2 className="text-orange-400 font-semibold">
            🤖 Assistente Logístico
          </h2>

          {alertasIA.map((a) => (
            <div
              key={a.id}
              className={`text-sm px-3 py-2 rounded ${
                a.tipo === "sucesso"
                  ? "bg-green-600/30 text-green-300"
                  : a.tipo === "atraso"
                  ? "bg-red-600/30 text-red-300"
                  : "bg-blue-600/30 text-blue-300"
              }`}
            >
              {a.mensagem}
            </div>
          ))}
        </div>
      )}

      {/* NAV */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => mudarMes(-1)}
          className="px-3 py-1 rounded bg-orange-500 text-black"
        >
          ◀
        </button>

        <h2 className="text-xl font-semibold text-orange-300">
          {new Date(anoAtual, mesAtual).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          })}
        </h2>

        <button
          onClick={() => mudarMes(1)}
          className="px-3 py-1 rounded bg-orange-500 text-black"
        >
          ▶
        </button>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-7 gap-2 text-center text-slate-300 text-sm">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="font-semibold text-orange-300">
            {d}
          </div>
        ))}

        {Array.from({ length: diaSemanaPrimeiro }).map((_, i) => (
          <div key={"empty-" + i}></div>
        ))}

        {diasNoMes.map((dia) => {
          const dataStr = new Date(anoAtual, mesAtual, dia)
            .toISOString()
            .slice(0, 10);

          const eventosDoDia = eventos.filter(
            (e) => e.data.slice(0, 10) === dataStr
          );

          return (
            <div
              key={dia}
              className="border border-orange-500/30 rounded-md p-2 min-h-[110px] bg-[#0a0d14]"
            >
              <div className="text-slate-400 text-xs mb-1">{dia}</div>

              <div className="space-y-1">
                {eventosDoDia.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => abrirPopup(evt)}
                    className={`text-[11px] px-2 py-1 rounded cursor-pointer border ${
                      evt.cancelado
                        ? "bg-red-700/40 text-red-300 border-red-500/40"
                        : evt.finalizado
                        ? "bg-gray-600/40 text-gray-300 border-gray-500/40 line-through"
                        : evt.tipo === "carregamento"
                        ? "bg-blue-600/40 text-blue-300 border-blue-500/40"
                        : "bg-green-600/40 text-green-300 border-green-500/40"
                    }`}
                  >
                    {evt.titulo}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* POPUP */}
      {popupOpen && eventoSelecionado && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0d1117] p-6 rounded-lg border border-orange-500/40 max-w-md w-full">
            <h2 className="text-xl font-bold text-orange-400 mb-4">
              {eventoSelecionado.titulo}
            </h2>

            <p className="text-slate-300 text-sm whitespace-pre-line">
              {eventoSelecionado.descricao}
            </p>

            <button
              onClick={fecharPopup}
              className="mt-6 px-4 py-2 rounded bg-orange-500 text-black"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
