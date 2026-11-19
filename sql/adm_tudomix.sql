-- ============ ADM TudoMix ============
-- Cadastros
create table if not exists adm_empresas(id bigserial primary key, nome text not null, cnpj text, ativa boolean not null default true, criado_em timestamptz not null default now());
create table if not exists adm_unidades(id bigserial primary key, empresa_id bigint not null references adm_empresas(id), nome text not null, ativa boolean not null default true, criado_em timestamptz not null default now());
create table if not exists adm_funcionarios(id bigserial primary key, nome text not null, empresa_id bigint references adm_empresas(id), unidade_id bigint references adm_unidades(id), user_id uuid, ativo boolean not null default true, obs text, criado_em timestamptz not null default now());

-- Acessos dentro da página (Iago = master via e04_dono())
create table if not exists adm_acesso(id bigserial primary key, email text not null unique, nome text not null, user_id uuid unique,
  empresas bigint[], unidades bigint[], ativo boolean not null default true, criado_em timestamptz not null default now(), alterado_em timestamptz);

-- Lançamentos
create table if not exists adm_notas(
  id bigserial primary key, empresa_id bigint not null references adm_empresas(id), unidade_id bigint references adm_unidades(id),
  fornecedor text not null, fornecedor_cnpj text, numero text not null, serie text, chave text,
  emissao date, recebimento date, valor_total numeric(14,2) not null default 0,
  situacao_sistema text not null default 'nao_lancada' check (situacao_sistema in ('nao_lancada','lancada','conferida')),
  data_operacao date not null default current_date, obs text,
  pendente_doc boolean not null default false, status text not null default 'aberto' check (status in ('aberto','enviado','devolvido','respondido','aprovado','cancelado')),
  devolucao_motivo text, fechamento_id bigint, enviado_em timestamptz,
  lancado_por uuid default auth.uid(), lancado_em timestamptz not null default now(), alterado_em timestamptz);

create table if not exists adm_movs(
  id bigserial primary key, tipo text not null check (tipo in ('entrada','saida','transferencia','pagamento')),
  empresa_id bigint not null references adm_empresas(id), unidade_id bigint references adm_unidades(id), unidade_destino_id bigint references adm_unidades(id),
  data_operacao date not null default current_date, descricao text not null, categoria text, valor numeric(14,2) not null default 0, responsavel text,
  favorecido text, vencimento date, pago_em date, conta_origem text, nota_id bigint references adm_notas(id), obs text,
  pendente_doc boolean not null default false, status text not null default 'aberto' check (status in ('aberto','enviado','devolvido','respondido','aprovado','cancelado')),
  devolucao_motivo text, fechamento_id bigint, enviado_em timestamptz,
  lancado_por uuid default auth.uid(), lancado_em timestamptz not null default now(), alterado_em timestamptz);

create table if not exists adm_ponto(
  id bigserial primary key, funcionario_id bigint not null references adm_funcionarios(id),
  empresa_id bigint not null references adm_empresas(id), unidade_id bigint references adm_unidades(id),
  tipo text not null default 'marcacao' check (tipo in ('marcacao','espelho')),
  data_operacao date not null default current_date, periodo_ate date,
  entrada time, saida_intervalo time, retorno time, saida time, obs text,
  correcao_justificativa text, correcao_status text check (correcao_status in ('pendente','aprovada','recusada')),
  pendente_doc boolean not null default false, status text not null default 'aberto' check (status in ('aberto','enviado','devolvido','respondido','aprovado','cancelado')),
  devolucao_motivo text, fechamento_id bigint, enviado_em timestamptz,
  lancado_por uuid default auth.uid(), lancado_em timestamptz not null default now(), alterado_em timestamptz);

create table if not exists adm_docs(
  id bigserial primary key, ref_tipo text not null check (ref_tipo in ('nota','mov','ponto','fechamento','pendencia')), ref_id bigint not null,
  empresa_id bigint references adm_empresas(id), unidade_id bigint references adm_unidades(id),
  tipo text not null check (tipo in ('arquivo','drive')), categoria text, nome text not null, caminho text, url text, tamanho bigint,
  removido boolean not null default false, criado_por uuid default auth.uid(), criado_em timestamptz not null default now());
create index if not exists adm_docs_ref on adm_docs(ref_tipo, ref_id);

create table if not exists adm_dias(empresa_id bigint not null references adm_empresas(id), unidade_id bigint not null default 0, data date not null,
  sem_movimentacao boolean not null default true, confirmado_por uuid default auth.uid(), confirmado_em timestamptz not null default now(),
  primary key(empresa_id, unidade_id, data));

create table if not exists adm_fechamentos(
  id bigserial primary key, tipo text not null default 'semanal' check (tipo in ('diario','semanal')),
  empresa_id bigint not null references adm_empresas(id), unidade_id bigint references adm_unidades(id),
  de date not null, ate date not null, status text not null default 'rascunho' check (status in ('rascunho','enviado','devolvido','aprovado')),
  obs_juliana text, obs_gestor text, resumo jsonb,
  gerado_por uuid default auth.uid(), gerado_em timestamptz not null default now(),
  enviado_por uuid, enviado_em timestamptz, conferido_por uuid, conferido_em timestamptz);

create table if not exists adm_pendencias(
  id bigserial primary key, origem text not null default 'rotina' check (origem in ('auditoria','rotina','devolucao','ponto','sistema')),
  ref_tipo text, ref_id bigint, empresa_id bigint references adm_empresas(id), unidade_id bigint references adm_unidades(id),
  titulo text not null, motivo text, acao text, responsavel text not null default 'juliana' check (responsavel in ('juliana','iago')),
  prazo date, status text not null default 'aberta' check (status in ('aberta','respondida','resolvida','cancelada')),
  resposta text, respondido_em timestamptz, drive_url text, arquivo_nome text, pasta text,
  criado_por uuid default auth.uid(), criado_em timestamptz not null default now(), resolvido_por uuid, resolvido_em timestamptz);

