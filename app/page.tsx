"use client";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { LayoutDashboard, TrendingDown, TrendingUp, CreditCard, Settings, LogOut, Sun, Moon, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Exp = { id: string; date: string; description: string; category: string; bank: string; method: string; amount: number; card_id?: string | null };
type Inc = { id: string; date: string; type: string; description: string; amount: number };
type Cat = { id: string; name: string; budget: number };
type Bank = { id: string; name: string };
type Card = { id: string; name: string; bank: string | null; closing_day: number; due_day: number };
type Inst = { id: string; description: string; category: string; card_id: string | null; total: number; n: number; start_month: string; paid_ahead: number };
type Res = PromiseLike<{ error: { message: string } | null }>;

let hidden = false; // quando true, todos os valores em R$ aparecem como ••••
const brl = (n: number) => (hidden ? "R$ ••••" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const METHODS = ["Crédito", "Débito", "Pix", "Dinheiro", "Boleto", "Transferência", "Vale (VR/VA)"];
const TYPES = ["Hora extra", "Trabalho externo", "Freelance", "Bônus / 13º", "Rendimentos", "Reembolso", "VR/VA", "Outros"];
const today = () => new Date().toLocaleDateString("sv-SE");
const inp = "w-full rounded-xl border border-slate-200 bg-surface px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-500 focus:outline-2 focus:outline-accent-200";
const btn = "rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500";
const card = "rounded-2xl border border-slate-100 bg-surface p-4 shadow-sm";
const CAT_ICON: Record<string, string> = { "Moradia": "🏠", "Contas da casa": "💡", "Internet e telefone": "📶", "Mercado": "🛒", "Restaurantes e delivery": "🍔", "Uber / 99": "🚗", "Transporte público": "🚌", "Combustível": "⛽", "Carro": "🔧", "Saúde": "🩺", "Farmácia": "💊", "Educação": "🎓", "Lazer": "🎬", "Hobby": "🎨", "Viagens": "✈️", "Assinaturas": "📺", "Vestuário": "👕", "Beleza e cuidados": "🪮", "Pets": "🐾", "Presentes e doações": "🎁", "Impostos e taxas": "🧾", "Investimentos": "📈", "Dívidas e parcelas": "💳", "Outros": "📦" };
const BANK_COLOR: Record<string, string> = { "Nubank": "#8A05BE", "Itaú": "#EC7000", "Bradesco": "#CC092F", "Banco do Brasil": "#F9D400", "Caixa": "#0070AF", "Santander": "#EC0000", "Inter": "#FF7A00", "C6 Bank": "#242424", "BTG Pactual": "#001E62", "PicPay": "#11C76F", "Mercado Pago": "#00B1EA", "XP": "#111111", "Sicoob": "#003641", "Banrisul": "#0A5CA8", "Neon": "#00A5B5", "Dinheiro (espécie)": "#16A34A", "Vale (VR/VA)": "#F59E0B" };
const catIcon = (n: string) => CAT_ICON[n] ?? "🏷️";
function BankLogo({ name }: { name: string }) {
  return <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: BANK_COLOR[name] ?? "#64748b", color: name === "Banco do Brasil" ? "#1e3a8a" : "#fff" }}>{name[0]}</span>;
}

