"use client";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Exp = { id: string; date: string; description: string; category: string; bank: string; method: string; amount: number };
type Inc = { id: string; date: string; type: string; description: string; amount: number };
type Cat = { id: string; name: string; budget: number };
type Bank = { id: string; name: string };
type Res = PromiseLike<{ error: { message: string } | null }>;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const METHODS = ["Crédito", "Débito", "Pix", "Dinheiro", "Boleto", "Transferência", "Vale (VR/VA)"];
const TYPES = ["Hora extra", "Trabalho externo", "Freelance", "Bônus / 13º", "Rendimentos", "Reembolso", "VR/VA", "Outros"];
const today = () => new Date().toLocaleDateString("sv-SE");
const inp = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-2 focus:outline-teal-700";
const btn = "rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";
const card = "rounded-xl border border-stone-200 bg-white p-4";

function Auth() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const cred = { email: String(f.get("email")), password: String(f.get("password")) };
    const { data, error } = mode === "in" ? await supabase.auth.signInWithPassword(cred) : await supabase.auth.signUp(cred);
    setMsg(error ? error.message : mode === "up" && !data.session ? "Conta criada. Confirme o e-mail e depois entre." : "");
  };
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold text-stone-900">Minhas finanças</h1>
      <form onSubmit={submit} className={card + " flex flex-col gap-3"}>
        <input name="email" type="email" required placeholder="E-mail" className={inp} />
        <input name="password" type="password" required minLength={6} placeholder="Senha (mín. 6 caracteres)" className={inp} />
        <button className={btn}>{mode === "in" ? "Entrar" : "Criar conta"}</button>
        {msg && <p className="text-sm text-red-700">{msg}</p>}
      </form>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="text-sm text-teal-800 underline">
        {mode === "in" ? "Ainda não tenho conta" : "Já tenho conta"}
      </button>
    </main>
  );
}

function Row({ title, sub, amount, onDel }: { title: string; sub: string; amount: number; onDel: () => void }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-stone-900">{title}</p>
        <p className="truncate text-xs text-stone-500">{sub}</p>
      </div>
      <span className="text-sm font-semibold text-stone-900">{brl(amount)}</span>
      <button onClick={onDel} aria-label="Excluir" className="px-1 text-stone-400 hover:text-red-700">✕</button>
    </li>
  );
}