create table if not exists adm_historico(id bigserial primary key, ref_tipo text not null, ref_id bigint not null, campo text, antes text, depois text,
  justificativa text, user_id uuid default auth.uid(), em timestamptz not null default now());
create index if not exists adm_hist_ref on adm_historico(ref_tipo, ref_id);

create table if not exists adm_auditoria(
  id bigserial primary key, nome text not null, link text, pasta text, tipo_doc text, empresa text, unidade text, data_ref date,
  situacao text not null default 'A confirmar com Juliana', problema text, acao text, responsavel text, ref_tipo text, ref_id bigint,
  criado_em timestamptz not null default now());

-- ============ Funções de permissão ============
create or replace function adm_master() returns boolean language sql stable security definer set search_path to 'public' as
$$ select coalesce(public.e04_dono(),false) $$;
create or replace function adm_eu() returns adm_acesso language sql stable security definer set search_path to 'public' as
$$ select a from public.adm_acesso a where a.user_id=auth.uid() and a.ativo limit 1 $$;
create or replace function adm_operador() returns boolean language sql stable security definer set search_path to 'public' as
$$ select exists(select 1 from public.adm_acesso a where a.user_id=auth.uid() and a.ativo) $$;
create or replace function adm_pode(p_emp bigint, p_uni bigint) returns boolean language sql stable security definer set search_path to 'public' as
$$ select public.adm_master() or exists(select 1 from public.adm_acesso a where a.user_id=auth.uid() and a.ativo
   and (a.empresas is null or cardinality(a.empresas)=0 or p_emp = any(a.empresas))
   and (a.unidades is null or cardinality(a.unidades)=0 or p_uni is null or p_uni = any(a.unidades))) $$;
create or replace function adm_acessa() returns boolean language sql stable security definer set search_path to 'public' as
$$ select public.adm_master() or public.adm_operador() $$;

-- ============ RLS (somente leitura direta; toda gravação via funções) ============
do $$ declare t text; begin
  foreach t in array array['adm_empresas','adm_unidades','adm_funcionarios','adm_acesso','adm_notas','adm_movs','adm_ponto','adm_docs','adm_dias','adm_fechamentos','adm_pendencias','adm_historico','adm_auditoria'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
    execute format('revoke insert, update, delete, truncate on %I from authenticated', t);
    execute format('drop policy if exists ler on %I', t);
  end loop; end $$;
create policy ler on adm_empresas for select to authenticated using (adm_master() or (adm_operador() and adm_pode(id,null)));
create policy ler on adm_unidades for select to authenticated using (adm_master() or (adm_operador() and adm_pode(empresa_id,id)));
create policy ler on adm_funcionarios for select to authenticated using (adm_master() or (adm_operador() and adm_pode(empresa_id,unidade_id)));
create policy ler on adm_acesso for select to authenticated using (adm_master() or user_id=auth.uid());
create policy ler on adm_notas for select to authenticated using (adm_pode(empresa_id,unidade_id));
create policy ler on adm_movs for select to authenticated using (adm_pode(empresa_id,unidade_id));
create policy ler on adm_ponto for select to authenticated using (adm_pode(empresa_id,unidade_id));
create policy ler on adm_docs for select to authenticated using (adm_acessa() and (empresa_id is null or adm_pode(empresa_id,unidade_id)));
create policy ler on adm_dias for select to authenticated using (adm_pode(empresa_id,nullif(unidade_id,0)));
create policy ler on adm_fechamentos for select to authenticated using (adm_pode(empresa_id,unidade_id));
create policy ler on adm_pendencias for select to authenticated using (adm_acessa() and (empresa_id is null or adm_pode(empresa_id,unidade_id)));
create policy ler on adm_historico for select to authenticated using (adm_acessa());
create policy ler on adm_auditoria for select to authenticated using (adm_acessa());

-- ============ Armazenamento privado dos anexos ============
insert into storage.buckets(id,name,public) values ('adm','adm',false) on conflict (id) do update set public=false;
drop policy if exists "adm gravar" on storage.objects;
drop policy if exists "adm ler" on storage.objects;
create policy "adm gravar" on storage.objects for insert to authenticated with check (bucket_id='adm' and public.adm_acessa());
create policy "adm ler" on storage.objects for select to authenticated using (bucket_id='adm' and (
  public.adm_master() or exists(select 1 from public.adm_docs d where d.caminho=objects.name and not d.removido and public.adm_operador() and public.adm_pode(d.empresa_id,d.unidade_id))));

-- ============ Perfis: papel 'adm' (só a página ADM) ============
create or replace function public.definir_papel(p_user uuid, p_papel text) returns void language plpgsql security definer set search_path to 'public' as $function$
begin
 if not eh_admin() then raise exception 'Seu acesso não permite esta ação.'; end if;
 if p_user=auth.uid() and coalesce(p_papel,'')<>'admin' then raise exception 'Você não pode tirar o seu próprio acesso de administrador.'; end if;
 if nullif(p_papel,'') is not null and p_papel not in ('admin','estoque','socio','cliente','e04','adm') then raise exception 'Acesso inválido.'; end if;
 update perfis set papel=nullif(p_papel,'') where user_id=p_user;
end $function$;

create or replace function public.novo_usuario() returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
insert into public.perfis(user_id,nome,email,papel)
values(new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), new.email,
case when lower(new.email) in ('iagobrito@tudomixatacado.com') then 'admin' end)
on conflict (user_id) do nothing;
if exists(select 1 from public.e19_convites where lower(email) = lower(new.email) and ativo) then
update public.e19_convites set user_id = new.id where lower(email) = lower(new.email);
update public.perfis set papel = 'e19', nome = coalesce((select nome from public.e19_convites where lower(email) = lower(new.email)), nome)
where user_id = new.id and papel is null;
end if;
if exists(select 1 from public.adm_acesso where lower(email) = lower(new.email) and ativo) then
update public.adm_acesso set user_id = new.id where lower(email) = lower(new.email);
update public.perfis set papel = 'adm', nome = coalesce((select nome from public.adm_acesso where lower(email) = lower(new.email)), nome)
where user_id = new.id and papel is null;
end if;
return new;
end $function$;

