import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Cria a conta já confirmada, sem enviar e-mail. Roda só no servidor.
export async function POST(req: Request) {
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
      return NextResponse.json({ error: "Servidor sem a chave SUPABASE_SERVICE_ROLE_KEY. Cadastre-a na Vercel e faça Redeploy." }, { status: 500 });
    }
    const { user, password } = await req.json();
    const u = String(user ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (u.length < 3 || String(password ?? "").length < 6) {
      return NextResponse.json({ error: "Usuário (mín. 3) ou senha (mín. 6) inválidos." }, { status: 400 });
    }
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
    const { error } = await admin.auth.admin.createUser({ email: `${u}@financas.app`, password, email_confirm: true });
    if (error) {
      const exists = /already|registered|exists/i.test(error.message);
      return NextResponse.json({ error: exists ? "Esse usuário já existe." : error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro no servidor ao criar a conta." }, { status: 500 });
  }
}
