-- ============ Nota fiscal (Focus NFe) ============
-- Fase 1: NF de remessa a partir de uma saída (ex.: envio para o Full).
-- Só administrador vê e mexe. O token da Focus fica numa tabela sem nenhuma
-- política de leitura: o site nunca lê o token, só a função emitir (Edge Function).

create or replace function nfe_admin() returns boolean language sql stable security definer set search_path to 'public' as
$$ select exists(select 1 from perfis where user_id = auth.uid() and papel = 'admin') $$;

-- Empresa emitente de cada conta (CNPJ que emite a nota)
create table if not exists nfe_emitentes(
  id bigserial primary key,
  conta_id bigint not null unique references contas(id),
  cnpj text not null, razao_social text not null, ie text, uf text,
  regime text not null default 'simples' check (regime in ('simples','simples_excesso','normal')),
  ambiente text not null default 'homologacao' check (ambiente in ('homologacao','producao')),
  natureza_remessa text not null default 'Remessa para depósito',
  cfop_interno text, cfop_interestadual text,
  icms_cst text, pis_cst text default '49', cofins_cst text default '49',
  info_complementar text,
  tem_token_homolog boolean not null default false, tem_token_prod boolean not null default false,
  alterado_por uuid default auth.uid(), alterado_em timestamptz not null default now());

-- Tokens da Focus (sem política = ninguém lê pelo site)
create table if not exists nfe_tokens(
  emitente_id bigint primary key references nfe_emitentes(id) on delete cascade,
  token_homolog text, token_prod text, alterado_em timestamptz not null default now());

-- Destinatários salvos (ex.: centros de distribuição do Full)
create table if not exists nfe_destinatarios(
  id bigserial primary key, apelido text not null,
  nome text not null, cnpj text not null, ie text,
  logradouro text not null, numero text not null, complemento text, bairro text not null,
  municipio text not null, uf text not null, cep text not null,
  ativo boolean not null default true, criado_em timestamptz not null default now());

-- Dados fiscais dos produtos
create table if not exists produtos_fiscal(
  produto_id bigint primary key references produtos(id) on delete cascade,
  ncm text, cest text, origem text not null default '0', unidade text not null default 'UN',
  alterado_em timestamptz not null default now());

-- Notas emitidas
create table if not exists nfe_notas(
  id bigserial primary key,
  ref text not null unique,
  saida_id bigint references saidas(id),
  emitente_id bigint not null references nfe_emitentes(id),
  destinatario_id bigint references nfe_destinatarios(id),
  tipo text not null default 'remessa',
  ambiente text not null,
  status text not null default 'enviando',
  numero text, serie text, chave text,
  danfe_url text, xml_url text,
  mensagem text, valor_total numeric(14,2),
  payload jsonb, resposta jsonb,
  criado_por uuid default auth.uid(), criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  cancelado_em timestamptz, cancelado_motivo text);
create index if not exists nfe_notas_saida on nfe_notas(saida_id);

alter table nfe_emitentes enable row level security;
alter table nfe_tokens enable row level security;
alter table nfe_destinatarios enable row level security;
alter table produtos_fiscal enable row level security;
alter table nfe_notas enable row level security;

drop policy if exists ler on nfe_emitentes;
drop policy if exists ler on nfe_destinatarios;
drop policy if exists ler on produtos_fiscal;
drop policy if exists ler on nfe_notas;
create policy ler on nfe_emitentes for select to authenticated using (nfe_admin());
create policy ler on nfe_destinatarios for select to authenticated using (nfe_admin());
create policy ler on produtos_fiscal for select to authenticated using (nfe_admin());
create policy ler on nfe_notas for select to authenticated using (nfe_admin());