-- ============ Utilitários ============
create or replace function adm_tabela(p_tipo text) returns text language sql immutable as
$$ select case p_tipo when 'nota' then 'adm_notas' when 'mov' then 'adm_movs' when 'ponto' then 'adm_ponto' end $$;

create or replace function adm_colunas(p_tipo text) returns text[] language sql immutable as $$ select case p_tipo
 when 'nota' then array['empresa_id','unidade_id','fornecedor','fornecedor_cnpj','numero','serie','chave','emissao','recebimento','valor_total','situacao_sistema','data_operacao','obs','pendente_doc']
 when 'mov' then array['tipo','empresa_id','unidade_id','unidade_destino_id','data_operacao','descricao','categoria','valor','responsavel','favorecido','vencimento','pago_em','conta_origem','nota_id','obs','pendente_doc']
 when 'ponto' then array['funcionario_id','empresa_id','unidade_id','tipo','data_operacao','periodo_ate','entrada','saida_intervalo','retorno','saida','obs','pendente_doc']
 end $$;

create or replace function adm_pessoas() returns table(user_id uuid, nome text, email text, master boolean) language sql stable security definer set search_path to 'public' as $$
 select p.user_id, coalesce(p.nome,p.email), p.email, (p.papel='admin' and lower(p.email)='iagobrito@tudomixatacado.com') from public.perfis p
 where public.adm_acessa() and (p.papel='adm' or p.user_id in (select a.user_id from public.adm_acesso a) or (p.papel='admin' and lower(p.email)='iagobrito@tudomixatacado.com')) $$;

create or replace function adm_fornecedores() returns table(nome text, cnpj text) language sql stable security definer set search_path to 'public' as $$
 select distinct on (lower(nome)) nome, cnpj from (
   select trim(fornecedor) nome, fornecedor_cnpj cnpj from public.notas where coalesce(trim(fornecedor),'')<>''
   union all select trim(fornecedor), fornecedor_cnpj from public.adm_notas where coalesce(trim(fornecedor),'')<>'') x
 where public.adm_acessa() order by lower(nome), cnpj nulls last $$;

-- Duplicidade de nota: mesma chave, ou mesmo número+série+fornecedor (CNPJ ou nome)
create or replace function adm_nota_duplicadas(p_id bigint, p_numero text, p_serie text, p_chave text, p_cnpj text, p_fornecedor text)
returns table(origem text, id bigint, numero text, serie text, fornecedor text, data date, valor numeric) language sql stable security definer set search_path to 'public' as $$
 with q as (select nullif(regexp_replace(coalesce(p_chave,''),'\D','','g'),'') ch, nullif(ltrim(regexp_replace(coalesce(p_numero,''),'\D','','g'),'0'),'') nu,
   coalesce(nullif(ltrim(regexp_replace(coalesce(p_serie,''),'\D','','g'),'0'),''),'') se, nullif(regexp_replace(coalesce(p_cnpj,''),'\D','','g'),'') cn, lower(trim(coalesce(p_fornecedor,''))) fo)
 select 'ADM'::text, n.id, n.numero, n.serie, n.fornecedor, n.recebimento, n.valor_total from public.adm_notas n, q
  where public.adm_acessa() and n.status<>'cancelado' and n.id is distinct from p_id and (
   (q.ch is not null and regexp_replace(coalesce(n.chave,''),'\D','','g')=q.ch) or
   (q.nu is not null and nullif(ltrim(regexp_replace(coalesce(n.numero,''),'\D','','g'),'0'),'')=q.nu and coalesce(nullif(ltrim(regexp_replace(coalesce(n.serie,''),'\D','','g'),'0'),''),'')=q.se
     and ((q.cn is not null and regexp_replace(coalesce(n.fornecedor_cnpj,''),'\D','','g')=q.cn) or (q.fo<>'' and lower(trim(n.fornecedor))=q.fo))))
 union all
 select 'Estoque', e.id, e.numero, e.serie, e.fornecedor, e.recebida_em, null::numeric from public.notas e, q
  where public.adm_acessa() and (
   (q.ch is not null and regexp_replace(coalesce(e.chave,''),'\D','','g')=q.ch) or
   (q.nu is not null and nullif(ltrim(regexp_replace(coalesce(e.numero,''),'\D','','g'),'0'),'')=q.nu
     and ((q.cn is not null and regexp_replace(coalesce(e.fornecedor_cnpj,''),'\D','','g')=q.cn) or (q.fo<>'' and lower(trim(e.fornecedor))=q.fo)))) $$;

-- ============ Gravação genérica com histórico ============
create or replace function adm_salvar(p_tipo text, p_id bigint, p_dados jsonb, p_justificativa text default null, p_confirmar_duplicada boolean default false)
returns bigint language plpgsql security definer set search_path to 'public' as $function$
declare t text := adm_tabela(p_tipo); cols text[] := adm_colunas(p_tipo); d jsonb := '{}'; k text; v_old jsonb; v_new jsonb; v_id bigint; lista text;
  v_emp bigint; v_uni bigint; travado boolean;
