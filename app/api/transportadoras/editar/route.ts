import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { id, nome, cnpj, email, email_login, senha } = await req.json();

    // Atualizar tabela transportadoras
    const { error: errorTransportadora } = await supabase
      .from("transportadoras")
      .update({
        nome,
        cnpj,
        email,
      })
      .eq("id", id);

    if (errorTransportadora) {
      return NextResponse.json(
        { error: "Erro ao atualizar transportadora", details: errorTransportadora },
        { status: 500 }
      );
    }

    // Atualizar usuário da transportadora
    let senha_hash = null;
    if (senha && senha.length > 0) {
      senha_hash = await bcrypt.hash(senha, 10);
    }

    const updateData: any = {
      email_login,
    };

    if (senha_hash) updateData.senha_hash = senha_hash;

    const { error: errorUsuario } = await supabase
      .from("transportadoras_usuarios")
      .update(updateData)
      .eq("transportadora_id", id);

    if (errorUsuario) {
      return NextResponse.json(
        { error: "Erro ao atualizar usuário da transportadora", details: errorUsuario },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Erro geral:", err);
    return NextResponse.json(
      { error: "Erro inesperado no servidor" },
      { status: 500 }
    );
  }
}
