import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nome, cnpj, email } = body;

    if (!nome || !cnpj || !email) {
      return NextResponse.json(
        { error: "Preencha todos os campos" },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from("transportadoras")
      .insert({
        nome,
        cnpj,
        email,
      });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Erro ao cadastrar transportadora" },
      { status: 500 }
    );
  }
}