begin
 if t is null then raise exception 'Tipo inválido.'; end if;
 if not adm_acessa() then raise exception 'Seu acesso não permite esta ação.'; end if;
 foreach k in array cols loop if p_dados ? k then d := d || jsonb_build_object(k, p_dados->k); end if; end loop;
 lista := array_to_string(array(select quote_ident(c) from unnest(cols) c), ',');
 if p_id is not null then
   execute format('select to_jsonb(x) from %I x where id=$1 for update', t) into v_old using p_id;
   if v_old is null then raise exception 'Registro não encontrado.'; end if;
   if not adm_pode((v_old->>'empresa_id')::bigint, (v_old->>'unidade_id')::bigint) then raise exception 'Seu acesso não permite esta ação.'; end if;
   if v_old->>'status' = 'cancelado' then raise exception 'Este lançamento foi cancelado e não pode ser alterado.'; end if;
   if v_old->>'status' = 'aprovado' and not adm_master() then raise exception 'Lançamento já aprovado pelo gestor. Peça a correção ao Iago.'; end if;
   v_new := v_old || d;
 else
   v_new := d;
 end if;
 v_emp := (v_new->>'empresa_id')::bigint; v_uni := nullif(v_new->>'unidade_id','')::bigint;
 if v_emp is null then raise exception 'Escolha a empresa.'; end if;
 if not adm_pode(v_emp, v_uni) then raise exception 'Você não tem acesso a esta empresa/unidade.'; end if;
 if p_tipo='nota' then
   if coalesce(trim(v_new->>'fornecedor'),'')='' or coalesce(trim(v_new->>'numero'),'')='' then raise exception 'Informe fornecedor e número da nota.'; end if;
   if not p_confirmar_duplicada and exists(select 1 from adm_nota_duplicadas(p_id, v_new->>'numero', v_new->>'serie', v_new->>'chave', v_new->>'fornecedor_cnpj', v_new->>'fornecedor')) then
     raise exception 'POSSIVEL_DUPLICIDADE'; end if;
 elsif p_tipo='mov' then
   if coalesce(trim(v_new->>'descricao'),'')='' then raise exception 'Informe a descrição.'; end if;
   if (v_new->>'valor')::numeric <= 0 then raise exception 'Informe um valor maior que zero.'; end if;
   if v_new->>'tipo'='transferencia' and nullif(v_new->>'unidade_destino_id','') is null then raise exception 'Informe a unidade de destino da transferência.'; end if;
   if nullif(v_new->>'nota_id','') is not null then
     if not exists(select 1 from adm_notas n where n.id=(v_new->>'nota_id')::bigint and n.status<>'cancelado') then raise exception 'Nota vinculada não encontrada.'; end if;
     if v_new->>'tipo' not in ('saida','pagamento') then raise exception 'Só saídas e pagamentos podem ser vinculados a uma nota.'; end if;
   end if;
 elsif p_tipo='ponto' then
   if nullif(v_new->>'funcionario_id','') is null then raise exception 'Escolha o funcionário.'; end if;
 end if;

 if p_id is null then
   execute format('insert into %I (%s) select %s from jsonb_populate_record(null::%I, $1) returning id', t, lista, lista, t) into v_id using v_new;
   insert into adm_historico(ref_tipo, ref_id, campo, depois, justificativa) values (p_tipo, v_id, 'criado', null, nullif(p_justificativa,''));
   return v_id;
 end if;

 travado := (v_old->>'enviado_em') is not null;
 if travado and coalesce(trim(p_justificativa),'')='' then raise exception 'Este lançamento já foi enviado para conferência. Informe a justificativa da alteração.'; end if;
 foreach k in array cols loop
   if (v_old->k) is distinct from (v_new->k) and coalesce(v_old->>k,'') is distinct from coalesce(v_new->>k,'') then
     insert into adm_historico(ref_tipo, ref_id, campo, antes, depois, justificativa) values (p_tipo, p_id, k, v_old->>k, v_new->>k, nullif(p_justificativa,''));
   end if;
 end loop;
 execute format('update %I x set (%s) = (select %s from jsonb_populate_record(null::%I, $1)), alterado_em=now() where id=$2', t, lista, lista, t) using v_new, p_id;
 -- item devolvido e corrigido pela Juliana volta como "respondido"
 if v_old->>'status'='devolvido' and not adm_master() then
   execute format('update %I set status=''respondido'' where id=$1', t) using p_id;
 end if;
 return p_id;
end $function$;

create or replace function adm_cancelar(p_tipo text, p_id bigint, p_justificativa text) returns void language plpgsql security definer set search_path to 'public' as $function$
declare t text := adm_tabela(p_tipo); v_old jsonb;
begin
 if t is null then raise exception 'Tipo inválido.'; end if;
 if coalesce(trim(p_justificativa),'')='' then raise exception 'Informe o motivo do cancelamento.'; end if;
 execute format('select to_jsonb(x) from %I x where id=$1 for update', t) into v_old using p_id;
 if v_old is null then raise exception 'Registro não encontrado.'; end if;
 if not adm_pode((v_old->>'empresa_id')::bigint,(v_old->>'unidade_id')::bigint) then raise exception 'Seu acesso não permite esta ação.'; end if;
 if v_old->>'status'='aprovado' and not adm_master() then raise exception 'Lançamento já aprovado. Só o gestor pode cancelar.'; end if;
 if p_tipo='nota' and exists(select 1 from adm_movs m where m.nota_id=p_id and m.status<>'cancelado') then raise exception 'Esta nota tem pagamento vinculado. Cancele ou desvincule o pagamento antes.'; end if;
 execute format('update %I set status=''cancelado'', alterado_em=now() where id=$1', t) using p_id;
 insert into adm_historico(ref_tipo, ref_id, campo, antes, depois, justificativa) values (p_tipo, p_id, 'status', v_old->>'status', 'cancelado', p_justificativa);