function App({ session }: { session: Session }) {
  const [tab, setTab] = useState("dash");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [exp, setExp] = useState<Exp[]>([]);
  const [inc, setInc] = useState<Inc[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [salary, setSalary] = useState(0);

  const load = useCallback(async () => {
    const [e, i, c, b, s] = await Promise.all([
      supabase.from("expenses").select("*").order("date", { ascending: false }),
      supabase.from("incomes").select("*").order("date", { ascending: false }),
      supabase.from("categories").select("*").order("name"),
      supabase.from("banks").select("*").order("name"),
      supabase.from("settings").select("salary").maybeSingle(),
    ]);
    setExp((e.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })));
    setInc((i.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })));
    setCats((c.data ?? []).map((x) => ({ ...x, budget: Number(x.budget) })));
    setBanks(b.data ?? []);
    setSalary(Number(s.data?.salary ?? 0));
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (p: Res) => { const r = await p; if (r.error) alert(r.error.message); else load(); };
  const del = (t: string, id: string) => confirm("Excluir este item?") && run(supabase.from(t).delete().eq("id", id));
  const add = (t: string) => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    await run(supabase.from(t).insert(Object.fromEntries(new FormData(f))));
    f.reset();
  };

  const mExp = exp.filter((x) => x.date.startsWith(month));
  const mInc = inc.filter((x) => x.date.startsWith(month));
  const extra = sum(mInc.map((x) => x.amount));
  const rec = salary + extra;
  const desp = sum(mExp.map((x) => x.amount));
  const saldo = rec - desp;
  const byCat = cats.map((c) => ({ ...c, spent: sum(mExp.filter((x) => x.category === c.name).map((x) => x.amount)) }));
  const byBank = banks.map((b) => ({ name: b.name, v: sum(mExp.filter((x) => x.bank === b.name).map((x) => x.amount)) })).filter((x) => x.v > 0);
  const tabs = [["dash", "Resumo"], ["exp", "Despesas"], ["inc", "Receitas"], ["cfg", "Ajustes"]];
  const kpis = [
    ["Receitas", brl(rec), "text-stone-900"],
    ["Despesas", brl(desp), "text-stone-900"],
    ["Saldo", brl(saldo), saldo < 0 ? "text-red-700" : "text-teal-800"],
    ["Poupado", rec > 0 ? Math.round((saldo / rec) * 100) + "%" : "-", "text-stone-900"],
  ];

  return (
    <div className="min-h-screen bg-stone-50 pb-20 text-stone-900 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold">Minhas finanças</h1>
          <nav className="ml-6 hidden gap-1 md:flex">
            {tabs.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm ${tab === k ? "bg-teal-800 text-white" : "text-stone-600 hover:bg-stone-100"}`}>{l}</button>
            ))}
          </nav>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={inp + " ml-auto !w-auto"} aria-label="Mês" />
          <button onClick={() => supabase.auth.signOut()} className="text-sm text-stone-500 hover:text-stone-900">Sair</button>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
        {tab === "dash" && (<>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {kpis.map(([l, v, c]) => (
              <div key={l} className={card}><p className="text-xs text-stone-500">{l}</p><p className={`mt-1 text-xl font-semibold ${c}`}>{v}</p></div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <section className={card + " md:col-span-2"}>
              <h2 className="mb-3 text-sm font-semibold">Orçamento por categoria</h2>
              <ul className="flex flex-col gap-3">
                {byCat.filter((c) => c.spent > 0 || c.budget > 0).map((c) => {
                  const p = c.budget > 0 ? c.spent / c.budget : 0;
                  const col = p > 1 ? "bg-red-600" : p >= 0.8 ? "bg-amber-500" : "bg-teal-700";
                  return (
                    <li key={c.id}>
                      <div className="flex justify-between text-sm"><span>{c.name}</span><span className="text-stone-600">{brl(c.spent)}{c.budget > 0 && ` / ${brl(c.budget)}`}</span></div>
                      {c.budget > 0 && <div className="mt-1 h-2 rounded bg-stone-100"><div className={`h-2 rounded ${col}`} style={{ width: Math.min(p, 1) * 100 + "%" }} /></div>}
                    </li>
                  );
                })}
                {!desp && <p className="text-sm text-stone-500">Nenhuma despesa neste mês. Lance a primeira na aba Despesas.</p>}
              </ul>
            </section>
            <section className={card}>
              <h2 className="mb-3 text-sm font-semibold">Gasto por banco</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {byBank.map((b) => <li key={b.name} className="flex justify-between"><span>{b.name}</span><span>{brl(b.v)}</span></li>)}
                {!byBank.length && <p className="text-stone-500">Sem gastos neste mês.</p>}
              </ul>
            </section>
          </div>
        </>)}

        {tab === "exp" && (<>
          <form onSubmit={add("expenses")} className={card + " grid gap-2 sm:grid-cols-6"}>
            <input name="date" type="date" required defaultValue={today()} className={inp} />
            <input name="description" required placeholder="Descrição" className={inp + " sm:col-span-2"} />
            <select name="category" required className={inp}>{cats.map((c) => <option key={c.id}>{c.name}</option>)}</select>
            <select name="bank" required className={inp}>{banks.map((b) => <option key={b.id}>{b.name}</option>)}</select>
            <select name="method" required className={inp}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
            <input name="amount" type="number" step="0.01" min="0" required placeholder="Valor (R$)" className={inp + " sm:col-span-2"} />
            <button className={btn + " sm:col-span-4"}>Adicionar despesa</button>
          </form>
          <ul className={card + " divide-y divide-stone-100"}>
            {mExp.map((x) => <Row key={x.id} title={x.description} sub={`${x.date.split("-").reverse().join("/")} · ${x.category} · ${x.bank} · ${x.method}`} amount={x.amount} onDel={() => del("expenses", x.id)} />)}
            {!mExp.length && <p className="py-2 text-sm text-stone-500">Nenhuma despesa neste mês.</p>}
          </ul>
        </>)}

        {tab === "inc" && (<>
          <p className="text-sm text-stone-600">Salário fixo: <b>{brl(salary)}</b> (altere em Ajustes). Lance aqui só as rendas extras.</p>
          <form onSubmit={add("incomes")} className={card + " grid gap-2 sm:grid-cols-5"}>
            <input name="date" type="date" required defaultValue={today()} className={inp} />
            <select name="type" required className={inp}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <input name="description" placeholder="Descrição" className={inp} />
            <input name="amount" type="number" step="0.01" min="0" required placeholder="Valor (R$)" className={inp} />
            <button className={btn}>Adicionar</button>
          </form>
          <ul className={card + " divide-y divide-stone-100"}>
            {mInc.map((x) => <Row key={x.id} title={x.type} sub={`${x.date.split("-").reverse().join("/")} · ${x.description ?? ""}`} amount={x.amount} onDel={() => del("incomes", x.id)} />)}
            {!mInc.length && <p className="py-2 text-sm text-stone-500">Nenhuma receita extra neste mês.</p>}
          </ul>
        </>)}

        {tab === "cfg" && (<>
          <form className={card + " flex items-end gap-2"} onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("salary"); run(supabase.from("settings").upsert({ user_id: session.user.id, salary: v })); }}>
            <label className="flex-1 text-sm">Salário mensal (líquido)<input name="salary" type="number" step="0.01" min="0" key={salary} defaultValue={salary} className={inp + " mt-1"} /></label>
            <button className={btn}>Salvar</button>
          </form>
          <section className={card}>
            <h2 className="mb-1 text-sm font-semibold">Categorias e orçamento mensal</h2>
            <ul className="divide-y divide-stone-100">
              {cats.map((c) => (
                <li key={c.id + c.budget} className="flex items-center gap-2 py-1.5">
                  <span className="flex-1 truncate text-sm">{c.name}</span>
                  <input type="number" min="0" step="10" defaultValue={c.budget || ""} placeholder="R$ 0" aria-label={`Orçamento de ${c.name}`}
                    onBlur={(e) => Number(e.target.value) !== c.budget && run(supabase.from("categories").update({ budget: e.target.value || 0 }).eq("id", c.id))} className={inp + " !w-28"} />
                  <button onClick={() => del("categories", c.id)} aria-label="Excluir" className="px-1 text-stone-400 hover:text-red-700">✕</button>
                </li>
              ))}
            </ul>
            <form onSubmit={add("categories")} className="mt-2 flex gap-2"><input name="name" required placeholder="Nova categoria" className={inp} /><button className={btn}>Adicionar</button></form>
          </section>
          <section className={card}>
            <h2 className="mb-1 text-sm font-semibold">Bancos</h2>
            <ul className="divide-y divide-stone-100">
              {banks.map((b) => (
                <li key={b.id} className="flex items-center py-1.5"><span className="flex-1 text-sm">{b.name}</span>
                  <button onClick={() => del("banks", b.id)} aria-label="Excluir" className="px-1 text-stone-400 hover:text-red-700">✕</button></li>
              ))}
            </ul>
            <form onSubmit={add("banks")} className="mt-2 flex gap-2"><input name="name" required placeholder="Novo banco" className={inp} /><button className={btn}>Adicionar</button></form>
          </section>
        </>)}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-stone-200 bg-white md:hidden">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`py-3 text-xs font-medium ${tab === k ? "text-teal-800" : "text-stone-500"}`}>{l}</button>
        ))}
      </nav>
    </div>
  );
}

export default function Page() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);
  if (session === undefined) return <p className="p-6 text-sm text-stone-500">Carregando…</p>;
  return session ? <App key={session.user.id} session={session} /> : <Auth />;
}


"aa"