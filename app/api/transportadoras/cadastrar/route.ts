import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { nome, cnpj, email, usuarioPortal, senhaPortal } =
      await req.json();

    const senhaHash = await bcrypt.hash(senhaPortal, 10);

    const { data: trans } = await supabase
      .from("transportadoras")
      .insert({
        nome,
        cnpj,
        email,
      })
      .select()
      .single();

    await supabase.from("transportadoras_usuarios").insert({
      transportadora_id: trans.id,
      email: usuarioPortal,
      senha_hash: senhaHash,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) });
  }
}