end $function$;

-- Anexos (arquivo no bucket privado ou link do Drive)
create or replace function adm_anexar(p_ref_tipo text, p_ref_id bigint, p_tipo text, p_nome text, p_caminho text, p_url text, p_tamanho bigint, p_categoria text default null, p_justificativa text default null)
returns bigint language plpgsql security definer set search_path to 'public' as $function$
declare t text := adm_tabela(p_ref_tipo); v_old jsonb; v_emp bigint; v_uni bigint; v_id bigint;
begin
 if not adm_acessa() then raise exception 'Seu acesso não permite esta ação.'; end if;
 if p_tipo='drive' and (coalesce(p_url,'') !~* '^https://(drive|docs)\.google\.com/') then raise exception 'Cole um link do Google Drive (drive.google.com ou docs.google.com).'; end if;
 if p_tipo='arquivo' and coalesce(p_caminho,'')='' then raise exception 'Arquivo não enviado.'; end if;
 if t is not null then
   execute format('select to_jsonb(x) from %I x where id=$1', t) into v_old using p_ref_id;
   if v_old is null then raise exception 'Registro não encontrado.'; end if;
   v_emp := (v_old->>'empresa_id')::bigint; v_uni := (v_old->>'unidade_id')::bigint;
   if not adm_pode(v_emp, v_uni) then raise exception 'Seu acesso não permite esta ação.'; end if;
 elsif p_ref_tipo='fechamento' then select empresa_id, unidade_id into v_emp, v_uni from adm_fechamentos where id=p_ref_id;
 elsif p_ref_tipo='pendencia' then select empresa_id, unidade_id into v_emp, v_uni from adm_pendencias where id=p_ref_id;
 end if;
 insert into adm_docs(ref_tipo, ref_id, empresa_id, unidade_id, tipo, categoria, nome, caminho, url, tamanho)
   values (p_ref_tipo, p_ref_id, v_emp, v_uni, p_tipo, p_categoria, left(coalesce(nullif(p_nome,''),'Documento'),150), p_caminho, p_url, p_tamanho) returning id into v_id;
 if t is not null then
   execute format('update %I set pendente_doc=false where id=$1', t) using p_ref_id;
   if (v_old->>'enviado_em') is not null then
     insert into adm_historico(ref_tipo, ref_id, campo, antes, depois, justificativa) values (p_ref_tipo, p_ref_id, 'documento', null, 'Anexou: '||coalesce(p_nome,p_url), nullif(p_justificativa,''));
   end if;
 end if;
 return v_id;
end $function$;

create or replace function adm_remover_doc(p_id bigint, p_justificativa text) returns void language plpgsql security definer set search_path to 'public' as $function$
declare d adm_docs;
begin
 select * into d from adm_docs where id=p_id;
 if d.id is null then raise exception 'Documento não encontrado.'; end if;
 if not (adm_master() or (adm_operador() and adm_pode(d.empresa_id,d.unidade_id))) then raise exception 'Seu acesso não permite esta ação.'; end if;
 if coalesce(trim(p_justificativa),'')='' then raise exception 'Informe o motivo da remoção.'; end if;
 update adm_docs set removido=true where id=p_id;
 insert into adm_historico(ref_tipo, ref_id, campo, antes, depois, justificativa) values (d.ref_tipo, d.ref_id, 'documento', d.nome, 'removido', p_justificativa);
end $function$;

-- Dia sem movimentação
create or replace function adm_marcar_dia(p_emp bigint, p_uni bigint, p_data date, p_sem boolean) returns void language plpgsql security definer set search_path to 'public' as $function$
begin
 if not adm_pode(p_emp, p_uni) then raise exception 'Seu acesso não permite esta ação.'; end if;
 if p_sem then
   insert into adm_dias(empresa_id, unidade_id, data, sem_movimentacao) values (p_emp, coalesce(p_uni,0), p_data, true)
   on conflict (empresa_id, unidade_id, data) do update set sem_movimentacao=true, confirmado_por=auth.uid(), confirmado_em=now();
 else delete from adm_dias where empresa_id=p_emp and unidade_id=coalesce(p_uni,0) and data=p_data; end if;
end $function$;

-- Fechamento: gerar / enviar / conferir
create or replace function adm_gerar_fechamento(p_tipo text, p_emp bigint, p_uni bigint, p_de date, p_ate date) returns bigint language plpgsql security definer set search_path to 'public' as $function$
declare v_id bigint;
begin
 if not adm_pode(p_emp, p_uni) then raise exception 'Seu acesso não permite esta ação.'; end if;
 if p_ate < p_de then raise exception 'Período inválido.'; end if;
 select id into v_id from adm_fechamentos where empresa_id=p_emp and unidade_id is not distinct from p_uni and de=p_de and ate=p_ate and status<>'aprovado' order by id desc limit 1;
 if v_id is null then
   insert into adm_fechamentos(tipo, empresa_id, unidade_id, de, ate) values (coalesce(p_tipo,'semanal'), p_emp, p_uni, p_de, p_ate) returning id into v_id;
 end if;
 return v_id;
end $function$;