const pad = (n: number) => String(n).padStart(2, "0");
const addM = (ym: string, k: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const diffM = (a: string, b: string) => { const [y1, m1] = a.split("-").map(Number); const [y2, m2] = b.split("-").map(Number); return (y1 - y2) * 12 + (m1 - m2); };
const day = (ym: string, d: number) => { const [y, m] = ym.split("-").map(Number); return `${ym}-${pad(Math.min(d, new Date(y, m, 0).getDate()))}`; };
const dmy = (iso: string) => iso.split("-").reverse().join("/");

function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  const toggle = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    try { localStorage.setItem("theme", d ? "dark" : "light"); } catch {}
  };
  return (
    <button onClick={toggle} aria-label="Alternar tema claro/escuro" title={dark ? "Tema claro" : "Tema escuro"} className={`rounded-xl p-2 ${onDark ? "text-white hover:bg-white/10" : "text-slate-500 hover:bg-slate-100"}`}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function Auth() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const user = String(f.get("user")).trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (user.length < 3) return setMsg("Usuário: mínimo 3 letras ou números, sem espaços.");
    const cred = { email: `${user}@financas.app`, password: String(f.get("password")) };
    setBusy(true);
    const { error } = mode === "in" ? await supabase.auth.signInWithPassword(cred) : await supabase.auth.signUp(cred);
    setBusy(false);
    setMsg(error ? (/invalid login/i.test(error.message) ? "Usuário ou senha incorretos." : /already/i.test(error.message) ? "Esse usuário já existe." : error.message) : "");
  };
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-accent-800 via-accent-700 to-accent-600 p-6">
      <div className="absolute right-4 top-4"><ThemeToggle onDark /></div>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-xl font-bold">R$</span>
          <h1 className="text-2xl font-bold">Minhas finanças</h1>
          <p className="text-sm text-accent-200">Entre com seu usuário e senha</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-xl">
          <input name="user" required autoCapitalize="none" autoComplete="username" placeholder="Usuário" className={inp} />
          <input name="password" type="password" required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder="Senha" className={inp} />
          <button disabled={busy} className={btn}>{mode === "in" ? "Entrar" : "Criar conta"}</button>
          {msg && <p className="text-sm text-rose-600">{msg}</p>}
        </form>
        <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); }} className="mt-4 w-full text-center text-sm text-white underline">
          {mode === "in" ? "Ainda não tenho conta" : "Já tenho conta"}
        </button>
      </div>
    </main>
  );
}

