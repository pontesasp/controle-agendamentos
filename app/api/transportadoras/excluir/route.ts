import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function DELETE(req: Request) {
  const { id } = await req.json();

  await supabaseServer
    .from("transportadoras")
    .delete()
    .eq("id", id);

  return NextResponse.json({ success: true });
}