create or replace function adm_enviar_fechamento(p_id bigint, p_obs text, p_resumo jsonb) returns void language plpgsql security definer set search_path to 'public' as $function$
declare f adm_fechamentos; t text;
begin
 select * into f from adm_fechamentos where id=p_id for update;
 if f.id is null then raise exception 'Fechamento não encontrado.'; end if;
 if not adm_pode(f.empresa_id, f.unidade_id) then raise exception 'Seu acesso não permite esta ação.'; end if;
 if f.status='aprovado' then raise exception 'Fechamento já aprovado.'; end if;
 update adm_fechamentos set status='enviado', obs_juliana=p_obs, resumo=p_resumo, enviado_por=auth.uid(), enviado_em=now() where id=p_id;
 foreach t in array array['adm_notas','adm_movs','adm_ponto'] loop
   execute format('update %I set fechamento_id=$1, enviado_em=coalesce(enviado_em,now()), status=case when status in (''aberto'') then ''enviado'' else status end
     where empresa_id=$2 and ($3::bigint is null or unidade_id=$3) and data_operacao between $4 and $5 and status<>''cancelado''', t)
     using p_id, f.empresa_id, f.unidade_id, f.de, f.ate;
 end loop;
 insert into adm_historico(ref_tipo, ref_id, campo, depois, justificativa) values ('fechamento', p_id, 'status', 'enviado', nullif(p_obs,''));
end $function$;

create or replace function adm_devolver_item(p_tipo text, p_id bigint, p_motivo text, p_prazo date default null) returns bigint language plpgsql security definer set search_path to 'public' as $function$
declare t text := adm_tabela(p_tipo); v_old jsonb; v_p bigint; titulo text;
begin
 if not adm_master() then raise exception 'Só o gestor pode devolver itens.'; end if;
 if coalesce(trim(p_motivo),'')='' then raise exception 'Escreva o motivo da devolução.'; end if;
 execute format('select to_jsonb(x) from %I x where id=$1', t) into v_old using p_id;
 if v_old is null then raise exception 'Registro não encontrado.'; end if;
 execute format('update %I set status=''devolvido'', devolucao_motivo=$2 where id=$1', t) using p_id, p_motivo;
 titulo := case p_tipo when 'nota' then 'Nota '||coalesce(v_old->>'numero','')||' · '||coalesce(v_old->>'fornecedor','')
   when 'mov' then initcap(v_old->>'tipo')||' · '||coalesce(v_old->>'descricao','') else 'Ponto de '||coalesce((select nome from adm_funcionarios where id=(v_old->>'funcionario_id')::bigint),'')||' · '||to_char((v_old->>'data_operacao')::date,'DD/MM') end;
 insert into adm_pendencias(origem, ref_tipo, ref_id, empresa_id, unidade_id, titulo, motivo, acao, responsavel, prazo)
   values ('devolucao', p_tipo, p_id, (v_old->>'empresa_id')::bigint, (v_old->>'unidade_id')::bigint, 'Devolvido: '||titulo, p_motivo, 'Corrigir o lançamento e responder', 'juliana', p_prazo) returning id into v_p;
 insert into adm_historico(ref_tipo, ref_id, campo, antes, depois, justificativa) values (p_tipo, p_id, 'status', v_old->>'status', 'devolvido', p_motivo);
 if nullif(v_old->>'fechamento_id','') is not null then update adm_fechamentos set status='devolvido' where id=(v_old->>'fechamento_id')::bigint and status='enviado'; end if;
 return v_p;
end $function$;

create or replace function adm_conferir_fechamento(p_id bigint, p_aprovar boolean, p_obs text) returns void language plpgsql security definer set search_path to 'public' as $function$
declare f adm_fechamentos; t text;
begin
 if not adm_master() then raise exception 'Só o gestor pode conferir o fechamento.'; end if;
 select * into f from adm_fechamentos where id=p_id for update;
 if f.id is null then raise exception 'Fechamento não encontrado.'; end if;
 if p_aprovar then
   if exists(select 1 from adm_notas where fechamento_id=p_id and status='devolvido') or exists(select 1 from adm_movs where fechamento_id=p_id and status='devolvido')
      or exists(select 1 from adm_ponto where fechamento_id=p_id and status='devolvido') then raise exception 'Há itens devolvidos aguardando correção da Juliana.'; end if;
   update adm_fechamentos set status='aprovado', obs_gestor=p_obs, conferido_por=auth.uid(), conferido_em=now() where id=p_id;
   foreach t in array array['adm_notas','adm_movs','adm_ponto'] loop
     execute format('update %I set status=''aprovado'' where fechamento_id=$1 and status in (''enviado'',''respondido'')', t) using p_id;
   end loop;
   update adm_pendencias set status='resolvida', resolvido_por=auth.uid(), resolvido_em=now()
     where origem='devolucao' and status in ('aberta','respondida') and ((ref_tipo,ref_id) in (select 'nota',id from adm_notas where fechamento_id=p_id union all select 'mov',id from adm_movs where fechamento_id=p_id union all select 'ponto',id from adm_ponto where fechamento_id=p_id));
 else
   update adm_fechamentos set status='devolvido', obs_gestor=p_obs, conferido_por=auth.uid(), conferido_em=now() where id=p_id;
 end if;
 insert into adm_historico(ref_tipo, ref_id, campo, depois, justificativa) values ('fechamento', p_id, 'status', case when p_aprovar then 'aprovado' else 'devolvido' end, nullif(p_obs,''));
end $function$;

-- Pendências
create or replace function adm_salvar_pendencia(p_id bigint, p_dados jsonb) returns bigint language plpgsql security definer set search_path to 'public' as $function$
declare v_id bigint; v_emp bigint := nullif(p_dados->>'empresa_id','')::bigint; v_uni bigint := nullif(p_dados->>'unidade_id','')::bigint;
begin
 if not adm_acessa() then raise exception 'Seu acesso não permite esta ação.'; end if;
 if v_emp is not null and not adm_pode(v_emp, v_uni) then raise exception 'Seu acesso não permite esta ação.'; end if;
 if coalesce(trim(p_dados->>'titulo'),'')='' then raise exception 'Informe o título da pendência.'; end if;
 if p_id is null then
   insert into adm_pendencias(origem, ref_tipo, ref_id, empresa_id, unidade_id, titulo, motivo, acao, responsavel, prazo, drive_url, arquivo_nome, pasta)
   values (coalesce(p_dados->>'origem','rotina'), nullif(p_dados->>'ref_tipo',''), nullif(p_dados->>'ref_id','')::bigint, v_emp, v_uni, p_dados->>'titulo', p_dados->>'motivo', p_dados->>'acao',
     coalesce(nullif(p_dados->>'responsavel',''),'juliana'), nullif(p_dados->>'prazo','')::date, nullif(p_dados->>'drive_url',''), nullif(p_dados->>'arquivo_nome',''), nullif(p_dados->>'pasta','')) returning id into v_id;
   return v_id;
 end if;
 update adm_pendencias set titulo=p_dados->>'titulo', motivo=p_dados->>'motivo', acao=p_dados->>'acao', responsavel=coalesce(nullif(p_dados->>'responsavel',''),responsavel),
   prazo=nullif(p_dados->>'prazo','')::date, empresa_id=v_emp, unidade_id=v_uni where id=p_id;
 insert into adm_historico(ref_tipo, ref_id, campo, depois) values ('pendencia', p_id, 'editada', p_dados->>'titulo');
 return p_id;
end $function$;

create or replace function adm_responder_pendencia(p_id bigint, p_resposta text) returns void language plpgsql security definer set search_path to 'public' as $function$
declare p adm_pendencias;
begin
 select * into p from adm_pendencias where id=p_id for update;
 if p.id is null then raise exception 'Pendência não encontrada.'; end if;
 if not (adm_master() or (adm_operador() and (p.empresa_id is null or adm_pode(p.empresa_id,p.unidade_id)))) then raise exception 'Seu acesso não permite esta ação.'; end if;
 if coalesce(trim(p_resposta),'')='' then raise exception 'Escreva a resposta.'; end if;
 update adm_pendencias set resposta=p_resposta, respondido_em=now(), status='respondida' where id=p_id;
 if p.ref_tipo in ('nota','mov','ponto') and p.origem='devolucao' then
   execute format('update %I set status=''respondido'' where id=$1 and status=''devolvido''', adm_tabela(p.ref_tipo)) using p.ref_id;
 end if;
 insert into adm_historico(ref_tipo, ref_id, campo, depois) values ('pendencia', p_id, 'resposta', p_resposta);