-- ---------- gravação (sempre por função, só admin) ----------
create or replace function nfe_salvar_emitente(p jsonb) returns bigint language plpgsql security definer set search_path to 'public' as $$
declare v_id bigint; v_cnpj text := regexp_replace(coalesce(p->>'cnpj',''),'\D','','g');
begin
  if not nfe_admin() then raise exception 'Seu acesso não permite esta ação.'; end if;
  if length(v_cnpj) <> 14 then raise exception 'CNPJ do emitente inválido.'; end if;
  if coalesce(p->>'razao_social','') = '' then raise exception 'Informe a razão social.'; end if;
  insert into nfe_emitentes(conta_id,cnpj,razao_social,ie,uf,regime,ambiente,natureza_remessa,cfop_interno,cfop_interestadual,icms_cst,pis_cst,cofins_cst,info_complementar)
  values((p->>'conta_id')::bigint,v_cnpj,p->>'razao_social',nullif(p->>'ie',''),upper(nullif(p->>'uf','')),coalesce(nullif(p->>'regime',''),'simples'),
    coalesce(nullif(p->>'ambiente',''),'homologacao'),coalesce(nullif(p->>'natureza_remessa',''),'Remessa para depósito'),
    nullif(p->>'cfop_interno',''),nullif(p->>'cfop_interestadual',''),nullif(p->>'icms_cst',''),nullif(p->>'pis_cst',''),nullif(p->>'cofins_cst',''),nullif(p->>'info_complementar',''))
  on conflict (conta_id) do update set cnpj=excluded.cnpj,razao_social=excluded.razao_social,ie=excluded.ie,uf=excluded.uf,regime=excluded.regime,
    ambiente=excluded.ambiente,natureza_remessa=excluded.natureza_remessa,cfop_interno=excluded.cfop_interno,cfop_interestadual=excluded.cfop_interestadual,
    icms_cst=excluded.icms_cst,pis_cst=excluded.pis_cst,cofins_cst=excluded.cofins_cst,info_complementar=excluded.info_complementar,
    alterado_por=auth.uid(),alterado_em=now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function nfe_salvar_token(p_emitente bigint, p_ambiente text, p_token text) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not nfe_admin() then raise exception 'Seu acesso não permite esta ação.'; end if;
  insert into nfe_tokens(emitente_id) values(p_emitente) on conflict do nothing;
  if p_ambiente = 'producao' then
    update nfe_tokens set token_prod=nullif(trim(p_token),''),alterado_em=now() where emitente_id=p_emitente;
    update nfe_emitentes set tem_token_prod = nullif(trim(p_token),'') is not null where id=p_emitente;
  else
    update nfe_tokens set token_homolog=nullif(trim(p_token),''),alterado_em=now() where emitente_id=p_emitente;
    update nfe_emitentes set tem_token_homolog = nullif(trim(p_token),'') is not null where id=p_emitente;
  end if;
end $$;

create or replace function nfe_salvar_destinatario(p jsonb) returns bigint language plpgsql security definer set search_path to 'public' as $$
declare v_id bigint := nullif(p->>'id','')::bigint;
begin
  if not nfe_admin() then raise exception 'Seu acesso não permite esta ação.'; end if;
  if v_id is null then
    insert into nfe_destinatarios(apelido,nome,cnpj,ie,logradouro,numero,complemento,bairro,municipio,uf,cep)
    values(p->>'apelido',p->>'nome',regexp_replace(p->>'cnpj','\D','','g'),nullif(p->>'ie',''),p->>'logradouro',p->>'numero',nullif(p->>'complemento',''),
      p->>'bairro',p->>'municipio',upper(p->>'uf'),regexp_replace(p->>'cep','\D','','g')) returning id into v_id;
  else
    update nfe_destinatarios set apelido=p->>'apelido',nome=p->>'nome',cnpj=regexp_replace(p->>'cnpj','\D','','g'),ie=nullif(p->>'ie',''),
      logradouro=p->>'logradouro',numero=p->>'numero',complemento=nullif(p->>'complemento',''),bairro=p->>'bairro',municipio=p->>'municipio',
      uf=upper(p->>'uf'),cep=regexp_replace(p->>'cep','\D','','g') where id=v_id;
  end if;
  return v_id;
end $$;

create or replace function nfe_salvar_fiscal_produto(p_produto bigint, p_ncm text, p_cest text, p_origem text, p_unidade text) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not nfe_admin() then raise exception 'Seu acesso não permite esta ação.'; end if;
  insert into produtos_fiscal(produto_id,ncm,cest,origem,unidade)
  values(p_produto,nullif(regexp_replace(coalesce(p_ncm,''),'\D','','g'),''),nullif(regexp_replace(coalesce(p_cest,''),'\D','','g'),''),coalesce(nullif(p_origem,''),'0'),upper(coalesce(nullif(p_unidade,''),'UN')))
  on conflict (produto_id) do update set ncm=excluded.ncm,cest=excluded.cest,origem=excluded.origem,unidade=excluded.unidade,alterado_em=now();
end $$;