function Row({ icon, badge, title, sub, amount, onDel }: { icon: React.ReactNode; badge?: React.ReactNode; title: string; sub: string; amount: number; onDel: () => void }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-lg">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{title}</p>
        <p className="truncate text-xs text-slate-500">{sub}</p>
      </div>
      {badge}
      <span className="text-sm font-semibold text-slate-900">{brl(amount)}</span>
      <button onClick={onDel} aria-label="Excluir" className="px-1 text-slate-300 hover:text-rose-600">✕</button>
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
  const [cards, setCards] = useState<Card[]>([]);
  const [inst, setInst] = useState<Inst[]>([]);
  const [hide, setHide] = useState(() => { try { return localStorage.getItem("hide") === "1"; } catch { return false; } });
  hidden = hide;
  const toggleHide = () => { const v = !hide; setHide(v); try { localStorage.setItem("hide", v ? "1" : "0"); } catch {} };

  const load = useCallback(async () => {
    const [e, i, c, b, s, k, p] = await Promise.all([
      supabase.from("expenses").select("*").order("date", { ascending: false }),
      supabase.from("incomes").select("*").order("date", { ascending: false }),
      supabase.from("categories").select("*").order("name"),
      supabase.from("banks").select("*").order("name"),
      supabase.from("settings").select("salary").maybeSingle(),
      supabase.from("cards").select("*").order("name"),
      supabase.from("installments").select("*").order("start_month"),
    ]);
    setExp((e.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })));
    setInc((i.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })));
    setCats((c.data ?? []).map((x) => ({ ...x, budget: Number(x.budget) })));
    setBanks(b.data ?? []);
    setSalary(Number(s.data?.salary ?? 0));
    setCards(k.data ?? []);
    setInst((p.data ?? []).map((x) => ({ ...x, total: Number(x.total) })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (p: Res) => { const r = await p; if (r.error) alert(r.error.message); else load(); };
  const del = (t: string, id: string) => confirm("Excluir este item?") && run(supabase.from(t).delete().eq("id", id));
  const add = (t: string) => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    await run(supabase.from(t).insert(Object.fromEntries(Array.from(new FormData(f)).map(([k, v]) => [k, v === "" ? null : v]))));
    f.reset();
  };

  const thisM = today().slice(0, 7);
  const cardOf = (id: string | null) => cards.find((c) => c.id === id);
  const nAct = (p: Inst) => p.n - p.paid_ahead;
  const virt: Exp[] = inst.flatMap((p) => {
    const idx = diffM(month, p.start_month);
    if (idx < 0 || idx >= nAct(p)) return [];
    const c = cardOf(p.card_id);
    return [{ id: `inst-${p.id}`, date: day(month, c?.due_day ?? 1), description: `${p.description} (${idx + 1}/${nAct(p)})`, category: p.category, bank: c?.bank ?? "", method: "Crédito", amount: p.total / p.n, card_id: p.card_id }];
  });
  const mExp = [...exp.filter((x) => x.date.startsWith(month)), ...virt];
  const mInc = inc.filter((x) => x.date.startsWith(month));
  const extra = sum(mInc.map((x) => x.amount));
  const rec = salary + extra;
  const desp = sum(mExp.map((x) => x.amount));
  const saldo = rec - desp;
  const byCat = cats.map((c) => ({ ...c, spent: sum(mExp.filter((x) => x.category === c.name).map((x) => x.amount)) }));
  const byBank = banks.map((b) => ({ name: b.name, v: sum(mExp.filter((x) => x.bank === b.name).map((x) => x.amount)) })).filter((x) => x.v > 0);
  const antecipar = async (p: Inst) => {
    const future = Math.max(0, nAct(p) - Math.max(diffM(thisM, p.start_month) + 1, 0));
    if (!future) return alert("Não há parcelas futuras para antecipar.");
    const v = prompt(`Quantas das ${future} parcelas futuras você quer antecipar agora? (as últimas saem primeiro)`, String(future));
    const k = Math.min(future, Math.floor(Number(v)));
    if (!k || k < 1) return;
    const c = cardOf(p.card_id);
    const r = await supabase.from("expenses").insert({ date: today(), description: `Antecipação: ${p.description} (${k}x)`, category: p.category, bank: c?.bank ?? null, method: "Crédito", amount: (p.total / p.n) * k });
    if (r.error) return alert(r.error.message);
    await run(supabase.from("installments").update({ paid_ahead: p.paid_ahead + k }).eq("id", p.id));
  };
  const invoice = (c: Card) => {
    const end = day(month, c.closing_day), start = day(addM(month, -1), c.closing_day);
    const loose = sum(exp.filter((x) => x.card_id === c.id && x.date > start && x.date <= end).map((x) => x.amount));
    const parc = sum(virt.filter((x) => x.card_id === c.id).map((x) => x.amount));
    return { total: loose + parc, close: end, due: day(c.due_day > c.closing_day ? month : addM(month, 1), c.due_day) };
  };
  const tabs: [string, string, LucideIcon][] = [["dash", "Resumo", LayoutDashboard], ["exp", "Despesas", TrendingDown], ["inc", "Receitas", TrendingUp], ["fat", "Faturas", CreditCard], ["cfg", "Ajustes", Settings]];

  return (
    <div className="min-h-screen bg-slate-50 pb-28 text-slate-900 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <h1 className="flex items-center gap-2 text-lg font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent-600 to-accent-500 text-xs text-white">R$</span><span className="hidden sm:inline">Minhas finanças</span></h1>
          <nav className="ml-6 hidden gap-1 rounded-2xl bg-slate-100 p-1 md:flex">
            {tabs.map(([k, l, Icon]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium transition ${tab === k ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}><Icon size={16} className={tab === k ? "text-accent-600" : ""} />{l}</button>
            ))}
          </nav>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={inp + " ml-auto !w-auto"} aria-label="Mês" />
          <button onClick={toggleHide} aria-label={hide ? "Mostrar valores" : "Ocultar valores"} title={hide ? "Mostrar valores" : "Ocultar valores"} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">{hide ? <EyeOff size={18} /> : <Eye size={18} />}</button><ThemeToggle /><button onClick={() => supabase.auth.signOut()} aria-label="Sair" title="Sair" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
        {tab === "dash" && (<>
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent-800 via-accent-700 to-accent-500 p-5 text-white shadow-lg shadow-accent-700/20"><span className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full bg-white/10" /><span className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/5" />
            <div className="flex items-center gap-2"><p className="text-sm text-accent-200">Saldo do mês</p><button onClick={toggleHide} aria-label={hide ? "Mostrar valores" : "Ocultar valores"} className="rounded-lg p-1 text-accent-100 hover:bg-white/10">{hide ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
            <p className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">{brl(saldo)}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div><p className="text-accent-200">↑ Receitas</p><p className="font-semibold">{brl(rec)}</p></div>
              <div><p className="text-accent-200">↓ Despesas</p><p className="font-semibold">{brl(desp)}</p></div>
              <div><p className="text-accent-200">Poupado</p><p className="font-semibold">{hide ? "•••" : rec > 0 ? Math.round((saldo / rec) * 100) + "%" : "-"}</p></div>
            </div>
          </section>
          <div className="grid gap-4 md:grid-cols-3">
            <section className={card + " md:col-span-2"}>
              <h2 className="mb-3 text-sm font-semibold">Por categoria</h2>
              <ul className="flex flex-col gap-4">
                {byCat.filter((c) => c.spent > 0 || c.budget > 0).sort((a, b) => b.spent - a.spent).map((c) => {
                  const p = c.budget > 0 ? c.spent / c.budget : 0;
                  const col = p > 1 ? "bg-rose-500" : p >= 0.8 ? "bg-amber-400" : "bg-accent-500";
                  return (
                    <li key={c.id} className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-lg">{catIcon(c.name)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-2 text-sm"><span className="truncate font-medium">{c.name}</span><span className="shrink-0 text-slate-700">{brl(c.spent)}{c.budget > 0 && <span className="text-slate-400"> / {brl(c.budget)}</span>}</span></div>
                        {c.budget > 0 && <div className="mt-1.5 h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${col}`} style={{ width: Math.min(p, 1) * 100 + "%" }} /></div>}
                      </div>
                    </li>
                  );
                })}
                {!desp && <p className="text-sm text-slate-500">Nenhuma despesa neste mês. Lance a primeira na aba Despesas.</p>}
              </ul>
            </section>
            <section className={card}>
              <h2 className="mb-3 text-sm font-semibold">Por banco</h2>
              <ul className="flex flex-col gap-3 text-sm">
                {byBank.map((b) => <li key={b.name} className="flex items-center gap-3"><BankLogo name={b.name} /><span className="flex-1 truncate">{b.name}</span><span className="font-medium">{brl(b.v)}</span></li>)}
                {!byBank.length && <p className="text-slate-500">Sem gastos neste mês.</p>}
              </ul>
            </section>
          </div>
        </>)}

        {tab === "exp" && (<>
          <form onSubmit={add("expenses")} className={card + " grid gap-2 sm:grid-cols-6"}>
            <input name="date" type="date" required defaultValue={today()} className={inp} />
            <input name="description" required placeholder="Descrição" className={inp + " sm:col-span-2"} />
            <select name="category" required className={inp}>{cats.map((c) => <option key={c.id} value={c.name}>{catIcon(c.name)} {c.name}</option>)}</select>
            <select name="bank" required className={inp}>{banks.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}</select>
            <select name="method" required className={inp}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
            <input name="amount" type="number" step="0.01" min="0" required placeholder="Valor (R$)" className={inp + " sm:col-span-2"} />
            <select name="card_id" className={inp + " sm:col-span-2"}><option value="">Cartão (opcional)</option>{cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <button className={btn + " sm:col-span-2"}>Adicionar despesa</button>
          </form>
          <ul className={card + " divide-y divide-slate-100"}>
            {mExp.map((x) => <Row key={x.id} icon={catIcon(x.category)} badge={<BankLogo name={x.bank} />} title={x.description} sub={`${x.date.split("-").reverse().join("/")} · ${x.category} · ${x.bank} · ${x.method}`} amount={x.amount} onDel={() => (x.id.startsWith("inst-") ? alert("Parcela automática: gerencie na aba Faturas.") : del("expenses", x.id))} />)}
            {!mExp.length && <p className="py-2 text-sm text-slate-500">Nenhuma despesa neste mês.</p>}
          </ul>
        </>)}

        {tab === "inc" && (<>
          <p className="text-sm text-slate-600">Salário fixo: <b>{brl(salary)}</b> (altere em Ajustes). Lance aqui só as rendas extras.</p>
          <form onSubmit={add("incomes")} className={card + " grid gap-2 sm:grid-cols-5"}>
            <input name="date" type="date" required defaultValue={today()} className={inp} />
            <select name="type" required className={inp}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <input name="description" placeholder="Descrição" className={inp} />
            <input name="amount" type="number" step="0.01" min="0" required placeholder="Valor (R$)" className={inp} />
            <button className={btn}>Adicionar</button>
          </form>
          <ul className={card + " divide-y divide-slate-100"}>
            {mInc.map((x) => <Row key={x.id} icon="💰" title={x.type} sub={`${x.date.split("-").reverse().join("/")} · ${x.description ?? ""}`} amount={x.amount} onDel={() => del("incomes", x.id)} />)}
            {!mInc.length && <p className="py-2 text-sm text-slate-500">Nenhuma receita extra neste mês.</p>}
          </ul>
        </>)}

        {tab === "fat" && (<>
          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold">Cartões · faturas de {month.split("-").reverse().join("/")}</h2>
            <ul className="flex flex-col gap-2">
              {cards.map((c) => { const v = invoice(c); return (
                <li key={c.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  {c.bank ? <BankLogo name={c.bank} /> : <span>💳</span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="text-xs text-slate-500">Fecha {dmy(v.close)} · Vence {dmy(v.due)}</p>
                  </div>
                  <span className="text-sm font-bold">{brl(v.total)}</span>
                  <button onClick={() => del("cards", c.id)} aria-label="Excluir" className="px-1 text-slate-300 hover:text-rose-600">✕</button>
                </li>); })}
              {!cards.length && <p className="text-sm text-slate-500">Cadastre seu primeiro cartão abaixo.</p>}
            </ul>
            <form onSubmit={add("cards")} className="mt-3 grid gap-2 sm:grid-cols-5">
              <input name="name" required placeholder="Nome (ex.: Nubank)" className={inp + " sm:col-span-2"} />
              <select name="bank" className={inp}><option value="">Banco</option>{banks.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}</select>
              <input name="closing_day" type="number" min="1" max="31" required placeholder="Dia que fecha" className={inp} />
              <input name="due_day" type="number" min="1" max="31" required placeholder="Dia que vence" className={inp} />
              <button className={btn + " sm:col-span-5"}>Adicionar cartão</button>
            </form>
          </section>
          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold">Parcelamentos</h2>
            <form onSubmit={add("installments")} className="grid gap-2 sm:grid-cols-6">
              <input name="description" required placeholder="Descrição (ex.: Fatura em 6x)" className={inp + " sm:col-span-2"} />
              <input name="total" type="number" step="0.01" min="0.01" required placeholder="Valor total" className={inp} />
              <input name="n" type="number" min="1" max="60" required placeholder="Nº de parcelas" className={inp} />
              <select name="card_id" className={inp}><option value="">Cartão</option>{cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select name="category" required className={inp}>{cats.map((c) => <option key={c.id} value={c.name}>{catIcon(c.name)} {c.name}</option>)}</select>
              <label className="text-xs text-slate-500 sm:col-span-3">1ª parcela na fatura de<input name="start_month" type="month" required defaultValue={thisM} className={inp + " mt-1"} /></label>
              <button className={btn + " sm:col-span-3 sm:self-end"}>Adicionar parcelamento</button>
            </form>
            <ul className="mt-3 divide-y divide-slate-100">
              {inst.map((p) => { const na = nAct(p); const done = Math.min(Math.max(diffM(thisM, p.start_month) + 1, 0), na); const c = cardOf(p.card_id); return (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-lg">{catIcon(p.category)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.description}</p>
                    <p className="truncate text-xs text-slate-500">{c?.name ?? "Sem cartão"} · {done}/{na} · {brl(p.total / p.n)}/mês{p.paid_ahead > 0 && ` · ${p.paid_ahead} antecipada(s)`}</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-accent-500" style={{ width: (done / na) * 100 + "%" }} /></div>
                  </div>
                  {done < na ? <button onClick={() => antecipar(p)} className="rounded-lg bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-600">Antecipar</button> : <span className="text-xs font-medium text-emerald-600">Quitado</span>}
                  <button onClick={() => del("installments", p.id)} aria-label="Excluir" className="px-1 text-slate-300 hover:text-rose-600">✕</button>
                </li>); })}
              {!inst.length && <p className="py-2 text-sm text-slate-500">Nenhum parcelamento cadastrado.</p>}
            </ul>
          </section>
        </>)}

        {tab === "cfg" && (<>
          <form className={card + " flex items-end gap-2"} onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("salary"); run(supabase.from("settings").upsert({ user_id: session.user.id, salary: v })); }}>
            <label className="flex-1 text-sm">Salário mensal (líquido)<input name="salary" type="number" step="0.01" min="0" key={salary} defaultValue={salary} className={inp + " mt-1"} /></label>
            <button className={btn}>Salvar</button>
          </form>
          <section className={card}>
            <h2 className="mb-1 text-sm font-semibold">Categorias e orçamento mensal</h2>
            <ul className="divide-y divide-slate-100">
              {cats.map((c) => (
                <li key={c.id + c.budget} className="flex items-center gap-2 py-1.5">
                  <span className="flex flex-1 items-center gap-2 truncate text-sm"><span>{catIcon(c.name)}</span>{c.name}</span>
                  <input type="number" min="0" step="10" defaultValue={c.budget || ""} placeholder="R$ 0" aria-label={`Orçamento de ${c.name}`}
                    onBlur={(e) => Number(e.target.value) !== c.budget && run(supabase.from("categories").update({ budget: e.target.value || 0 }).eq("id", c.id))} className={inp + " !w-28"} />
                  <button onClick={() => del("categories", c.id)} aria-label="Excluir" className="px-1 text-slate-400 hover:text-red-700">✕</button>
                </li>
              ))}
            </ul>
            <form onSubmit={add("categories")} className="mt-2 flex gap-2"><input name="name" required placeholder="Nova categoria" className={inp} /><button className={btn}>Adicionar</button></form>
          </section>
          <section className={card}>
            <h2 className="mb-1 text-sm font-semibold">Bancos</h2>
            <ul className="divide-y divide-slate-100">
              {banks.map((b) => (
                <li key={b.id} className="flex items-center py-1.5"><span className="flex flex-1 items-center gap-2 text-sm"><BankLogo name={b.name} />{b.name}</span>
                  <button onClick={() => del("banks", b.id)} aria-label="Excluir" className="px-1 text-slate-400 hover:text-red-700">✕</button></li>
              ))}
            </ul>
            <form onSubmit={add("banks")} className="mt-2 flex gap-2"><input name="name" required placeholder="Novo banco" className={inp} /><button className={btn}>Adicionar</button></form>
          </section>
        </>)}
      </main>

      <nav className="fixed inset-x-3 bottom-3 z-20 grid grid-cols-5 gap-1 rounded-2xl border border-slate-200 bg-surface/90 p-1.5 shadow-lg backdrop-blur md:hidden">
        {tabs.map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition ${tab === k ? "bg-accent-50 text-accent-600" : "text-slate-500"}`}><Icon size={20} />{l}</button>
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
  if (session === undefined) return <p className="p-6 text-sm text-slate-500">Carregando…</p>;
  return session ? <App key={session.user.id} session={session} /> : <Auth />;
}