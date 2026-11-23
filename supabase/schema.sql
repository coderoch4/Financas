-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run
create table settings (
  user_id uuid primary key references auth.users on delete cascade,
  salary numeric not null default 0
);
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null, budget numeric not null default 0
);
create table banks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null
);
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null, description text, category text, bank text, method text,
  amount numeric not null check (amount >= 0)
);
create table incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null, type text, description text,
  amount numeric not null check (amount >= 0)
);
create index on expenses (user_id, date);
create index on incomes (user_id, date);

-- Segurança: cada usuário só enxerga e altera os próprios dados
do $$ declare t text; begin
  foreach t in array array['settings','categories','banks','expenses','incomes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "own_%1$s" on %1$I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Ao criar uma conta, já cria categorias e bancos padrão para o usuário
create function public.seed_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into settings (user_id) values (new.id);
  insert into categories (user_id, name) select new.id, unnest(array[
    'Moradia','Contas da casa','Internet e telefone','Mercado','Restaurantes e delivery','Uber / 99',
    'Transporte público','Combustível','Carro','Saúde','Farmácia','Educação','Lazer','Hobby','Viagens',
    'Assinaturas','Vestuário','Beleza e cuidados','Pets','Presentes e doações','Impostos e taxas',
    'Investimentos','Dívidas e parcelas','Outros']);
  insert into banks (user_id, name) select new.id, unnest(array[
    'Nubank','Itaú','Bradesco','Banco do Brasil','Caixa','Santander','Inter','C6 Bank','BTG Pactual',
    'PicPay','Mercado Pago','XP','Sicoob','Banrisul','Neon','Dinheiro (espécie)','Vale (VR/VA)']);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.seed_user();