end $function$;

create or replace function adm_resolver_pendencia(p_id bigint, p_status text, p_obs text default null) returns void language plpgsql security definer set search_path to 'public' as $function$
declare p adm_pendencias;
begin
 select * into p from adm_pendencias where id=p_id for update;
 if p.id is null then raise exception 'Pendência não encontrada.'; end if;
 if p_status not in ('resolvida','aberta','cancelada') then raise exception 'Situação inválida.'; end if;
 if not (adm_master() or (adm_operador() and p.responsavel='juliana' and p.origem not in ('devolucao') and (p.empresa_id is null or adm_pode(p.empresa_id,p.unidade_id)))) then
   raise exception 'Só o gestor pode encerrar esta pendência.'; end if;
 update adm_pendencias set status=p_status, resolvido_por=case when p_status='resolvida' then auth.uid() end, resolvido_em=case when p_status='resolvida' then now() end where id=p_id;
 insert into adm_historico(ref_tipo, ref_id, campo, antes, depois, justificativa) values ('pendencia', p_id, 'status', p.status, p_status, nullif(p_obs,''));
end $function$;

-- Ponto: encaminhar correção
create or replace function adm_ponto_correcao(p_id bigint, p_justificativa text) returns void language plpgsql security definer set search_path to 'public' as $function$
declare r adm_ponto;
begin
 select * into r from adm_ponto where id=p_id;
 if r.id is null then raise exception 'Registro de ponto não encontrado.'; end if;
 if not adm_pode(r.empresa_id, r.unidade_id) then raise exception 'Seu acesso não permite esta ação.'; end if;
 if coalesce(trim(p_justificativa),'')='' then raise exception 'Escreva a justificativa da correção.'; end if;
 update adm_ponto set correcao_justificativa=p_justificativa, correcao_status='pendente' where id=p_id;
 insert into adm_pendencias(origem, ref_tipo, ref_id, empresa_id, unidade_id, titulo, motivo, acao, responsavel)
   values ('ponto','ponto',p_id,r.empresa_id,r.unidade_id,'Correção de ponto: '||(select nome from adm_funcionarios where id=r.funcionario_id)||' · '||to_char(r.data_operacao,'DD/MM'), p_justificativa, 'Aprovar ou recusar a correção', 'iago');
 insert into adm_historico(ref_tipo, ref_id, campo, depois, justificativa) values ('ponto', p_id, 'correcao', 'pendente', p_justificativa);
end $function$;

create or replace function adm_ponto_decidir(p_id bigint, p_aprovar boolean, p_obs text default null) returns void language plpgsql security definer set search_path to 'public' as $function$
begin
 if not adm_master() then raise exception 'Só o gestor pode decidir a correção.'; end if;
 update adm_ponto set correcao_status=case when p_aprovar then 'aprovada' else 'recusada' end where id=p_id;
 update adm_pendencias set status='resolvida', resolvido_por=auth.uid(), resolvido_em=now(), resposta=coalesce(resposta,p_obs) where origem='ponto' and ref_tipo='ponto' and ref_id=p_id and status<>'resolvida';
 insert into adm_historico(ref_tipo, ref_id, campo, depois, justificativa) values ('ponto', p_id, 'correcao', case when p_aprovar then 'aprovada' else 'recusada' end, nullif(p_obs,''));
end $function$;

