import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { nome, cnpj, email, usuarioEmail, senha } = await req.json();

    if (!nome || !cnpj || !email || !usuarioEmail || !senha) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios." },
        { status: 400 }
      );
    }

    // 1. Criar transportadora
    const { data: transportadora, error: tError } = await supabase
      .from("transportadoras")
      .insert([{ nome, cnpj, email }])
      .select()
      .single();

    if (tError) {
      console.log(tError);
      return NextResponse.json(
        { error: "Erro ao criar transportadora." },
        { status: 500 }
      );
    }

    // 2. Criar usuário com senha criptografada
    const hash = await bcrypt.hash(senha, 10);

    const { error: uError } = await supabase
      .from("transportadoras_usuarios")
      .insert([
        {
          transportadora_id: transportadora.id,
          email: usuarioEmail,
          senha: hash
        },
      ]);

    if (uError) {
      console.log(uError);
      return NextResponse.json(
        { error: "Transportadora criada, mas falhou ao criar usuário." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, transportadora },
      { status: 200 }
    );
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { error: "Erro interno ao cadastrar." },
      { status: 500 }
    );
  }
}
