import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const { data } = await supabaseServer
    .from("transportadoras")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json(data ?? []);
}
