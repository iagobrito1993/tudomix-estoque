-- Teste do fluxo completo ADM TudoMix. Roda tudo numa transação e desfaz no final
-- (o resultado aparece na mensagem de erro "RESULTADO DO TESTE"). Não deixa dados no banco.
do $teste$
declare
  J uuid := gen_random_uuid();                                  -- Juliana (usuária de teste, só nesta transação)
  I uuid := (select user_id from perfis where lower(email)='iagobrito@tudomixatacado.com'); -- Iago (master)
  X uuid := gen_random_uuid();                                  -- usuário sem permissão
  out text := ''; n bigint; m bigint; p bigint; f bigint; v numeric; c int; ok boolean; st text; e1 bigint;
begin
  select id into e1 from adm_empresas where nome='Tudo Mix';
  insert into adm_acesso(email,nome,user_id) values ('teste.fluxo@exemplo.invalid','Juliana (teste)',J);

  -- ===== JULIANA =====
  perform set_config('request.jwt.claims', json_build_object('sub',J,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  n := adm_salvar('nota', null, jsonb_build_object('empresa_id',e1,'fornecedor','Fornecedor Teste','fornecedor_cnpj','11.111.111/0001-11','numero','999001','serie','1','valor_total',1000,'data_operacao','2026-11-17','recebimento','2026-11-17','emissao','2026-11-16','situacao_sistema','lancada'));
  out := out || '1 Juliana lançou nota #'||n||E'\n';
  begin perform adm_salvar('nota', null, jsonb_build_object('empresa_id',e1,'fornecedor','Fornecedor Teste','numero','999001','serie','1','valor_total',1000,'data_operacao','2026-11-17'));
        out := out || '2 FALHA: duplicidade não detectada'||E'\n';
  exception when others then out := out || '2 Duplicidade detectada antes de salvar: '||sqlerrm||E'\n'; end;
  m := adm_salvar('mov', null, jsonb_build_object('tipo','pagamento','empresa_id',e1,'descricao','Pagamento NF 999001','valor',1000,'data_operacao','2026-11-18','pago_em','2026-11-18','nota_id',n,'favorecido','Fornecedor Teste','conta_origem','Banco teste'));
  perform adm_anexar('mov', m, 'drive', 'Comprovante pagamento', null, 'https://drive.google.com/file/d/teste/view', null);
  perform adm_anexar('nota', n, 'drive', 'NF 999001', null, 'https://drive.google.com/file/d/teste2/view', null);
  out := out || '3 Pagamento #'||m||' vinculado à nota e comprovante anexado'||E'\n';
  -- total de despesas: pagamentos + saldo das notas não pagas (nota vinculada não soma de novo)
  select coalesce(sum(valor),0) into v from adm_movs where empresa_id=e1 and tipo in ('saida','pagamento') and status<>'cancelado' and data_operacao between '2026-11-16' and '2026-11-22';
  select v + coalesce(sum(greatest(0, nn.valor_total - coalesce((select sum(mm.valor) from adm_movs mm where mm.nota_id=nn.id and mm.status<>'cancelado'),0))),0) into v
    from adm_notas nn where nn.empresa_id=e1 and nn.status<>'cancelado' and nn.data_operacao between '2026-11-16' and '2026-11-22';
  out := out || '4 Total de despesas da semana = R$ '||v||' (nota de 1000 + pagamento de 1000 vinculado → conta uma vez)'||E'\n';
  p := adm_salvar('ponto', null, jsonb_build_object('empresa_id',e1,'funcionario_id',(select min(id) from adm_funcionarios),'tipo','marcacao','data_operacao','2026-11-18','entrada','08:00','saida_intervalo','12:00','saida','17:00'));
  perform adm_ponto_correcao(p, 'Funcionário esqueceu de bater o retorno do almoço');
  out := out || '5 Ponto #'||p||' com marcação faltando e correção encaminhada'||E'\n';
  perform adm_marcar_dia(e1, null, '2026-11-16', true);
  f := adm_gerar_fechamento('semanal', e1, null, '2026-11-16', '2026-11-22');
  perform adm_enviar_fechamento(f, 'Semana de teste', '{}'::jsonb);
  select status into st from adm_fechamentos where id=f; out := out || '6 Fechamento #'||f||' enviado: '||st||E'\n';
  begin delete from adm_notas where id=n; get diagnostics c = row_count; out := out || '7 Juliana tentou excluir nota: '||c||' linha(s) apagada(s)'||E'\n';
  exception when others then out := out || '7 Juliana não consegue excluir: '||sqlerrm||E'\n'; end;
  begin perform adm_salvar('nota', n, jsonb_build_object('valor_total',1200)); out := out || '8 FALHA: alterou sem justificativa'||E'\n';
  exception when others then out := out || '8 Alterar registro enviado sem justificativa é bloqueado: '||sqlerrm||E'\n'; end;
  begin perform adm_devolver_item('mov', m, 'teste'); out := out || '9 FALHA: Juliana devolveu item'||E'\n';
  exception when others then out := out || '9 Juliana não pode aprovar/devolver: '||sqlerrm||E'\n'; end;

  -- ===== IAGO =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub',I,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into c from adm_docs where ref_tipo='mov' and ref_id=m and not removido;
  out := out || '10 Iago vê o comprovante do pagamento: '||c||' documento(s)'||E'\n';
  perform adm_devolver_item('mov', m, 'Descrição incompleta: informar a forma de pagamento');
  select status into st from adm_movs where id=m; out := out || '11 Iago devolveu o pagamento: '||st||E'\n';

  -- ===== JULIANA corrige =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub',J,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into c from adm_pendencias where origem='devolucao' and ref_id=m and status='aberta' and responsavel='juliana';
  out := out || '12 Juliana vê a devolução como pendência dela: '||c||E'\n';
  perform adm_salvar('mov', m, jsonb_build_object('descricao','Pagamento NF 999001 via Pix'), 'Incluída a forma de pagamento');
  perform adm_responder_pendencia((select id from adm_pendencias where origem='devolucao' and ref_id=m), 'Corrigido: pago via Pix');
  select status into st from adm_movs where id=m; out := out || '13 Juliana corrigiu pelo próprio registro: '||st||E'\n';

  -- ===== IAGO confere histórico e aprova =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub',I,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select antes||' → '||depois||' | justificativa: '||justificativa into st from adm_historico where ref_tipo='mov' and ref_id=m and campo='descricao';
  out := out || '14 Histórico da correção: '||st||E'\n';
  perform adm_conferir_fechamento(f, true, 'Conferido');
  select status into st from adm_fechamentos where id=f; out := out || '15 Iago aprovou o fechamento: '||st||E'\n';

  -- ===== SEM PERMISSÃO =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub',X,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into c from adm_notas; out := out || '16 Usuário sem permissão vê '||c||' nota(s)';
  select count(*) into c from adm_docs; out := out || ', '||c||' documento(s)';
  select count(*) into c from storage.objects where bucket_id='adm'; out := out || ', '||c||' anexo(s) no armazenamento'||E'\n';
  begin perform adm_salvar('nota', null, jsonb_build_object('empresa_id',e1,'fornecedor','X','numero','1')); out := out || '17 FALHA: sem permissão conseguiu gravar'||E'\n';
  exception when others then out := out || '17 Sem permissão não grava: '||sqlerrm||E'\n'; end;
  execute 'reset role';
  raise exception 'RESULTADO DO TESTE%', E'\n'||out;
end $teste$;
