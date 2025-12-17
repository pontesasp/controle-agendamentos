"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Transportadora = {
  id: string;
  nome: string;
  cnpj: string;
  email: string;
  telefone: string | null;
  criada_em: string;
};

export default function TransportadorasPage() {
  const [lista, setLista] = useState<Transportadora[]>([]);
  const [loading, setLoading] = useState(true);

  // FORM
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  // EDIÇÃO
  const [editando, setEditando] = useState<Transportadora | null>(null);

  async function carregar() {
    setLoading(true);

    const { data, error } = await supabase
      .from("transportadoras")
      .select("*")
      .order("criada_em", { ascending: false });

    if (!error) setLista(data || []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function cadastrar() {
    if (!nome || !cnpj || !email) {
      alert("Preencha nome, CNPJ e e-mail");
      return;
    }

    const { error } = await supabase.from("transportadoras").insert({
      nome,
      cnpj,
      email,
      telefone: telefone || null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNome("");
    setCnpj("");
    setEmail("");
    setTelefone("");

    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Deseja excluir esta transportadora?")) return;

    const { error } = await supabase
      .from("transportadoras")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    carregar();
  }

  async function salvarEdicao() {
    if (!editando) return;

    const { error } = await supabase
      .from("transportadoras")
      .update({
        nome: editando.nome,
        cnpj: editando.cnpj,
        email: editando.email,
        telefone: editando.telefone,
      })
      .eq("id", editando.id);

    if (error) {
      alert(error.message);
      return;
    }

    setEditando(null);
    carregar();
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-orange-500 mb-6">
        Cadastro de Transportadoras
      </h1>

      {/* FORM CADASTRO */}
      <div className="border border-orange-500/40 rounded-lg p-4 mb-8 bg-[#0b0f1a]">
        <h2 className="text-orange-400 font-semibold mb-4">
          Nova Transportadora
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <input
            className="kx-input"
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <input
            className="kx-input"
            placeholder="CNPJ"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
          />
          <input
            className="kx-input"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="kx-input"
            placeholder="Telefone (opcional)"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
          />
        </div>

        <button className="kx-btn mt-4" onClick={cadastrar}>
          Cadastrar Transportadora
        </button>
      </div>

      {/* LISTAGEM */}
      {loading && <p className="text-gray-400">Carregando...</p>}

      <div className="space-y-4">
        {lista.map((t) => (
          <div
            key={t.id}
            className="border border-orange-500/40 rounded-lg p-4 bg-[#0b0f1a]"
          >
            <h3 className="text-orange-400 font-semibold">{t.nome}</h3>
            <p className="text-sm">CNPJ: {t.cnpj}</p>
            <p className="text-sm">E-mail: {t.email}</p>
            {t.telefone && <p className="text-sm">Telefone: {t.telefone}</p>}

            <div className="flex gap-2 mt-3">
              <button
                className="kx-btn"
                onClick={() => setEditando(t)}
              >
                Editar
              </button>

              <button
                className="kx-btn-danger"
                onClick={() => excluir(t.id)}
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL EDIÇÃO */}
      {editando && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#0b0f1a] p-6 rounded-lg w-[400px] border border-orange-500">
            <h3 className="text-orange-400 font-semibold mb-4">
              Editar Transportadora
            </h3>

            <input
              className="kx-input mb-2"
              value={editando.nome}
              onChange={(e) =>
                setEditando({ ...editando, nome: e.target.value })
              }
            />
            <input
              className="kx-input mb-2"
              value={editando.cnpj}
              onChange={(e) =>
                setEditando({ ...editando, cnpj: e.target.value })
              }
            />
            <input
              className="kx-input mb-2"
              value={editando.email}
              onChange={(e) =>
                setEditando({ ...editando, email: e.target.value })
              }
            />
            <input
              className="kx-input mb-4"
              value={editando.telefone || ""}
              onChange={(e) =>
                setEditando({ ...editando, telefone: e.target.value })
              }
            />

            <div className="flex justify-end gap-2">
              <button
                className="kx-btn-danger"
                onClick={() => setEditando(null)}
              >
                Cancelar
              </button>
              <button className="kx-btn" onClick={salvarEdicao}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