-- Cadastros e acessos (gestor)
create or replace function adm_salvar_cadastro(p_tipo text, p_id bigint, p_dados jsonb) returns bigint language plpgsql security definer set search_path to 'public' as $function$
declare v_id bigint;
begin
 if p_tipo='funcionario' then
   if not (adm_master() or (adm_operador() and adm_pode(nullif(p_dados->>'empresa_id','')::bigint, nullif(p_dados->>'unidade_id','')::bigint))) then raise exception 'Seu acesso não permite esta ação.'; end if;
   if p_id is null then insert into adm_funcionarios(nome, empresa_id, unidade_id, obs) values (p_dados->>'nome', nullif(p_dados->>'empresa_id','')::bigint, nullif(p_dados->>'unidade_id','')::bigint, p_dados->>'obs') returning id into v_id;
   else update adm_funcionarios set nome=p_dados->>'nome', empresa_id=nullif(p_dados->>'empresa_id','')::bigint, unidade_id=nullif(p_dados->>'unidade_id','')::bigint, ativo=coalesce((p_dados->>'ativo')::boolean,ativo), obs=p_dados->>'obs' where id=p_id; v_id:=p_id; end if;
 elsif not adm_master() then raise exception 'Só o gestor altera empresas e unidades.';
 elsif p_tipo='empresa' then
   if p_id is null then insert into adm_empresas(nome, cnpj) values (p_dados->>'nome', nullif(p_dados->>'cnpj','')) returning id into v_id;
   else update adm_empresas set nome=p_dados->>'nome', cnpj=nullif(p_dados->>'cnpj',''), ativa=coalesce((p_dados->>'ativa')::boolean,ativa) where id=p_id; v_id:=p_id; end if;
 elsif p_tipo='unidade' then
   if p_id is null then insert into adm_unidades(empresa_id, nome) values ((p_dados->>'empresa_id')::bigint, p_dados->>'nome') returning id into v_id;
   else update adm_unidades set nome=p_dados->>'nome', empresa_id=(p_dados->>'empresa_id')::bigint, ativa=coalesce((p_dados->>'ativa')::boolean,ativa) where id=p_id; v_id:=p_id; end if;
 else raise exception 'Cadastro inválido.'; end if;
 if coalesce(trim(p_dados->>'nome'),'')='' then raise exception 'Informe o nome.'; end if;
 insert into adm_historico(ref_tipo, ref_id, campo, depois) values (p_tipo, v_id, case when p_id is null then 'criado' else 'editado' end, p_dados::text);
 return v_id;
end $function$;

create or replace function adm_definir_acesso(p_email text, p_nome text, p_empresas bigint[], p_unidades bigint[], p_ativo boolean) returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_uid uuid; e text := lower(trim(p_email));
begin
 if not adm_master() then raise exception 'Só o administrador master gerencia os acessos.'; end if;
 if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
 select user_id into v_uid from perfis where lower(email)=e limit 1;
 if v_uid = auth.uid() then raise exception 'Você já é o administrador master.'; end if;
 insert into adm_acesso(email, nome, user_id, empresas, unidades, ativo) values (e, coalesce(nullif(trim(p_nome),''),e), v_uid, p_empresas, p_unidades, coalesce(p_ativo,true))
 on conflict (email) do update set nome=excluded.nome, user_id=coalesce(adm_acesso.user_id, excluded.user_id), empresas=excluded.empresas, unidades=excluded.unidades, ativo=excluded.ativo, alterado_em=now();
 if v_uid is not null then
   if coalesce(p_ativo,true) then update perfis set papel='adm' where user_id=v_uid and (papel is null or papel='adm');
   else update perfis set papel=null where user_id=v_uid and papel='adm'; end if;
 end if;
 insert into adm_historico(ref_tipo, ref_id, campo, depois) values ('acesso', 0, e, case when coalesce(p_ativo,true) then 'ativo' else 'desativado' end);
end $function$;

-- Auditoria: vincular arquivo a um lançamento
create or replace function adm_auditoria_vincular(p_id bigint, p_ref_tipo text, p_ref_id bigint, p_situacao text) returns void language plpgsql security definer set search_path to 'public' as $function$
declare a adm_auditoria;
begin
 if not adm_acessa() then raise exception 'Seu acesso não permite esta ação.'; end if;
 select * into a from adm_auditoria where id=p_id;
 update adm_auditoria set ref_tipo=nullif(p_ref_tipo,''), ref_id=p_ref_id, situacao=coalesce(nullif(p_situacao,''),situacao) where id=p_id;
 if p_ref_tipo in ('nota','mov','ponto') and p_ref_id is not null and a.link is not null then
   perform adm_anexar(p_ref_tipo, p_ref_id, 'drive', a.nome, null, a.link, null, 'auditoria', 'Vinculado na auditoria do Drive');
 end if;
end $function$;

grant execute on all functions in schema public to authenticated;

-- ============ Dados iniciais ============
insert into adm_empresas(nome) select 'Tudo Mix' where not exists(select 1 from adm_empresas);
insert into adm_empresas(nome) select 'Mixtudo Nacional' where not exists(select 1 from adm_empresas where nome='Mixtudo Nacional');
insert into adm_unidades(empresa_id, nome) select (select id from adm_empresas where nome='Tudo Mix'), u from unnest(array['Estoque principal','Estoque 04','Estoque 19']) u
  where not exists(select 1 from adm_unidades);
insert into adm_funcionarios(nome, empresa_id, unidade_id, user_id, obs)
  select coalesce(p.nome,split_part(p.email,'@',1)), (select id from adm_empresas where nome='Tudo Mix'),
    (select id from adm_unidades where nome=case p.papel when 'e19' then 'Estoque 19' else 'Estoque 04' end), p.user_id, 'Importado do cadastro de acessos do estoque — confirmar se é funcionário com ponto'
  from perfis p where p.papel in ('e19','e04') and not exists(select 1 from adm_funcionarios);
