import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  const { data, error } = await supabase
    .from("transportadoras")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    console.log(error);
    return NextResponse.json({ error: "Erro ao buscar transportadoras" }, { status: 500 });
  }

  return NextResponse.json(data);
}
