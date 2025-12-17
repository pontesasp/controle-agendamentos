"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function CadastroTransportadora() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [emailTransportadora, setEmailTransportadora] = useState("");

  const [usuarioEmail, setUsuarioEmail] = useState("");
  const [usuarioSenha, setUsuarioSenha] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  async function cadastrar(e: any) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    if (!nome || !cnpj || !emailTransportadora || !usuarioEmail || !usuarioSenha) {
      setErro("Preencha todos os campos.");
      return;
    }

    setLoading(true);

    // 1️⃣ Criar usuário no Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email: usuarioEmail,
      password: usuarioSenha,
    });

    if (authError || !authUser.user) {
      setErro("Erro ao criar usuário: " + authError?.message);
      setLoading(false);
      return;
    }

    const userId = authUser.user.id;

    // 2️⃣ Criar transportadora
    const { data: transportadora, error: insertError } = await supabase
      .from("transportadoras")
      .insert({
        nome,
        cnpj,
        email: emailTransportadora,
      })
      .select("*")
      .single();

    if (insertError || !transportadora) {
      setErro("Erro ao cadastrar transportadora.");
      setLoading(false);
      return;
    }

    // 3️⃣ Vincular usuário → transportadora
    const { error: linkError } = await supabase
      .from("transportadoras_usuarios")
      .insert({
        usuario_id: userId,
        transportadora_id: transportadora.id,
      });

    if (linkError) {
      setErro("Usuário criado, mas não foi possível vincular à transportadora.");
      setLoading(false);
      return;
    }

    setSucesso("Transportadora cadastrada com sucesso!");

    setTimeout(() => router.push("/transportadoras"), 1000);
  }

  return (
    <div className="p-10">
      <h1 className="text-3xl text-orange-400 mb-6 font-bold">
        Cadastro de Transportadora
      </h1>

      {erro && <p className="text-red-400 mb-3">{erro}</p>}
      {sucesso && <p className="text-green-400 mb-3">{sucesso}</p>}

      <form onSubmit={cadastrar} className="space-y-4 max-w-xl">

        <div>
          <label className="text-orange-300 text-sm">Nome da Transportadora</label>
          <input
            className="kx-input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        <div>
          <label className="text-orange-300 text-sm">CNPJ</label>
          <input
            className="kx-input"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
          />
        </div>

        <div>
          <label className="text-orange-300 text-sm">E-mail da Transportadora</label>
          <input
            className="kx-input"
            value={emailTransportadora}
            onChange={(e) => setEmailTransportadora(e.target.value)}
          />
        </div>

        <hr className="border-orange-500/30 my-6" />

        <h2 className="text-xl text-orange-400">Acesso do Portal</h2>

        <div>
          <label className="text-orange-300 text-sm">E-mail do Usuário</label>
          <input
            className="kx-input"
            value={usuarioEmail}
            onChange={(e) => setUsuarioEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="text-orange-300 text-sm">Senha</label>
          <input
            className="kx-input"
            type="password"
            value={usuarioSenha}
            onChange={(e) => setUsuarioSenha(e.target.value)}
          />
        </div>

        <button className="kx-btn" disabled={loading}>
          {loading ? "Cadastrando..." : "Cadastrar Transportadora"}
        </button>
      </form>
    </div>
  );
}
