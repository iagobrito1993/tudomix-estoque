// ================= ADM TudoMix =================
// Página de rotina administrativa (Juliana) e conferência do gestor (Iago).
// Gravação sempre por funções do banco (adm_*), que validam acesso e guardam histórico.
const ADM_VIA_LINK=/access_token|type=(magiclink|invite|signup)/.test(location.hash||'');
const ADM_ST={aberto:['Lançado','b-can'],enviado:['Enviado p/ conferência','b-rota'],devolvido:['Devolvido','b-venc'],respondido:['Corrigido · aguardando gestor','b-hoje'],aprovado:['Aprovado','b-rec'],cancelado:['Cancelado','b-can']};
const ADM_FST={rascunho:['Em revisão','b-hoje'],enviado:['Aguardando conferência','b-rota'],devolvido:['Devolvido para ajuste','b-venc'],aprovado:['Aprovado','b-rec']};
const ADM_MOV={entrada:'Entrada',saida:'Saída',transferencia:'Transferência',pagamento:'Pagamento'};
const ADM_SIS={nao_lancada:'Não lançada no sistema',lancada:'Lançada no sistema',conferida:'Conferida no sistema'};
const ADM_TIPO={nota:'Nota fiscal',mov:'Movimentação',ponto:'Ponto'};
const ADM_PEND_RESP={juliana:'Juliana',iago:'Iago (gestor)'};
const ADM_ORIG={auditoria:'Auditoria do Drive',rotina:'Rotina',devolucao:'Devolução do gestor',ponto:'Correção de ponto',sistema:'Sistema'};
const ADM_SEM=['dom','seg','ter','qua','qui','sex','sáb'];
let ADM={ok:false,erro:'',master:false,eu:null,emp:[],uni:[],func:[],notas:[],movs:[],ponto:[],docs:[],dias:[],fech:[],pend:[],aud:[],acessos:[],pessoas:[],forn:[],hist:[]};
let admSub='geral',admF={emp:'',uni:'',de:'',ate:''},admPF='juliana',admMovF='',admPontoF='',admRel={tipo:'semanal',data:'',fid:null,obs:{}},admCfg='acessos',admHistQ='',admQ='';

// ---------- datas ----------
function admIso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function admDt(s){return new Date(s+'T12:00:00');}
function admSemana(s){const d=admDt(s||hoje());const w=(d.getDay()+6)%7;d.setDate(d.getDate()-w);const a=admIso(d);d.setDate(d.getDate()+6);return [a,admIso(d)];}
function admDias(de,ate){const L=[];if(!de||!ate)return L;const d=admDt(de);for(let i=0;i<62&&admIso(d)<=ate;i++){L.push(admIso(d));d.setDate(d.getDate()+1);}return L;}
function admDiaSem(s){return ADM_SEM[admDt(s).getDay()];}
function admIni(){if(!admF.de){const [a,b]=admSemana(hoje());admF.de=a;admF.ate=b;}if(!admRel.data)admRel.data=hoje();}

// ---------- dados ----------
function admR(r){if(r.error)throw r.error;return r.data||[];}
async function carregarADM(){
  admIni();
  try{
    const m=await sb.rpc('adm_master');if(m.error)throw m.error;ADM.master=!!m.data;
    const lst=(t,o,asc)=>tudo(()=>sb.from(t).select('*').order(o||'id',{ascending:!!asc}));
    const [emp,uni,func,notas,movs,ponto,docs,dias,fech,pend,aud,ac,pes,forn,hist]=await Promise.all([
      sb.from('adm_empresas').select('*').order('nome').then(admR),sb.from('adm_unidades').select('*').order('nome').then(admR),sb.from('adm_funcionarios').select('*').order('nome').then(admR),
      lst('adm_notas'),lst('adm_movs'),lst('adm_ponto'),lst('adm_docs'),sb.from('adm_dias').select('*').then(admR),lst('adm_fechamentos'),lst('adm_pendencias'),lst('adm_auditoria','id',true),
      sb.from('adm_acesso').select('*').order('nome').then(admR),sb.rpc('adm_pessoas').then(admR),sb.rpc('adm_fornecedores').then(admR),
      sb.from('adm_historico').select('*').order('id',{ascending:false}).limit(2000).then(admR)]);
    Object.assign(ADM,{ok:true,erro:'',emp,uni,func,notas,movs,ponto,docs,dias,fech,pend,aud,acessos:ac,pessoas:pes,forn,hist});
    ADM.eu=ac.find(a=>sessao&&a.user_id===sessao.user.id)||null;
    if(!admF.emp&&emp.length===1)admF.emp=String(emp[0].id);
  }catch(e){console.error(e);ADM.ok=false;ADM.erro=/does not exist|schema cache|Could not find/i.test(e.message||'')?'banco':'erro';}
}
function admPode(){return ADM.ok&&(ADM.master||!!ADM.eu);}
const admEmp=id=>ADM.emp.find(e=>e.id===+id)||{nome:'—'};
const admUni=id=>ADM.uni.find(u=>u.id===+id)||{nome:id?'—':'Todas as unidades'};
const admFunc=id=>ADM.func.find(f=>f.id===+id)||{nome:'—'};
function admPessoa(uid){if(!uid)return '—';const p=ADM.pessoas.find(x=>x.user_id===uid);if(p)return p.nome||p.email;return nomeDe(uid)||'—';}
function admReg(tipo,id){return (tipo==='nota'?ADM.notas:tipo==='mov'?ADM.movs:ADM.ponto).find(r=>r.id===+id);}
function admDocs(tipo,id){return ADM.docs.filter(d=>d.ref_tipo===tipo&&d.ref_id===+id&&!d.removido);}
function admSemDoc(tipo,r){return r.status!=='cancelado'&&(r.pendente_doc||!admDocs(tipo,r.id).length);}
function admNotaPago(n){return ADM.movs.filter(m=>m.nota_id===n.id&&m.status!=='cancelado'&&(m.tipo==='saida'||m.tipo==='pagamento')).reduce((a,m)=>a+(+m.valor||0),0);}
function admNotaSaldo(n){return Math.max(0,Math.round(((+n.valor_total||0)-admNotaPago(n))*100)/100);}
function admMovPago(m){return m.tipo==='saida'||(m.tipo==='pagamento'&&!!m.pago_em);}
function admFaltas(p){if(p.status==='cancelado')return [];if(p.tipo==='espelho')return admDocs('ponto',p.id).length?[]:['espelho não anexado'];
  return [['entrada','entrada'],['saida_intervalo','saída p/ intervalo'],['retorno','retorno'],['saida','saída final']].filter(([k])=>!p[k]).map(x=>x[1]);}
function admPontoPend(p){return p.status!=='cancelado'&&(admFaltas(p).length>0||p.correcao_status==='pendente');}
function admNoFiltro(r,de,ate,emp,uni){emp=emp===undefined?admF.emp:emp;uni=uni===undefined?admF.uni:uni;de=de===undefined?admF.de:de;ate=ate===undefined?admF.ate:ate;
  return (!emp||r.empresa_id===+emp)&&(!uni||r.unidade_id===+uni||r.unidade_destino_id===+uni)&&(!de||r.data_operacao>=de)&&(!ate||(r.periodo_ate||r.data_operacao)>=de&&r.data_operacao<=ate);}
function admSel(emp,uni,de,ate){const f=r=>admNoFiltro(r,de,ate,emp,uni);return {notas:ADM.notas.filter(f),movs:ADM.movs.filter(f),ponto:ADM.ponto.filter(f)};}
function admCalc(S){
  const nv=S.notas.filter(n=>n.status!=='cancelado'),mv=S.movs.filter(m=>m.status!=='cancelado');
  const pagas=mv.filter(m=>(m.tipo==='saida'||m.tipo==='pagamento')&&admMovPago(m)),abMov=mv.filter(m=>m.tipo==='pagamento'&&!m.pago_em);
  const abNotas=nv.filter(n=>admNotaSaldo(n)>0.004);
  const soma=(L,f)=>L.reduce((a,x)=>a+(+f(x)||0),0);
  const vPagas=soma(pagas,m=>m.valor),vAbMov=soma(abMov,m=>m.valor),vAbNotas=soma(abNotas,admNotaSaldo);
  return {nv,mv,pagas,abMov,abNotas,vNotas:soma(nv,n=>n.valor_total),vPagas,vAberto:vAbMov+vAbNotas,vAbMov,vAbNotas,vDespesas:vPagas+vAbMov+vAbNotas,
    entradas:mv.filter(m=>m.tipo==='entrada'),vEntradas:soma(mv.filter(m=>m.tipo==='entrada'),m=>m.valor),
    transf:mv.filter(m=>m.tipo==='transferencia'),vTransf:soma(mv.filter(m=>m.tipo==='transferencia'),m=>m.valor),
    semDocMov:mv.filter(m=>admSemDoc('mov',m)),semDocNota:nv.filter(n=>admSemDoc('nota',n)),pontoPend:S.ponto.filter(admPontoPend)};
}
function admDiaInfo(emp,uni,d){const S=admSel(emp,uni,d,d);const n=S.notas.filter(x=>x.status!=='cancelado').length+S.movs.filter(x=>x.status!=='cancelado').length+S.ponto.filter(x=>x.status!=='cancelado').length;
  const sem=ADM.dias.find(x=>x.empresa_id===+emp&&x.unidade_id===(+uni||0)&&x.data===d&&x.sem_movimentacao);return {S,n,sem:!!sem};}

// ---------- pedaços visuais ----------
function admBadge(s){const x=ADM_ST[s]||[s,'b-can'];return `<span class="badge ${x[1]}">${x[0]}</span>`;}
function admFBadge(s){const x=ADM_FST[s]||[s,'b-can'];return `<span class="badge ${x[1]}">${x[0]}</span>`;}
function admLocal(r){return esc(admEmp(r.empresa_id).nome)+(r.unidade_id?' · '+esc(admUni(r.unidade_id).nome):'');}
function admDocTag(tipo,r){const n=admDocs(tipo,r.id).length;return n?`<span class="ok" style="margin:0;font-size:12px">📎 ${n} doc.</span>`:`<span class="semfoto">${r.pendente_doc?'Pendente de documento':'sem documento'}</span>`;}
function admTitulo(tipo,r){if(!r)return '(registro)';if(tipo==='nota')return 'NF '+(r.numero||'s/n')+(r.serie?'/'+r.serie:'')+' · '+(r.fornecedor||'');
  if(tipo==='mov')return (ADM_MOV[r.tipo]||r.tipo)+' · '+(r.descricao||'');return 'Ponto · '+admFunc(r.funcionario_id).nome+(r.tipo==='espelho'?' (espelho)':'');}
function admValor(tipo,r){return tipo==='nota'?+r.valor_total:tipo==='mov'?+r.valor:null;}
function admCard(tipo,r,extra){const v=admValor(tipo,r);
  const sub=tipo==='nota'?`Recebida ${fd(r.recebimento)} · ${ADM_SIS[r.situacao_sistema]||''}${admNotaPago(r)>0?' · pago '+brl(admNotaPago(r))+(admNotaSaldo(r)>0?' · saldo '+brl(admNotaSaldo(r)):' · quitada'):''}`
    :tipo==='mov'?`${r.categoria?esc(r.categoria)+' · ':''}${r.tipo==='pagamento'?(r.pago_em?'Pago '+fd(r.pago_em):'<b style="color:var(--red)">Em aberto</b>'+(r.vencimento?' · vence '+fd(r.vencimento):'')):''}${r.tipo==='transferencia'?'→ '+esc(admUni(r.unidade_destino_id).nome):''}${r.favorecido?' · '+esc(r.favorecido):''}${r.nota_id?' · 🔗 '+esc(admTitulo('nota',admReg('nota',r.nota_id))):''}`
    :(r.tipo==='espelho'?`Espelho ${fd(r.data_operacao)} a ${fd(r.periodo_ate)}`:`${r.entrada||'--:--'} · ${r.saida_intervalo||'--:--'} · ${r.retorno||'--:--'} · ${r.saida||'--:--'}`)+(admFaltas(r).length?` · <b style="color:var(--amb)">falta: ${admFaltas(r).join(', ')}</b>`:'')+(r.correcao_status?` · correção ${r.correcao_status}`:'');
  return `<div class="card click" data-ad="ver|${tipo}|${r.id}"><div><div class="t">${esc(admTitulo(tipo,r))} ${admBadge(r.status)}</div>
    <div class="meta">${fd(r.data_operacao)} (${admDiaSem(r.data_operacao)}) · ${admLocal(r)} · lançado ${fts(r.lancado_em)} por ${esc(admPessoa(r.lancado_por))}</div>
    <div class="meta">${sub}</div><div class="meta">${admDocTag(tipo,r)}${r.status==='devolvido'&&r.devolucao_motivo?' · <b style="color:var(--red)">Devolvido: '+esc(r.devolucao_motivo)+'</b>':''}${extra||''}</div></div>
    <div class="dir">${v!=null?`<div class="n" style="${r.status==='cancelado'?'text-decoration:line-through;color:var(--mut)':''}">${tipo==='mov'&&r.tipo==='entrada'?'+':''}${brl(v)}</div>`:''}</div></div>`;}
function admOpts(L,v,vazio,lab){return (vazio!=null?`<option value="">${vazio}</option>`:'')+L.map(x=>`<option value="${x.id}" ${String(v)===String(x.id)?'selected':''}>${esc(lab?lab(x):x.nome)}</option>`).join('');}
function admEmpsAtivas(){return ADM.emp.filter(e=>e.ativa);}
function admUnisDe(emp){return ADM.uni.filter(u=>u.ativa&&(!emp||u.empresa_id===+emp));}

// ---------- página ----------
function abaADM(){
  admIni();
  if(!ADM.ok)return `<div class="vazio" style="margin-top:14px">${ADM.erro==='banco'?'A página ADM TudoMix ainda não foi ativada no banco de dados. Assim que o administrador concluir a configuração, ela aparece aqui.':'Não foi possível carregar a página ADM. Toque em Atualizar.'}</div>`;
  if(!admPode())return `<div class="vazio" style="margin-top:14px">Seu usuário ainda não tem acesso à página ADM TudoMix. Peça a liberação ao Iago.</div>`;
  const subs=[['geral','Visão geral'],['notas','Notas fiscais'],['movs','Despesas e movimentações'],['ponto','Ponto dos funcionários'],['rel','Relatórios diários e semanais'],['pend','Pendências e documentos']];
  if(ADM.master)subs.push(['cfg','Acessos e histórico']);
  const nPend=admPendLista().filter(p=>p.responsavel===(ADM.master?'iago':'juliana')).length;
  const conteudo={geral:admGeral,notas:admNotas,movs:admMovs,ponto:admPonto,rel:admRelatorio,pend:admPendencias,cfg:admConfig}[admSub]||admGeral;
  return `<div class="e04-topo"><b>📋 ADM TudoMix</b> · ${ADM.master?'Administrador master — conferência':'Rotina administrativa'}${ADM.master?'':' · '+esc(ADM.eu?ADM.eu.nome:'')}</div>
  <nav class="abas" style="padding-top:6px">${subs.map(([k,l])=>`<button class="${admSub===k?'on':''}" data-ad="sub|${k}">${l}${k==='pend'&&nPend?` <span class="badge b-venc">${nPend}</span>`:''}</button>`).join('')}</nav>
  ${admSub==='cfg'?'':admFiltros()}${conteudo()}`;
}
function admFiltros(){const emps=admEmpsAtivas();
  return `<div class="barra" style="align-items:center">
    <select id="adf_emp" style="max-width:200px">${emps.length>1?'<option value="">Todas as empresas</option>':''}${admOpts(emps,admF.emp)}</select>
    <select id="adf_uni" style="max-width:200px"><option value="">Todas as unidades</option>${admOpts(admUnisDe(admF.emp),admF.uni,null,u=>emps.length>1&&!admF.emp?admEmp(u.empresa_id).nome+' · '+u.nome:u.nome)}</select>
    <label class="meta">De</label><input id="adf_de" type="date" value="${admF.de}" style="max-width:150px"><label class="meta">até</label><input id="adf_ate" type="date" value="${admF.ate}" style="max-width:150px">
    <div class="chips"><button data-ad="per|hoje">Hoje</button><button data-ad="per|sem">Esta semana</button><button data-ad="per|ant">Semana passada</button><button data-ad="per|mes">Este mês</button></div></div>`;}

// ---------- Visão geral ----------
function admKpi(id,n,l,alerta){return `<div class="kpi clk${alerta?' kv':''}" data-ad="kpi|${id}"><div class="n">${n}</div><div class="l">${l}</div></div>`;}
function admGeral(){
  const S=admSel(),C=admCalc(S);const [sa,sb_]=admSemana(hoje());
  const fs=ADM.fech.filter(f=>(!admF.emp||f.empresa_id===+admF.emp)&&f.de<=admF.ate&&f.ate>=admF.de).sort((a,b)=>b.id-a.id);
  const fSem=ADM.fech.find(f=>(!admF.emp||f.empresa_id===+admF.emp)&&f.de===sa&&f.ate===sb_);
  const pend=admPendLista();const pj=pend.filter(p=>p.responsavel==='juliana').length,pi=pend.filter(p=>p.responsavel==='iago').length;
  const dias=admF.emp?admDias(admF.de,admF.ate>hoje()?hoje():admF.ate).filter(d=>{const i=admDiaInfo(admF.emp,admF.uni,d);return !i.n&&!i.sem;}):[];
  return `<div class="resumo">
    ${admKpi('notas',un(C.nv.length),'Notas lançadas · '+brl(C.vNotas))}
    ${admKpi('pagas',brl(C.vPagas),'Despesas pagas ('+C.pagas.length+')')}
    ${admKpi('aberto',brl(C.vAberto),'Despesas em aberto ('+(C.abMov.length+C.abNotas.length)+')',C.vAberto>0)}
    ${admKpi('semdoc',un(C.semDocMov.length+C.semDocNota.length),'Lançamentos sem comprovante',C.semDocMov.length+C.semDocNota.length>0)}
    ${admKpi('ponto',un(C.pontoPend.length),'Pendências de ponto',C.pontoPend.length>0)}
    <div class="kpi clk" data-ad="sub|rel"><div class="n" style="font-size:15px;padding-top:4px">${fSem?admFBadge(fSem.status):'<span class="badge b-hoje">Não gerado</span>'}</div><div class="l">Relatório desta semana (${fd(sa).slice(0,5)}–${fd(sb_).slice(0,5)})</div></div>
  </div>
  <div class="resumo">
    ${admKpi('entradas',brl(C.vEntradas),'Entradas ('+C.entradas.length+')')}
    ${admKpi('transf',brl(C.vTransf),'Transferências ('+C.transf.length+')')}
    ${admKpi('despesas',brl(C.vDespesas),'Total de despesas (pagas + em aberto)')}
    <div class="kpi clk" data-ad="pendf|juliana"><div class="n">${un(pj)}</div><div class="l">Pendências com a Juliana</div></div>
    <div class="kpi clk${pi?' kv':''}" data-ad="pendf|iago"><div class="n">${un(pi)}</div><div class="l">Pendências com o Iago</div></div>
  </div>
  <div class="total">💡 Uma nota vinculada a um pagamento entra <b>uma única vez</b> no total de despesas: quando há pagamento, conta o pagamento; a nota só soma o saldo que ainda não foi pago.</div>
  ${admF.emp?(dias.length?`<div class="ia-av">⚠ ${dias.length} dia(s) do período sem lançamento e sem confirmação de "Sem movimentação": ${dias.map(d=>fd(d).slice(0,5)+' ('+admDiaSem(d)+')').join(', ')}. Confirme em <button class="link" data-ad="sub|rel">Relatórios</button>.</div>`:''):'<div class="meta">Escolha uma empresa no filtro para ver os dias sem lançamento.</div>'}
  <div class="barra" style="margin-top:12px">${ADM.master&&!ADM.eu?'':'<button class="primary" data-ad="novo|nota">+ Nota fiscal</button><button class="primary" data-ad="novo|mov">+ Despesa / movimentação</button><button class="primary" data-ad="novo|ponto">+ Ponto</button>'}</div>
  <h3>Fechamentos do período</h3>${fs.length?`<div class="lista">${fs.map(admFechCard).join('')}</div>`:'<div class="meta">Nenhum fechamento gerado neste período.</div>'}
  <h3>Últimos lançamentos do período</h3>${admListaMista(S,12)}`;
}
function admListaMista(S,max){const L=[...S.notas.map(r=>['nota',r]),...S.movs.map(r=>['mov',r]),...S.ponto.map(r=>['ponto',r])].sort((a,b)=>(b[1].data_operacao+b[1].lancado_em).localeCompare(a[1].data_operacao+a[1].lancado_em));
  return L.length?`<div class="lista">${L.slice(0,max||9999).map(([t,r])=>admCard(t,r)).join('')}</div>${max&&L.length>max?`<div class="meta" style="margin-top:6px">… e mais ${L.length-max}. Veja nas abas.</div>`:''}`:'<div class="vazio">Nenhum lançamento no período.</div>';}
function admKpiAbrir(id,S){S=S||admSel();const C=admCalc(S);const I=[];let t='';
  if(id==='notas'){t='Notas lançadas';C.nv.forEach(r=>I.push(['nota',r]));}
  if(id==='pagas'){t='Despesas pagas';C.pagas.forEach(r=>I.push(['mov',r]));}
  if(id==='aberto'){t='Despesas em aberto';C.abMov.forEach(r=>I.push(['mov',r]));C.abNotas.forEach(r=>I.push(['nota',r,'Saldo sem pagamento vinculado: '+brl(admNotaSaldo(r))]));}
  if(id==='despesas'){t='Total de despesas';C.pagas.forEach(r=>I.push(['mov',r]));C.abMov.forEach(r=>I.push(['mov',r]));C.abNotas.forEach(r=>I.push(['nota',r,'Entra só o saldo: '+brl(admNotaSaldo(r))]));}
  if(id==='semdoc'){t='Lançamentos sem comprovante';C.semDocNota.forEach(r=>I.push(['nota',r]));C.semDocMov.forEach(r=>I.push(['mov',r]));}
  if(id==='ponto'){t='Pendências de ponto';C.pontoPend.forEach(r=>I.push(['ponto',r]));}
  if(id==='entradas'){t='Entradas';C.entradas.forEach(r=>I.push(['mov',r]));}
  if(id==='transf'){t='Transferências';C.transf.forEach(r=>I.push(['mov',r]));}
  if(id==='mov'){t='Movimentações';S.movs.filter(r=>r.status!=='cancelado').forEach(r=>I.push(['mov',r]));}
  const tot={notas:C.vNotas,pagas:C.vPagas,aberto:C.vAberto,despesas:C.vDespesas,entradas:C.vEntradas,transf:C.vTransf}[id];
  admLista(t+(tot!=null?' · '+brl(tot):''),I);}
function admLista(titulo,I){
  abrir(`<h2>${esc(titulo)}</h2><div class="sub">${I.length} registro(s). Toque em um item para abrir o lançamento e o comprovante.</div>
  <div class="lista rolar" style="max-height:60vh">${I.length?I.map(([t,r,x])=>admCard(t,r,x?' · <b>'+esc(x)+'</b>':'')).join(''):'<div class="vazio">Nada aqui.</div>'}</div>
  <div class="rodape"><button id="cx">Fechar</button></div>`,true);
  $('cx').onclick=fechar;}

// ---------- listas ----------
function admBusca(ph){return `<div class="barra"><input id="adf_q" type="search" placeholder="${ph}" value="${esc(admQ)}"></div>`;}
function admBate(...c){const q=norm(admQ.trim());return !q||q.split(/\s+/).every(w=>norm(c.join(' ')).includes(w));}
function admNotas(){const S=admSel();const L=S.notas.filter(n=>admBate(n.numero,n.serie,n.fornecedor,n.fornecedor_cnpj,n.chave,n.obs));const C=admCalc(S);
  return `<div class="barra"><button class="primary" data-ad="novo|nota">+ Lançar nota fiscal</button></div>
  <div class="resumo">${admKpi('notas',un(C.nv.length),'Notas no período · '+brl(C.vNotas))}${admKpi('aberto',brl(C.vAbNotas),'Saldo de notas sem pagamento')}${admKpi('semdoc',un(C.semDocNota.length),'Notas sem arquivo',C.semDocNota.length>0)}</div>
  ${admBusca('Buscar número, fornecedor, CNPJ ou chave…')}<div class="lista">${L.length?L.map(r=>admCard('nota',r)).join(''):'<div class="vazio">Nenhuma nota no período.</div>'}</div>`;}
function admMovs(){const S=admSel();const C=admCalc(S);const L=S.movs.filter(m=>(!admMovF||m.tipo===admMovF)&&admBate(m.descricao,m.categoria,m.favorecido,m.responsavel,m.conta_origem,m.obs));
  return `<div class="barra"><button class="primary" data-ad="novo|mov">+ Novo lançamento</button></div>
  <div class="resumo">${admKpi('pagas',brl(C.vPagas),'Despesas pagas')}${admKpi('aberto',brl(C.vAberto),'Em aberto (pagamentos + saldo de notas)',C.vAberto>0)}${admKpi('entradas',brl(C.vEntradas),'Entradas')}${admKpi('transf',brl(C.vTransf),'Transferências')}${admKpi('semdoc',un(C.semDocMov.length),'Sem comprovante',C.semDocMov.length>0)}</div>
  <div class="chips" style="margin:8px 0">${[['','Todos'],['saida','Saídas'],['pagamento','Pagamentos'],['entrada','Entradas'],['transferencia','Transferências']].map(([k,l])=>`<button class="${admMovF===k?'on':''}" data-ad="movf|${k}">${l}</button>`).join('')}</div>
  ${admBusca('Buscar descrição, categoria, favorecido…')}<div class="lista">${L.length?L.map(r=>admCard('mov',r)).join(''):'<div class="vazio">Nenhum lançamento no período.</div>'}</div>`;}
function admPonto(){const S=admSel();const L=S.ponto.filter(p=>!admPontoF||p.funcionario_id===+admPontoF);const pend=L.filter(admPontoPend);
  const fs=ADM.func.filter(f=>f.ativo&&(!admF.emp||!f.empresa_id||f.empresa_id===+admF.emp)&&(!admF.uni||!f.unidade_id||f.unidade_id===+admF.uni));
  return `<div class="barra"><button class="primary" data-ad="novo|ponto">+ Registrar ponto</button><button data-ad="func|">+ Funcionário</button>
    <select id="adf_func" style="max-width:240px"><option value="">Todos os funcionários</option>${admOpts(fs,admPontoF)}</select></div>
  <div class="resumo">${admKpi('ponto',un(pend.length),'Marcações faltando ou correção pendente',pend.length>0)}<div class="kpi"><div class="n">${un(L.filter(p=>p.status!=='cancelado').length)}</div><div class="l">Registros no período</div></div></div>
  <div class="lista">${L.length?L.map(r=>admCard('ponto',r)).join(''):'<div class="vazio">Nenhum registro de ponto no período.</div>'}</div>
  <h3>Funcionários</h3><div class="meta" style="margin-bottom:6px">${fs.map(f=>`<button class="small" data-ad="func|${f.id}">${esc(f.nome)}${f.unidade_id?' · '+esc(admUni(f.unidade_id).nome):''}</button>`).join(' ')||'Nenhum funcionário cadastrado.'}</div>`;}

// ---------- ver um lançamento ----------
function admCampos(tipo,r){const L=[];const a=(k,v)=>{if(v!=null&&v!=='')L.push([k,v]);};
  a('Empresa / unidade',admLocal(r));a('Data da operação',fd(r.data_operacao)+(r.periodo_ate?' a '+fd(r.periodo_ate):''));a('Lançado em',fts(r.lancado_em)+' por '+esc(admPessoa(r.lancado_por)));
  if(tipo==='nota'){a('Fornecedor',esc(r.fornecedor)+(r.fornecedor_cnpj?' · CNPJ '+esc(r.fornecedor_cnpj):''));a('Número / série',esc(r.numero)+(r.serie?' / '+esc(r.serie):''));a('Chave de acesso',r.chave?`<span class="codigo">${esc(r.chave)}</span>`:'');
    a('Emissão / recebimento',fd(r.emissao)+' / '+fd(r.recebimento));a('Valor total',`<b>${brl(r.valor_total)}</b>`);a('Situação no sistema',ADM_SIS[r.situacao_sistema]);
    const p=admNotaPago(r);a('Pagamentos vinculados',p?brl(p)+(admNotaSaldo(r)>0?' · saldo '+brl(admNotaSaldo(r)):' · quitada'):'nenhum');}
  if(tipo==='mov'){a('Tipo',ADM_MOV[r.tipo]);a('Descrição',esc(r.descricao));a('Categoria',esc(r.categoria||''));a('Valor',`<b>${brl(r.valor)}</b>`);a('Responsável',esc(r.responsavel||''));
    if(r.tipo==='transferencia')a('Unidade de destino',esc(admUni(r.unidade_destino_id).nome));a('Favorecido',esc(r.favorecido||''));a('Vencimento',r.vencimento?fd(r.vencimento):'');
    a('Pagamento',r.tipo==='pagamento'?(r.pago_em?'Pago em '+fd(r.pago_em):'Em aberto'):'');a('Conta de origem',esc(r.conta_origem||''));
    if(r.nota_id)a('Nota vinculada',`<button class="link" data-ad="ver|nota|${r.nota_id}">${esc(admTitulo('nota',admReg('nota',r.nota_id)))}</button>`);}
  if(tipo==='ponto'){a('Funcionário',esc(admFunc(r.funcionario_id).nome));a('Tipo',r.tipo==='espelho'?'Espelho de ponto do período':'Marcações do dia');
    if(r.tipo!=='espelho'){a('Entrada',r.entrada||'—');a('Saída p/ intervalo',r.saida_intervalo||'—');a('Retorno',r.retorno||'—');a('Saída final',r.saida||'—');}
    if(admFaltas(r).length)a('Faltando',`<b style="color:var(--amb)">${admFaltas(r).join(', ')}</b>`);
    if(r.correcao_status)a('Correção',esc(r.correcao_status)+(r.correcao_justificativa?' — '+esc(r.correcao_justificativa):''));}
  a('Observação',esc(r.obs||''));
  return `<div class="tab">${L.map(([k,v])=>`<div class="lin"><span class="meta" style="margin:0">${k}</span><span style="text-align:right">${v}</span></div>`).join('')}</div>`;}
function admHistHTML(tipo,id){const H=ADM.hist.filter(h=>h.ref_tipo===tipo&&h.ref_id===+id);
  return H.length?`<div class="scroll"><table class="planilha"><tr><th>Quando</th><th>Quem</th><th>Campo</th><th>Antes</th><th>Depois</th><th>Justificativa</th></tr>${H.map(h=>`<tr><td>${fts(h.em)}</td><td>${esc(admPessoa(h.user_id))}</td><td>${esc(h.campo||'')}</td><td>${esc(h.antes??'')}</td><td>${esc(h.depois??'')}</td><td style="white-space:normal">${esc(h.justificativa||'')}</td></tr>`).join('')}</table></div>`:'<div class="meta">Sem alterações registradas.</div>';}
function admDocsHTML(tipo,id,podeAnexar){const D_=admDocs(tipo,id);
  return `${D_.length?D_.map(d=>`<div class="enc"><button class="link" data-ad="doc|${d.id}">${d.tipo==='drive'?'🔗':'📄'} ${esc(d.nome)}</button><span><span class="badge b-can">${d.tipo==='drive'?'Link do Drive':'Arquivo'}</span> ${podeAnexar?`<button class="small danger" data-adrdoc="${d.id}">Remover</button>`:''}</span></div>`).join(''):'<div class="semfoto">Nenhum documento anexado.</div>'}
  ${podeAnexar?`<div class="duas" style="margin-top:8px"><div><label class="small btnf">📎 Anexar arquivo (PDF, foto, XML)<input id="adv_arq" type="file" accept="image/*,application/pdf,.xml,text/xml" multiple class="hidden"></label></div>
  <div style="display:flex;gap:6px"><input id="adv_link" placeholder="Colar link do Google Drive"><button class="small" id="adv_addlink">Vincular</button></div></div>`:''}`;}
function admPodeEditar(r){return r.status!=='cancelado'&&(ADM.master||(!!ADM.eu&&r.status!=='aprovado'));}
async function admAbrirDoc(id){const d=ADM.docs.find(x=>x.id===+id);if(!d)return;log('abriu','Documento ADM '+d.nome);if(d.tipo==='drive')window.open(d.url,'_blank','noopener');else abrirArq('adm',d.caminho);}
function admVer(tipo,id){
  const r=admReg(tipo,id);if(!r){toast('Registro não encontrado.');return;}log('abriu',ADM_TIPO[tipo]+' #'+id);
  const pode=admPodeEditar(r),trav=!!r.enviado_em;
  const pends=ADM.pend.filter(p=>p.ref_tipo===tipo&&p.ref_id===r.id&&p.status!=='resolvida'&&p.status!=='cancelada');
  const pags=tipo==='nota'?ADM.movs.filter(m=>m.nota_id===r.id):[];
  abrir(`<h2>${esc(admTitulo(tipo,r))} ${admBadge(r.status)}</h2>
  <div class="sub">${ADM_TIPO[tipo]} #${r.id}${trav?' · enviado para conferência em '+fts(r.enviado_em)+' — alterações exigem justificativa e ficam no histórico':''}</div>
  ${r.status==='devolvido'||r.status==='respondido'?`<div class="ia-av"><b>Devolvido pelo gestor:</b> ${esc(r.devolucao_motivo||'')}</div>`:''}
  ${admCampos(tipo,r)}
  ${tipo==='nota'?`<h3>Pagamentos desta nota</h3>${pags.length?`<div class="lista">${pags.map(m=>admCard('mov',m)).join('')}</div>`:'<div class="meta">Nenhum pagamento vinculado.</div>'}${pode&&admNotaSaldo(r)>0?`<button class="small" id="adv_pag" style="margin-top:6px">+ Registrar pagamento desta nota</button>`:''}`:''}
  <h3>Documentos</h3>${admDocsHTML(tipo,r.id,pode||ADM.master)}
  ${pends.length?`<h3>Pendências</h3>${pends.map(p=>admPendCard(p,true)).join('')}`:''}
  <h3>Histórico</h3>${admHistHTML(tipo,r.id)}
  <div class="erro"></div>
  <div class="rodape">${ADM.master&&r.status!=='cancelado'&&r.status!=='aberto'?'<button class="danger" id="adv_dev">Devolver para a Juliana</button>':''}
   ${tipo==='ponto'&&pode&&r.correcao_status!=='pendente'?'<button id="adv_cor">Encaminhar correção</button>':''}
   ${tipo==='ponto'&&ADM.master&&r.correcao_status==='pendente'?'<button id="adv_cr0">Recusar correção</button><button id="adv_cr1">Aprovar correção</button>':''}
   ${pode?'<button class="danger" id="adv_canc">Cancelar lançamento</button><button id="adv_edit">Editar</button>':''}<button class="primary" id="cx">Fechar</button></div>`,true);
  const M=$('modal');$('cx').onclick=fechar;
  M.querySelectorAll('[data-adrdoc]').forEach(b=>b.onclick=()=>admPedirTexto('Remover documento','O arquivo continua guardado e a remoção fica registrada no histórico.','Motivo da remoção','Remover',async j=>{await rpc('adm_remover_doc',{p_id:+b.dataset.adrdoc,p_justificativa:j});await admRecarregar();admVer(tipo,id);}));
  admLigarPendBtns(M,()=>admVer(tipo,id));
  if($('adv_arq'))$('adv_arq').onchange=()=>rodar($('adv_arq').parentElement,async()=>{let j=null;if(trav)j=await admJust();for(const f of $('adv_arq').files)await admSubir(tipo,r.id,f,j);await admRecarregar();toast('Documento anexado.');admVer(tipo,id);});
  if($('adv_addlink'))$('adv_addlink').onclick=()=>rodar($('adv_addlink'),async()=>{const u=val('adv_link');if(!u)throw new Error('Cole o link do Google Drive.');let j=null;if(trav)j=await admJust();
    await rpc('adm_anexar',{p_ref_tipo:tipo,p_ref_id:r.id,p_tipo:'drive',p_nome:admNomeLink(u),p_caminho:null,p_url:u,p_tamanho:null,p_categoria:null,p_justificativa:j});await admRecarregar();toast('Link vinculado.');admVer(tipo,id);});
  if($('adv_pag'))$('adv_pag').onclick=()=>admForm('mov',null,{tipo:'pagamento',nota_id:r.id,empresa_id:r.empresa_id,unidade_id:r.unidade_id,valor:admNotaSaldo(r),favorecido:r.fornecedor,descricao:'Pagamento '+admTitulo('nota',r)});
  if($('adv_edit'))$('adv_edit').onclick=()=>admForm(tipo,r.id);
  if($('adv_canc'))$('adv_canc').onclick=()=>admPedirTexto('Cancelar lançamento','O lançamento não é apagado: fica marcado como cancelado, sai dos totais e o motivo vai para o histórico.','Motivo do cancelamento','Cancelar lançamento',async j=>{await rpc('adm_cancelar',{p_tipo:tipo,p_id:r.id,p_justificativa:j});await admRecarregar();admVer(tipo,id);});
  if($('adv_dev'))$('adv_dev').onclick=()=>admDevolver(tipo,r.id,()=>admVer(tipo,id));
  if($('adv_cor'))$('adv_cor').onclick=()=>admPedirTexto('Encaminhar correção de ponto','A correção vai para o Iago aprovar.','Justificativa (o que precisa ser corrigido e por quê)','Encaminhar',async j=>{await rpc('adm_ponto_correcao',{p_id:r.id,p_justificativa:j});await admRecarregar();admVer(tipo,id);});
  if($('adv_cr1'))$('adv_cr1').onclick=()=>rodar($('adv_cr1'),async()=>{await rpc('adm_ponto_decidir',{p_id:r.id,p_aprovar:true,p_obs:null});await admRecarregar();admVer(tipo,id);});
  if($('adv_cr0'))$('adv_cr0').onclick=()=>admPedirTexto('Recusar correção','','Motivo','Recusar',async j=>{await rpc('adm_ponto_decidir',{p_id:r.id,p_aprovar:false,p_obs:j});await admRecarregar();admVer(tipo,id);});
}
function admNomeLink(u){try{const x=new URL(u);return 'Drive: '+(x.pathname.split('/').filter(Boolean).slice(0,3).join('/'));}catch(e){return 'Link do Drive';}}
function admPedirTexto(titulo,sub,label,btn,fn,extra){
  abrir(`<h2>${esc(titulo)}</h2>${sub?`<div class="sub">${esc(sub)}</div>`:''}<div class="campo"><label>${esc(label)}</label><textarea id="apt_t"></textarea></div>${extra||''}<div class="erro"></div><div class="rodape"><button id="cx">Voltar</button><button class="primary" id="ok">${esc(btn)}</button></div>`);
  $('cx').onclick=fechar;$('ok').onclick=()=>rodar($('ok'),async()=>{const t=val('apt_t');if(!t)throw new Error('Preencha o campo.');await fn(t);});}
function admJust(){return new Promise((ok,no)=>{const j=prompt('Este lançamento já foi enviado para conferência.\nInforme a justificativa da alteração:');if(j&&j.trim())ok(j.trim());else no(new Error('Informe a justificativa da alteração.'));});}
function admDevolver(tipo,id,depois){
  admPedirTexto('Devolver item para a Juliana','Ela recebe a pendência com o motivo e responde pelo próprio registro.','Motivo da devolução (o que precisa ser corrigido)','Devolver',async j=>{await rpc('adm_devolver_item',{p_tipo:tipo,p_id:id,p_motivo:j,p_prazo:val('apt_prazo')||null});await admRecarregar();toast('Item devolvido para a Juliana.');depois?depois():fechar();},
  `<div class="campo"><label>Prazo para correção (opcional)</label><input id="apt_prazo" type="date"></div>`);}
async function admSubir(tipo,id,f,just){
  const c=await subirArq('adm',tipo+'/'+id,f);
  await rpc('adm_anexar',{p_ref_tipo:tipo,p_ref_id:id,p_tipo:'arquivo',p_nome:f.name.slice(0,150),p_caminho:c,p_url:null,p_tamanho:f.size,p_categoria:/\.xml$/i.test(f.name)?'xml':null,p_justificativa:just||null});}
async function admRecarregar(){await carregarADM();render();}

// ---------- formulário de lançamento ----------
function admForm(tipo,id,pre){
  const r=id?admReg(tipo,id):null,v=Object.assign({},r||{},pre||{}),trav=!!(r&&r.enviado_em);
  if(!r){v.empresa_id=v.empresa_id||(+admF.emp||(admEmpsAtivas()[0]||{}).id);v.unidade_id=v.unidade_id||(+admF.uni||null);v.data_operacao=v.data_operacao||hoje();}
  const emps=admEmpsAtivas(),tm=v.tipo||(tipo==='mov'?'saida':'marcacao');
  const selEmp=`<div class="duas"><div class="campo"><label>Empresa</label><select id="af_emp">${admOpts(emps,v.empresa_id)}</select></div><div class="campo"><label>Unidade</label><select id="af_uni">${admOpts(admUnisDe(v.empresa_id),v.unidade_id,'—')}</select></div></div>`;
  let corpo='';
  if(tipo==='nota')corpo=`${selEmp}
    <div class="caixa-up" style="grid-template-columns:1fr 1fr"><label class="up"><span class="ic">🧾</span><b>Ler XML da nota</b><span class="meta">preenche os campos sozinho</span><input id="af_xml" type="file" accept=".xml,text/xml" class="hidden"></label>
      <label class="up"><span class="ic">📷</span><b>Nota escaneada / foto / PDF</b><span class="meta" id="af_arqn">anexar arquivo</span><input id="af_arq" type="file" accept="image/*,application/pdf" capture="environment" multiple class="hidden"></label></div>
    <div class="campo"><label>Fornecedor</label><input id="af_forn" list="af_fl" value="${esc(v.fornecedor||'')}" autocomplete="off"><datalist id="af_fl">${ADM.forn.map(f=>`<option value="${esc(f.nome)}">${esc(f.cnpj||'')}</option>`).join('')}</datalist></div>
    <div class="tres"><div class="campo"><label>CNPJ do fornecedor</label><input id="af_cnpj" value="${esc(v.fornecedor_cnpj||'')}"></div><div class="campo"><label>Número da nota</label><input id="af_num" value="${esc(v.numero||'')}"></div><div class="campo"><label>Série</label><input id="af_serie" value="${esc(v.serie||'')}"></div></div>
    <div class="campo"><label>Chave de acesso (quando houver)</label><input id="af_chave" class="codigo" value="${esc(v.chave||'')}" placeholder="44 números"></div>
    <div class="tres"><div class="campo"><label>Data de emissão</label><input id="af_emis" type="date" value="${v.emissao||''}"></div><div class="campo"><label>Data de recebimento</label><input id="af_rec" type="date" value="${v.recebimento||v.data_operacao||''}"></div><div class="campo"><label>Valor total</label><input id="af_val" inputmode="decimal" value="${v.valor_total!=null?dec(v.valor_total):''}"></div></div>
    <div class="duas"><div class="campo"><label>Data da operação</label><input id="af_data" type="date" value="${v.data_operacao||''}"></div><div class="campo"><label>Situação do lançamento no sistema</label><select id="af_sis">${Object.entries(ADM_SIS).map(([k,l])=>`<option value="${k}" ${(v.situacao_sistema||'nao_lancada')===k?'selected':''}>${l}</option>`).join('')}</select></div></div>
    <div id="af_dup"></div>`;
  if(tipo==='mov'){const notas=ADM.notas.filter(n=>n.status!=='cancelado'&&(admNotaSaldo(n)>0||n.id===+v.nota_id));
    corpo=`<div class="seg" style="margin-bottom:12px">${Object.entries(ADM_MOV).map(([k,l])=>`<button type="button" data-aftipo="${k}" class="${tm===k?'on':''}">${l}</button>`).join('')}</div>${selEmp}
    <div class="duas"><div class="campo"><label>Data da operação</label><input id="af_data" type="date" value="${v.data_operacao||''}"></div><div class="campo"><label>Valor</label><input id="af_val" inputmode="decimal" value="${v.valor!=null&&v.valor!==''?dec(v.valor):''}"></div></div>
    <div class="campo"><label>Descrição</label><input id="af_desc" value="${esc(v.descricao||'')}"></div>
    <div class="duas"><div class="campo"><label>Categoria</label><input id="af_cat" list="af_cl" value="${esc(v.categoria||'')}"><datalist id="af_cl">${[...new Set(ADM.movs.map(m=>m.categoria).filter(Boolean).concat(['Fornecedor','Frete','Aluguel','Energia','Internet','Folha de pagamento','Impostos','Marketplace','Material de escritório','Manutenção','Combustível','Outros']))].map(c=>`<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="campo"><label>Responsável</label><input id="af_resp" value="${esc(v.responsavel||'')}"></div></div>
    <div class="campo af-t af-transferencia"><label>Unidade de destino</label><select id="af_dest">${admOpts(ADM.uni.filter(u=>u.ativa),v.unidade_destino_id,'Escolha…',u=>admEmp(u.empresa_id).nome+' · '+u.nome)}</select></div>
    <div class="af-t af-saida af-pagamento">
      <div class="duas"><div class="campo"><label>Favorecido</label><input id="af_fav" list="af_fl" value="${esc(v.favorecido||'')}"><datalist id="af_fl">${ADM.forn.map(f=>`<option value="${esc(f.nome)}">`).join('')}</datalist></div><div class="campo"><label>Conta de origem</label><input id="af_conta" value="${esc(v.conta_origem||'')}" placeholder="ex.: Itaú PJ, Pix Nubank…"></div></div>
      <div class="duas"><div class="campo af-t af-pagamento"><label>Vencimento</label><input id="af_venc" type="date" value="${v.vencimento||''}"></div><div class="campo af-t af-pagamento"><label>Data de pagamento (vazio = em aberto)</label><input id="af_pago" type="date" value="${v.pago_em||''}"></div></div>
      <div class="campo"><label>Vincular a uma nota já cadastrada (o valor não é somado duas vezes)</label><select id="af_nota"><option value="">Sem nota vinculada</option>${notas.map(n=>`<option value="${n.id}" ${+v.nota_id===n.id?'selected':''}>${esc(admTitulo('nota',n))} · ${fd(n.recebimento)} · saldo ${brl(admNotaSaldo(n)+(r&&r.nota_id===n.id&&r.status!=='cancelado'?+r.valor:0))}</option>`).join('')}</select><div class="meta" id="af_notainfo"></div></div>
    </div>
    <div class="caixa-up" style="grid-template-columns:1fr"><label class="up"><span class="ic">📎</span><b>Comprovante</b><span class="meta" id="af_arqn">anexar arquivo (foto ou PDF)</span><input id="af_arq" type="file" accept="image/*,application/pdf" capture="environment" multiple class="hidden"></label></div>`;}
  if(tipo==='ponto'){const fs=ADM.func.filter(f=>f.ativo||f.id===+v.funcionario_id);
    corpo=`<div class="seg" style="margin-bottom:12px"><button type="button" data-aftipo="marcacao" class="${tm==='marcacao'?'on':''}">Marcações do dia</button><button type="button" data-aftipo="espelho" class="${tm==='espelho'?'on':''}">Espelho do período</button></div>${selEmp}
    <div class="duas"><div class="campo"><label>Funcionário</label><select id="af_func">${admOpts(fs,v.funcionario_id,'Escolha…')}</select></div><div class="campo"><label>&nbsp;</label><button type="button" class="small" id="af_nfunc">+ Cadastrar funcionário</button></div></div>
    <div class="duas"><div class="campo"><label class="af-t af-marcacao">Data</label><label class="af-t af-espelho">Período de</label><input id="af_data" type="date" value="${v.data_operacao||''}"></div><div class="campo af-t af-espelho"><label>até</label><input id="af_ate" type="date" value="${v.periodo_ate||''}"></div></div>
    <div class="af-t af-marcacao"><div class="duas"><div class="campo"><label>Entrada</label><input id="af_h1" type="time" value="${(v.entrada||'').slice(0,5)}"></div><div class="campo"><label>Saída para intervalo</label><input id="af_h2" type="time" value="${(v.saida_intervalo||'').slice(0,5)}"></div></div>
      <div class="duas"><div class="campo"><label>Retorno</label><input id="af_h3" type="time" value="${(v.retorno||'').slice(0,5)}"></div><div class="campo"><label>Saída final</label><input id="af_h4" type="time" value="${(v.saida||'').slice(0,5)}"></div></div>
      <div class="meta">Marcações em branco ficam sinalizadas como faltantes.</div></div>
    <div class="caixa-up" style="grid-template-columns:1fr;margin-top:8px"><label class="up"><span class="ic">🕒</span><b>Espelho de ponto / comprovante</b><span class="meta" id="af_arqn">anexar arquivo</span><input id="af_arq" type="file" accept="image/*,application/pdf" capture="environment" multiple class="hidden"></label></div>`;}
  abrir(`<h2>${r?'Editar':'Novo'}: ${ADM_TIPO[tipo]}</h2><div class="sub">A data da operação é o dia em que aconteceu; a data do lançamento é registrada automaticamente.</div>
  ${corpo}
  ${r?'':`<div class="campo"><label>Ou colar link do arquivo no Google Drive</label><input id="af_link" placeholder="https://drive.google.com/…"></div>`}
  <div class="campo"><label>Observação</label><textarea id="af_obs">${esc(v.obs||'')}</textarea></div>
  ${trav?`<div class="campo"><label>Justificativa da alteração (obrigatória — o registro já foi enviado para conferência)</label><textarea id="af_just"></textarea></div>`:''}
  <div class="erro"></div>
  <div class="rodape"><button id="cx">Voltar</button>${r?'':'<button id="af_pend">Salvar como Pendente de documento</button>'}<button class="primary" id="ok">Salvar</button></div>`,true);
  const M=$('modal');let tipoSel=tm,dupOk=false,xmlDados=null;
  const mostra=()=>{M.querySelectorAll('.af-t').forEach(el=>el.style.display=el.classList.contains('af-'+tipoSel)?'':'none');M.querySelectorAll('[data-aftipo]').forEach(b=>b.classList.toggle('on',b.dataset.aftipo===tipoSel));};mostra();
  M.querySelectorAll('[data-aftipo]').forEach(b=>b.onclick=()=>{tipoSel=b.dataset.aftipo;mostra();});
  $('af_emp').onchange=()=>{$('af_uni').innerHTML=admOpts(admUnisDe(val('af_emp')),'','—');};
  $('cx').onclick=fechar;
  const arqs=()=>$('af_arq')?[...$('af_arq').files]:[];
  if($('af_arq'))$('af_arq').onchange=()=>{$('af_arqn').textContent=arqs().length?arqs().map(f=>f.name).join(', '):'anexar arquivo';};
  if($('af_nfunc'))$('af_nfunc').onclick=()=>admFuncForm(null,()=>admForm(tipo,id,admLerForm(tipo,tipoSel)));
  if($('af_xml'))$('af_xml').onchange=async()=>{const f=$('af_xml').files[0];if(!f)return;try{const x=lerXmlNF(await f.text());xmlDados=f;
    $('af_forn').value=x.fornecedor||'';$('af_cnpj').value=x.cnpj||'';$('af_num').value=x.numero||'';$('af_serie').value=x.serie||'';$('af_chave').value=x.chave||'';$('af_emis').value=x.emissao||'';$('af_val').value=x.valor_total?dec(x.valor_total):'';
    M.querySelector('.erro').textContent='';toast('XML lido: NF '+x.numero+' de '+x.fornecedor+'.');dupOk=false;}catch(e){M.querySelector('.erro').textContent=msgErro(e);}};
  if($('af_chave'))$('af_chave').onchange=()=>{const k=lerChave(val('af_chave'));if(k){if(!val('af_num'))$('af_num').value=k.numero;if(!val('af_serie'))$('af_serie').value=k.serie;if(!val('af_cnpj'))$('af_cnpj').value=k.cnpj;}};
  if($('af_forn'))$('af_forn').onchange=()=>{const f=ADM.forn.find(x=>norm(x.nome)===norm(val('af_forn')));if(f&&f.cnpj&&!val('af_cnpj'))$('af_cnpj').value=f.cnpj;};
  M.querySelectorAll('#af_num,#af_serie,#af_chave,#af_cnpj,#af_forn').forEach(i=>i.addEventListener('input',()=>{dupOk=false;$('af_dup').innerHTML='';}));
  const infoNota=()=>{const el=$('af_notainfo');if(!el)return;const n=ADM.notas.find(x=>x.id===+val('af_nota'));if(!n){el.textContent='';return;}
    const saldo=admNotaSaldo(n)+(r&&r.nota_id===n.id&&r.status!=='cancelado'?+r.valor:0);const vv=dinheiro(val('af_val'));
    el.innerHTML=`Nota de ${brl(n.valor_total)} · saldo a pagar ${brl(saldo)}${!isNaN(vv)&&vv>saldo+0.009?' · <b style="color:var(--red)">valor maior que o saldo da nota</b>':''}`;
    if(!val('af_val'))$('af_val').value=dec(saldo);if($('af_fav')&&!val('af_fav'))$('af_fav').value=n.fornecedor||'';};
  if($('af_nota')){$('af_nota').onchange=infoNota;$('af_val').addEventListener('input',infoNota);infoNota();}
  const salvar=(btn,pendente)=>rodar(btn,async()=>{
    const dados=admLerForm(tipo,tipoSel);const link=val('af_link');const files=arqs();if(xmlDados)files.unshift(xmlDados);
    const temDoc=files.length||link||(r&&admDocs(tipo,r.id).length);
    if(!pendente&&!temDoc)throw new Error('Nenhum documento anexado. Anexe o arquivo, cole o link do Drive ou use "Salvar como Pendente de documento".');
    dados.pendente_doc=!temDoc;
    if(tipo==='nota'&&!dupOk){const {data,error}=await sb.rpc('adm_nota_duplicadas',{p_id:r?r.id:null,p_numero:dados.numero,p_serie:dados.serie,p_chave:dados.chave,p_cnpj:dados.fornecedor_cnpj,p_fornecedor:dados.fornecedor});if(error)throw error;
      if(data&&data.length){$('af_dup').innerHTML=`<div class="ia-av"><b>⚠ Possível duplicidade.</b> Já existe(m):<br>${data.map(d=>`${d.origem==='ADM'?'ADM':'Estoque'} · NF ${esc(d.numero||'')}${d.serie?'/'+esc(d.serie):''} · ${esc(d.fornecedor||'')} · ${fd(d.data)}${d.valor!=null?' · '+brl(d.valor):''}`).join('<br>')}<br>Confira antes. Se for outra nota, toque em Salvar de novo.</div>`;dupOk=true;btn.disabled=false;return;}}
    let just=null;if(trav){just=val('af_just');if(!just)throw new Error('Informe a justificativa da alteração.');}
    const nid=await rpc('adm_salvar',{p_tipo:tipo,p_id:r?r.id:null,p_dados:dados,p_justificativa:just,p_confirmar_duplicada:tipo==='nota'&&dupOk});
    for(const f of files)await admSubir(tipo,nid,f,just);
    if(link)await rpc('adm_anexar',{p_ref_tipo:tipo,p_ref_id:nid,p_tipo:'drive',p_nome:admNomeLink(link),p_caminho:null,p_url:link,p_tamanho:null,p_categoria:null,p_justificativa:just});
    await admRecarregar();toast(pendente&&!temDoc?'Salvo como Pendente de documento.':'Lançamento salvo.');admVer(tipo,nid);});
  $('ok').onclick=()=>salvar($('ok'),false);if($('af_pend'))$('af_pend').onclick=()=>salvar($('af_pend'),true);
}
function admLerForm(tipo,tsel){const n=x=>{const v=val(x);return v===''?null:v;},m=x=>{const v=dinheiro(val(x));return isNaN(v)?null:v;};
  const d={empresa_id:+val('af_emp')||null,unidade_id:+val('af_uni')||null,data_operacao:n('af_data'),obs:n('af_obs')};
  if(tipo==='nota')Object.assign(d,{fornecedor:n('af_forn'),fornecedor_cnpj:n('af_cnpj'),numero:n('af_num'),serie:n('af_serie'),chave:(val('af_chave').replace(/\D/g,''))||null,emissao:n('af_emis'),recebimento:n('af_rec'),valor_total:m('af_val')||0,situacao_sistema:val('af_sis')});
  if(tipo==='mov'){Object.assign(d,{tipo:tsel,descricao:n('af_desc'),categoria:n('af_cat'),valor:m('af_val')||0,responsavel:n('af_resp'),unidade_destino_id:tsel==='transferencia'?(+val('af_dest')||null):null,
    favorecido:tsel==='saida'||tsel==='pagamento'?n('af_fav'):null,conta_origem:tsel==='saida'||tsel==='pagamento'?n('af_conta'):null,vencimento:tsel==='pagamento'?n('af_venc'):null,pago_em:tsel==='pagamento'?n('af_pago'):null,nota_id:tsel==='saida'||tsel==='pagamento'?(+val('af_nota')||null):null});}
  if(tipo==='ponto')Object.assign(d,{tipo:tsel,funcionario_id:+val('af_func')||null,periodo_ate:tsel==='espelho'?n('af_ate'):null,entrada:tsel==='marcacao'?n('af_h1'):null,saida_intervalo:tsel==='marcacao'?n('af_h2'):null,retorno:tsel==='marcacao'?n('af_h3'):null,saida:tsel==='marcacao'?n('af_h4'):null});
  return d;}
function admFuncForm(id,depois){const f=id?ADM.func.find(x=>x.id===id):{};const emps=admEmpsAtivas();
  abrir(`<h2>${id?'Editar':'Cadastrar'} funcionário</h2><div class="campo"><label>Nome</label><input id="fu_nome" value="${esc(f.nome||'')}"></div>
  <div class="duas"><div class="campo"><label>Empresa</label><select id="fu_emp">${admOpts(emps,f.empresa_id||admF.emp)}</select></div><div class="campo"><label>Unidade</label><select id="fu_uni">${admOpts(admUnisDe(f.empresa_id||admF.emp||(emps[0]||{}).id),f.unidade_id||admF.uni,'—')}</select></div></div>
  <div class="campo"><label>Observação</label><input id="fu_obs" value="${esc(f.obs||'')}"></div>
  ${id?`<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" id="fu_at" style="width:18px;height:18px" ${f.ativo?'checked':''}> Ativo</label>`:''}
  <div class="erro"></div><div class="rodape"><button id="cx">Voltar</button><button class="primary" id="ok">Salvar</button></div>`);
  $('fu_emp').onchange=()=>{$('fu_uni').innerHTML=admOpts(admUnisDe(val('fu_emp')),'','—');};
  $('cx').onclick=()=>depois?depois():fechar();
  $('ok').onclick=()=>rodar($('ok'),async()=>{await rpc('adm_salvar_cadastro',{p_tipo:'funcionario',p_id:id||null,p_dados:{nome:val('fu_nome'),empresa_id:val('fu_emp'),unidade_id:val('fu_uni'),obs:val('fu_obs'),ativo:$('fu_at')?$('fu_at').checked:true}});await admRecarregar();toast('Funcionário salvo.');depois?depois():fechar();});}

// ---------- relatórios e fechamento ----------
function admPeriodoRel(){return admRel.tipo==='diario'?[admRel.data,admRel.data]:admSemana(admRel.data);}
function admFechDe(emp,uni,de,ate){return ADM.fech.filter(f=>f.empresa_id===+emp&&(f.unidade_id||null)===(+uni||null)&&f.de===de&&f.ate===ate).sort((a,b)=>b.id-a.id)[0]||null;}
function admFechCard(f){const C=admCalc(admSel(f.empresa_id,f.unidade_id,f.de,f.ate));
  return `<div class="card click" data-ad="fech|${f.id}"><div><div class="t">${f.tipo==='diario'?'Relatório diário '+fd(f.de):'Fechamento semanal '+fd(f.de)+' a '+fd(f.ate)} ${admFBadge(f.status)}</div>
  <div class="meta">${esc(admEmp(f.empresa_id).nome)} · ${esc(f.unidade_id?admUni(f.unidade_id).nome:'Todas as unidades')}${f.enviado_em?' · enviado '+fts(f.enviado_em)+' por '+esc(admPessoa(f.enviado_por)):''}${f.conferido_em?' · conferido '+fts(f.conferido_em):''}</div>
  ${f.obs_gestor?`<div class="meta"><b>Gestor:</b> ${esc(f.obs_gestor)}</div>`:''}</div><div class="dir"><div class="n">${brl(C.vDespesas)}</div><div class="meta">despesas</div></div></div>`;}
function admRelatorio(){
  const [de,ate]=admPeriodoRel();const emps=admEmpsAtivas();
  const emp=admF.emp||(emps.length===1?String(emps[0].id):'');
  const f=emp?admFechDe(emp,admF.uni,de,ate):null;
  const paraConferir=ADM.fech.filter(x=>x.status==='enviado').sort((a,b)=>a.id-b.id);
  const devolvidos=ADM.fech.filter(x=>x.status==='devolvido');
  let h=`${ADM.master&&paraConferir.length?`<h3>📥 Fechamentos aguardando sua conferência</h3><div class="lista">${paraConferir.map(admFechCard).join('')}</div>`:''}
  ${!ADM.master&&devolvidos.length?`<h3>↩ Devolvidos pelo gestor</h3><div class="lista">${devolvidos.map(admFechCard).join('')}</div>`:''}
  <h3>Gerar relatório</h3>
  <div class="barra" style="align-items:center"><div class="seg"><button class="${admRel.tipo==='semanal'?'on':''}" data-ad="rtipo|semanal">Semanal</button><button class="${admRel.tipo==='diario'?'on':''}" data-ad="rtipo|diario">Diário</button></div>
    <label class="meta">${admRel.tipo==='semanal'?'Semana do dia':'Dia'}</label><input id="adf_rdata" type="date" value="${admRel.data}" style="max-width:160px">
    <span class="meta">${admRel.tipo==='semanal'?'de '+fd(de)+' (seg) a '+fd(ate)+' (dom)':admDiaSem(de)}</span></div>`;
  if(!emp)return h+'<div class="vazio">Escolha a empresa no filtro acima para gerar o relatório.</div>'+admListaFech();
  h+=`<div class="meta" style="margin-bottom:8px">${esc(admEmp(emp).nome)} · ${esc(admF.uni?admUni(admF.uni).nome:'Todas as unidades')}</div>`;
  if(!f)return h+`<div class="barra"><button class="primary" data-ad="gerar|">Gerar fechamento</button></div><div class="meta">O sistema reúne notas, despesas, movimentações, ocorrências de ponto e pendências do período para você revisar.</div>`+admListaFech();
  return h+admResumoHTML(f,false)+admListaFech();
}
function admFechAtual(){const [de,ate]=admPeriodoRel();const emps=admEmpsAtivas();const emp=admF.emp||(emps.length===1?String(emps[0].id):'');return emp?admFechDe(emp,admF.uni,de,ate):null;}
function admListaFech(){const L=ADM.fech.filter(f=>(!admF.emp||f.empresa_id===+admF.emp)).sort((a,b)=>b.de.localeCompare(a.de)||b.id-a.id).slice(0,30);
  return `<h3>Histórico de fechamentos</h3>${L.length?`<div class="lista">${L.map(admFechCard).join('')}</div>`:'<div class="meta">Nenhum fechamento ainda.</div>'}`;}
function admResumoHTML(f,gestor){
  const S=admSel(f.empresa_id,f.unidade_id,f.de,f.ate),C=admCalc(S);const ed=!gestor&&f.status!=='aprovado'&&f.status!=='enviado'&&(ADM.eu||ADM.master);
  const dias=admDias(f.de,f.ate).map(d=>({d,...admDiaInfo(f.empresa_id,f.unidade_id,d)}));const vazios=dias.filter(x=>!x.n&&!x.sem&&x.d<=hoje());
  const pendP=admPendLista().filter(p=>(!p.empresa_id||p.empresa_id===f.empresa_id));
  const k=(id,n,l,al)=>`<div class="kpi clk${al?' kv':''}" data-ad="rk|${id}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  return `<div class="card" style="flex-direction:column;align-items:stretch">
  <div class="t">${f.tipo==='diario'?'Relatório diário de '+fd(f.de):'Fechamento de '+fd(f.de)+' a '+fd(f.ate)} ${admFBadge(f.status)}</div>
  <div class="meta">Gerado ${fts(f.gerado_em)} por ${esc(admPessoa(f.gerado_por))}${f.enviado_em?' · enviado '+fts(f.enviado_em):''}${f.obs_gestor?' · <b>Gestor:</b> '+esc(f.obs_gestor):''}</div>
  <h3>1. O que aconteceu</h3>
  <div class="scroll"><table class="planilha"><tr><th>Dia</th><th class="n">Notas</th><th class="n">Despesas pagas</th><th class="n">Entradas</th><th class="n">Transf.</th><th class="n">Ponto</th><th>Situação</th></tr>
  ${dias.map(x=>{const c=admCalc(x.S);const pp=x.S.ponto.filter(p=>p.status!=='cancelado');return `<tr class="cl" data-ad="rdia|${x.d}"><td><b>${fd(x.d).slice(0,5)}</b> ${admDiaSem(x.d)}</td><td class="n">${c.nv.length?c.nv.length+' · '+brl(c.vNotas):'—'}</td><td class="n">${c.pagas.length?brl(c.vPagas):'—'}</td><td class="n">${c.entradas.length?brl(c.vEntradas):'—'}</td><td class="n">${c.transf.length?brl(c.vTransf):'—'}</td><td class="n">${pp.length?pp.length+(c.pontoPend.length?' ⚠'+c.pontoPend.length:''):'—'}</td>
    <td>${x.n?'<span class="ok" style="margin:0">✓ com lançamentos</span>':x.sem?'<span class="badge b-can">Sem movimentação no dia</span>':x.d>hoje()?'<span class="meta">dia futuro</span>':'<span class="warn" style="margin:0">⚠ a preencher</span>'}
    ${ed&&!x.n&&x.d<=hoje()?` <label class="meta" style="white-space:nowrap" onclick="event.stopPropagation()"><input type="checkbox" data-adsem="${x.d}" ${x.sem?'checked':''} style="width:auto"> Sem movimentação no dia</label>`:''}</td></tr>`;}).join('')}</table></div>
  <h3>2. Quanto foi movimentado</h3>
  <div class="resumo">${k('notas',brl(C.vNotas),'Notas ('+C.nv.length+')')}${k('pagas',brl(C.vPagas),'Despesas pagas ('+C.pagas.length+')')}${k('aberto',brl(C.vAberto),'Em aberto',C.vAberto>0)}${k('despesas',brl(C.vDespesas),'Total de despesas')}${k('entradas',brl(C.vEntradas),'Entradas')}${k('transf',brl(C.vTransf),'Transferências')}</div>
  <h3>3. Onde está o documento</h3>
  ${admTabelaDocs(S,gestor)}
  <h3>4. O que falta resolver</h3>
  ${vazios.length?`<div class="warn">⚠ ${vazios.length} dia(s) sem lançamento e sem confirmação: ${vazios.map(x=>fd(x.d).slice(0,5)).join(', ')}</div>`:''}
  ${C.semDocMov.length+C.semDocNota.length?`<div class="warn">📎 ${C.semDocMov.length+C.semDocNota.length} lançamento(s) sem comprovante</div>`:''}
  ${C.pontoPend.length?`<div class="warn">🕒 ${C.pontoPend.length} pendência(s) de ponto</div>`:''}
  ${pendP.length?pendP.map(p=>admPendCard(p,true)).join(''):(vazios.length||C.semDocMov.length||C.semDocNota.length||C.pontoPend.length?'':'<div class="ok">Nada pendente.</div>')}
  ${ed?`<div class="campo" style="margin-top:12px"><label>Observações da Juliana</label><textarea id="adf_robs">${esc(admRel.obs[f.id]??f.obs_juliana??'')}</textarea></div>
    <div class="rodape"><button class="primary" data-ad="enviar|${f.id}">${f.status==='devolvido'?'Reenviar para conferência':'Enviar para conferência'}</button></div>`:f.obs_juliana?`<div class="total"><b>Observações da Juliana:</b> ${esc(f.obs_juliana)}</div>`:''}
  ${ADM.master&&f.status==='enviado'&&!gestor?`<div class="rodape"><button class="primary" data-ad="fech|${f.id}">Conferir este fechamento</button></div>`:''}
  </div>`;}
function admTabelaDocs(S,gestor){const L=[...S.notas.map(r=>['nota',r]),...S.movs.map(r=>['mov',r]),...S.ponto.map(r=>['ponto',r])].filter(x=>x[1].status!=='cancelado').sort((a,b)=>a[1].data_operacao.localeCompare(b[1].data_operacao));
  if(!L.length)return '<div class="meta">Nenhum lançamento no período.</div>';
  return `<div class="scroll"><table class="planilha"><tr><th>Dia</th><th>Lançamento</th><th class="n">Valor</th><th>Documento</th><th>Situação</th>${gestor?'<th></th>':''}</tr>
  ${L.map(([t,r])=>{const ds=admDocs(t,r.id),v=admValor(t,r);return `<tr><td>${fd(r.data_operacao).slice(0,5)}</td><td style="white-space:normal"><button class="link" data-ad="ver|${t}|${r.id}">${esc(admTitulo(t,r))}</button></td><td class="n">${v!=null?brl(v):''}</td>
   <td>${ds.length?ds.map(d=>`<button class="small" data-ad="doc|${d.id}">${d.tipo==='drive'?'🔗':'📄'} abrir</button>`).join(' '):'<span class="semfoto">faltando</span>'}</td><td>${admBadge(r.status)}</td>
   ${gestor?`<td>${r.status!=='devolvido'?`<button class="small danger" data-ad="dev|${t}|${r.id}">Devolver</button>`:''}</td>`:''}</tr>`;}).join('')}</table></div>`;}
function admDiaLista(f,d){const S=admSel(f.empresa_id,f.unidade_id,d,d);admLista('Lançamentos de '+fd(d),[...S.notas.map(r=>['nota',r]),...S.movs.map(r=>['mov',r]),...S.ponto.map(r=>['ponto',r])]);}
function admLigarResumo(M,f,reabrir){
  M.querySelectorAll('[data-ad^="rk|"]').forEach(el=>el.onclick=()=>admKpiAbrir(el.dataset.ad.split('|')[1],admSel(f.empresa_id,f.unidade_id,f.de,f.ate)));
  M.querySelectorAll('[data-ad^="rdia|"]').forEach(el=>el.onclick=()=>admDiaLista(f,el.dataset.ad.split('|')[1]));
  M.querySelectorAll('[data-ad^="dev|"]').forEach(b=>b.onclick=()=>{const [,t,i]=b.dataset.ad.split('|');admDevolver(t,+i,reabrir);});
}
function admConferir(fid){
  const f=ADM.fech.find(x=>x.id===+fid);if(!f)return;log('abriu','Fechamento ADM #'+fid);
  abrir(`<h2>Conferência · ${esc(admEmp(f.empresa_id).nome)}</h2><div class="sub">${esc(f.unidade_id?admUni(f.unidade_id).nome:'Todas as unidades')} · ${fd(f.de)} a ${fd(f.ate)}</div>
  ${admResumoHTML(f,ADM.master)}
  ${ADM.master&&(f.status==='enviado'||f.status==='devolvido')?`<div class="campo"><label>Observação do gestor</label><textarea id="cf_obs">${esc(f.obs_gestor||'')}</textarea></div>`:''}
  <div class="erro"></div><div class="rodape"><button id="cx">Fechar</button>${ADM.master&&f.status==='enviado'?'<button class="danger" id="cf_dev">Devolver fechamento</button><button class="primary" id="cf_ok">Aprovar fechamento</button>':''}</div>`,true);
  const M=$('modal');$('cx').onclick=fechar;admLigarResumo(M,f,()=>admConferir(fid));admLigarPendBtns(M,()=>admConferir(fid));
  if($('cf_ok'))$('cf_ok').onclick=()=>rodar($('cf_ok'),async()=>{await rpc('adm_conferir_fechamento',{p_id:f.id,p_aprovar:true,p_obs:val('cf_obs')||null});await admRecarregar();fechar();toast('Fechamento aprovado.');});
  if($('cf_dev'))$('cf_dev').onclick=()=>rodar($('cf_dev'),async()=>{const o=val('cf_obs');if(!o)throw new Error('Escreva na observação o que precisa ser ajustado.');await rpc('adm_conferir_fechamento',{p_id:f.id,p_aprovar:false,p_obs:o});await admRecarregar();fechar();toast('Fechamento devolvido para a Juliana.');});
}
function admResumoJSON(f){const S=admSel(f.empresa_id,f.unidade_id,f.de,f.ate),C=admCalc(S);
  return {notas:C.nv.length,valor_notas:C.vNotas,despesas_pagas:C.vPagas,despesas_aberto:C.vAberto,total_despesas:C.vDespesas,entradas:C.vEntradas,transferencias:C.vTransf,sem_comprovante:C.semDocMov.length+C.semDocNota.length,pendencias_ponto:C.pontoPend.length,
    dias:admDias(f.de,f.ate).map(d=>{const i=admDiaInfo(f.empresa_id,f.unidade_id,d);return {data:d,lancamentos:i.n,sem_movimentacao:i.sem};})};}

// ---------- pendências ----------
function admPendLista(){
  const L=ADM.pend.filter(p=>p.status==='aberta'||p.status==='respondida').map(p=>({...p,auto:false,responsavel:p.status==='respondida'?'iago':p.responsavel}));
  const ja=new Set(L.map(p=>p.ref_tipo+'|'+p.ref_id));
  const add=(t,r,titulo,motivo,acao)=>{if(ja.has(t+'|'+r.id))return;L.push({id:'a'+t+r.id+titulo.length,auto:true,origem:'sistema',ref_tipo:t,ref_id:r.id,empresa_id:r.empresa_id,unidade_id:r.unidade_id,titulo,motivo,acao,responsavel:'juliana',status:'aberta',criado_em:r.lancado_em});};
  ADM.notas.filter(r=>admSemDoc('nota',r)).forEach(r=>add('nota',r,'Documento faltando: '+admTitulo('nota',r),'Nota sem arquivo escaneado, XML ou link do Drive','Anexar a nota'));
  ADM.movs.filter(r=>admSemDoc('mov',r)).forEach(r=>add('mov',r,'Comprovante faltando: '+admTitulo('mov',r),'Movimentação sem comprovante','Anexar o comprovante'));
  ADM.ponto.filter(r=>r.status!=='cancelado'&&admFaltas(r).length).forEach(r=>add('ponto',r,'Ponto incompleto: '+admFunc(r.funcionario_id).nome+' · '+fd(r.data_operacao),'Falta: '+admFaltas(r).join(', '),'Completar as marcações ou encaminhar correção'));
  return L.filter(p=>!admF.emp||!p.empresa_id||p.empresa_id===+admF.emp);
}
function admPendCard(p,compacto){const r=p.ref_tipo&&['nota','mov','ponto'].includes(p.ref_tipo)?admReg(p.ref_tipo,p.ref_id):null;const venc=p.prazo&&p.prazo<hoje()&&p.status!=='resolvida';
  const podeResp=!p.auto&&p.status==='aberta'&&(ADM.eu||ADM.master)&&(p.responsavel==='juliana'||ADM.master);
  const podeRes=!p.auto&&p.status!=='resolvida'&&p.status!=='cancelada'&&(ADM.master||(p.responsavel==='juliana'&&p.origem!=='devolucao'));
  return `<div class="item"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><b>${esc(p.titulo)}</b>
    <div class="meta">${ADM_ORIG[p.origem]||p.origem} · responsável: <b>${ADM_PEND_RESP[p.responsavel]||p.responsavel}</b>${p.prazo?' · prazo '+(venc?'<b style="color:var(--red)">'+fd(p.prazo)+' (vencido)</b>':fd(p.prazo)):''} · ${p.status==='respondida'?'<span class="badge b-hoje">Respondida</span>':p.status==='resolvida'?'<span class="badge b-rec">Resolvida</span>':p.status==='cancelada'?'<span class="badge b-can">Cancelada</span>':'<span class="badge b-venc">Aberta</span>'}</div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start">${r&&!compacto?`<button class="small" data-ad="ver|${p.ref_tipo}|${p.ref_id}">Abrir lançamento</button>`:''}${p.drive_url?`<a class="btnf" href="${esc(p.drive_url)}" target="_blank" rel="noopener">🔗 Abrir no Drive</a>`:''}
    ${podeResp?`<button class="small" data-ad="presp|${p.id}">Responder</button>`:''}${podeRes?`<button class="small" data-ad="pres|${p.id}">Marcar como resolvida</button>`:''}${ADM.master&&!p.auto&&p.status==='resolvida'?`<button class="small" data-ad="preab|${p.id}">Reabrir</button>`:''}</div></div>
    ${p.motivo?`<div class="meta" style="margin-top:4px"><b>Motivo:</b> ${esc(p.motivo)}</div>`:''}${p.acao?`<div class="meta"><b>Ação:</b> ${esc(p.acao)}</div>`:''}${p.pasta||p.arquivo_nome?`<div class="meta"><b>Onde está:</b> ${esc([p.pasta,p.arquivo_nome].filter(Boolean).join(' / '))}</div>`:''}
    ${p.resposta?`<div class="ia-ok" style="margin:6px 0 0"><b>Resposta${p.respondido_em?' ('+fts(p.respondido_em)+')':''}:</b> ${esc(p.resposta)}</div>`:''}</div>`;}
function admPendAcao(a,id,b,depois){
  if(a==='presp')return admPedirTexto('Responder pendência','A resposta fica registrada e aparece para o gestor.','Sua resposta','Enviar resposta',async t=>{await rpc('adm_responder_pendencia',{p_id:id,p_resposta:t});await admRecarregar();toast('Resposta enviada.');depois?depois():fechar();});
  const st=a==='pres'?'resolvida':'aberta';const go=async()=>{try{if(b)b.disabled=true;await rpc('adm_resolver_pendencia',{p_id:id,p_status:st,p_obs:null});await admRecarregar();toast(st==='resolvida'?'Pendência resolvida.':'Pendência reaberta.');if(depois)depois();}catch(err){toast(msgErro(err));if(b)b.disabled=false;}};go();}
function admLigarPendBtns(M,depois){
  M.querySelectorAll('[data-ad^="presp|"],[data-ad^="pres|"],[data-ad^="preab|"]').forEach(b=>b.onclick=e=>{e.stopPropagation();const [a,i]=b.dataset.ad.split('|');admPendAcao(a,+i,b,depois);});
}
function admPendencias(){
  const todas=admPendLista();const res=ADM.pend.filter(p=>p.status==='resolvida'||p.status==='cancelada').filter(p=>!admF.emp||!p.empresa_id||p.empresa_id===+admF.emp);
  const L=admPF==='resolvidas'?res:admPF==='todas'?todas:todas.filter(p=>p.responsavel===admPF);
  const aud=ADM.aud;
  return `<div class="barra"><button class="primary" data-ad="npend|">+ Nova pendência</button></div>
  <div class="chips" style="margin:8px 0">${[['juliana','Depende da Juliana ('+todas.filter(p=>p.responsavel==='juliana').length+')'],['iago','Depende do Iago ('+todas.filter(p=>p.responsavel==='iago').length+')'],['todas','Todas abertas ('+todas.length+')'],['resolvidas','Resolvidas']].map(([k,l])=>`<button class="${admPF===k?'on':''}" data-ad="pendf|${k}">${l}</button>`).join('')}</div>
  <div>${L.length?L.map(p=>admPendCard(p)).join(''):'<div class="vazio">Nenhuma pendência aqui.</div>'}</div>
  <h3>Auditoria do Drive (ADM TUDO MIX - JULIANA)</h3>
  ${aud.length?`<div class="scroll"><table class="planilha"><tr><th>Arquivo</th><th>Pasta</th><th>Tipo</th><th>Empresa / unidade</th><th>Data ref.</th><th>Situação</th><th>Problema</th><th>Ação necessária</th><th>Quem resolve</th><th>Vínculo</th></tr>
  ${aud.map(a=>`<tr><td style="white-space:normal">${a.link?`<a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.nome)}</a>`:esc(a.nome)}</td><td>${esc(a.pasta||'')}</td><td>${esc(a.tipo_doc||'')}</td><td>${esc([a.empresa,a.unidade].filter(Boolean).join(' · '))}</td><td>${a.data_ref?fd(a.data_ref):''}</td><td>${esc(a.situacao||'')}</td><td style="white-space:normal">${esc(a.problema||'')}</td><td style="white-space:normal">${esc(a.acao||'')}</td><td>${esc(a.responsavel||'')}</td>
   <td>${a.ref_tipo?`<button class="link" data-ad="ver|${a.ref_tipo}|${a.ref_id}">${esc(admTitulo(a.ref_tipo,admReg(a.ref_tipo,a.ref_id)))}</button>`:`<button class="small" data-ad="vinc|${a.id}">Vincular</button>`}</td></tr>`).join('')}</table></div>`
  :'<div class="vazio">A auditoria ainda não foi feita. Assim que a Juliana terminar de subir os arquivos na pasta do Drive, o inventário aparece aqui com cada pendência.</div>'}`;}
function admNovaPend(){const emps=admEmpsAtivas();
  abrir(`<h2>Nova pendência</h2><div class="campo"><label>Título</label><input id="np_t"></div><div class="campo"><label>Motivo</label><textarea id="np_m"></textarea></div><div class="campo"><label>Ação necessária</label><input id="np_a"></div>
  <div class="tres"><div class="campo"><label>Quem resolve</label><select id="np_r"><option value="juliana">Juliana</option><option value="iago" ${ADM.master?'':'selected'}>Iago (gestor)</option></select></div><div class="campo"><label>Prazo</label><input id="np_p" type="date"></div><div class="campo"><label>Empresa</label><select id="np_e">${admOpts(emps,admF.emp,'—')}</select></div></div>
  <div class="campo"><label>Link do Drive (opcional)</label><input id="np_l"></div>
  <div class="erro"></div><div class="rodape"><button id="cx">Voltar</button><button class="primary" id="ok">Salvar</button></div>`);
  $('cx').onclick=fechar;$('ok').onclick=()=>rodar($('ok'),async()=>{await rpc('adm_salvar_pendencia',{p_id:null,p_dados:{titulo:val('np_t'),motivo:val('np_m'),acao:val('np_a'),responsavel:val('np_r'),prazo:val('np_p'),empresa_id:val('np_e'),drive_url:val('np_l')}});await admRecarregar();fechar();toast('Pendência criada.');});}
function admVincular(aid){const a=ADM.aud.find(x=>x.id===+aid);if(!a)return;
  const regs=[...ADM.notas.map(r=>['nota',r]),...ADM.movs.map(r=>['mov',r]),...ADM.ponto.map(r=>['ponto',r])].filter(x=>x[1].status!=='cancelado');
  abrir(`<h2>Vincular arquivo do Drive</h2><div class="sub">${esc(a.nome)}</div><div class="campo"><label>Lançamento</label><select id="vi_r"><option value="">Escolha…</option>${regs.map(([t,r])=>`<option value="${t}|${r.id}">${fd(r.data_operacao)} · ${esc(admTitulo(t,r))}${admValor(t,r)!=null?' · '+brl(admValor(t,r)):''}</option>`).join('')}</select></div>
  <div class="erro"></div><div class="rodape"><button id="cx">Voltar</button><button class="primary" id="ok">Vincular</button></div>`);
  $('cx').onclick=fechar;$('ok').onclick=()=>rodar($('ok'),async()=>{const [t,i]=(val('vi_r')||'|').split('|');if(!t)throw new Error('Escolha o lançamento.');await rpc('adm_auditoria_vincular',{p_id:a.id,p_ref_tipo:t,p_ref_id:+i,p_situacao:'Vinculado'});await admRecarregar();fechar();toast('Arquivo vinculado ao lançamento.');});}

// ---------- configurações (gestor) ----------
function admConfig(){
  const subs=[['acessos','Acessos'],['cad','Empresas e unidades'],['func','Funcionários'],['hist','Histórico de alterações']];
  const nav=`<div class="chips" style="margin:10px 0">${subs.map(([k,l])=>`<button class="${admCfg===k?'on':''}" data-ad="cfg|${k}">${l}</button>`).join('')}</div>`;
  if(admCfg==='cad')return nav+`<div class="barra"><input id="cf_en" placeholder="Nova empresa"><input id="cf_ec" placeholder="CNPJ (opcional)" style="max-width:200px"><button class="primary" data-ad="nemp|">Adicionar empresa</button></div>
    ${ADM.emp.map(e=>`<div class="card" style="flex-direction:column;align-items:stretch"><div style="display:flex;justify-content:space-between;gap:8px"><div class="t">${esc(e.nome)} ${e.cnpj?'<span class="meta">· '+esc(e.cnpj)+'</span>':''} ${e.ativa?'':'<span class="badge b-can">inativa</span>'}</div><button class="small" data-ad="remp|${e.id}">Editar</button></div>
      <div class="meta">${ADM.uni.filter(u=>u.empresa_id===e.id).map(u=>`<button class="small" data-ad="runi|${u.id}">${esc(u.nome)}${u.ativa?'':' (inativa)'}</button>`).join(' ')} <button class="small" data-ad="nuni|${e.id}">+ Unidade</button></div></div>`).join('')}`;
  if(admCfg==='func')return nav+`<div class="barra"><button class="primary" data-ad="func|">+ Funcionário</button></div><div class="lista">${ADM.func.map(f=>`<div class="card click" data-ad="func|${f.id}"><div><div class="t">${esc(f.nome)} ${f.ativo?'':'<span class="badge b-can">inativo</span>'}</div><div class="meta">${esc(admEmp(f.empresa_id).nome)} · ${esc(admUni(f.unidade_id).nome)}${f.obs?' · '+esc(f.obs):''}</div></div></div>`).join('')||'<div class="vazio">Nenhum funcionário.</div>'}</div>`;
  if(admCfg==='hist'){const q=norm(admHistQ);const H=ADM.hist.filter(h=>!q||norm([h.ref_tipo,h.ref_id,h.campo,h.antes,h.depois,h.justificativa,admPessoa(h.user_id)].join(' ')).includes(q)).slice(0,500);
    return nav+`<div class="barra"><input id="adf_hq" type="search" placeholder="Filtrar histórico…" value="${esc(admHistQ)}"></div><div class="scroll"><table class="planilha"><tr><th>Quando</th><th>Quem</th><th>Registro</th><th>Campo</th><th>Antes</th><th>Depois</th><th>Justificativa</th></tr>
    ${H.map(h=>`<tr><td>${fts(h.em)}</td><td>${esc(admPessoa(h.user_id))}</td><td>${['nota','mov','ponto'].includes(h.ref_tipo)?`<button class="link" data-ad="ver|${h.ref_tipo}|${h.ref_id}">${ADM_TIPO[h.ref_tipo]} #${h.ref_id}</button>`:esc(h.ref_tipo+' #'+h.ref_id)}</td><td>${esc(h.campo||'')}</td><td style="white-space:normal;max-width:220px">${esc(h.antes??'')}</td><td style="white-space:normal;max-width:220px">${esc(h.depois??'')}</td><td style="white-space:normal">${esc(h.justificativa||'')}</td></tr>`).join('')}</table></div>`;}
  return nav+`<div class="card" style="flex-direction:column;align-items:stretch"><div class="t">Dar acesso à página ADM</div>
    <div class="meta">A pessoa recebe um e-mail com o link de acesso e cria a própria senha. Ela entra direto na página ADM TudoMix, sem ver estoque, custos ou outras áreas. Pode cadastrar, anexar, salvar rascunhos, enviar relatórios e responder pendências — nunca excluir.</div>
    <div class="duas"><div class="campo"><label>Nome</label><input id="ac_nome"></div><div class="campo"><label>E-mail</label><input id="ac_email" type="email"></div></div>
    <div class="meta">Empresas autorizadas (nenhuma marcada = todas):</div><div class="ccs" id="ac_emps">${ADM.emp.map(e=>`<button type="button" data-acsel="${e.id}">${esc(e.nome)}</button>`).join('')}</div>
    <div class="meta" style="margin-top:6px">Unidades autorizadas (nenhuma marcada = todas):</div><div class="ccs" id="ac_unis">${ADM.uni.map(u=>`<button type="button" data-acsel="${u.id}">${esc(admEmp(u.empresa_id).nome+' · '+u.nome)}</button>`).join('')}</div>
    <div class="rodape" style="justify-content:flex-start"><button class="primary" data-ad="acsalvar|">Salvar acesso e enviar convite</button></div></div>
  <div class="lista">${ADM.acessos.map(a=>`<div class="card"><div><div class="t">${esc(a.nome)} ${a.ativo?'<span class="badge b-rec">Ativo</span>':'<span class="badge b-can">Desativado</span>'}</div>
    <div class="meta">${esc(a.email)} · ${a.user_id?'conta criada':'ainda não entrou (convite pendente)'} · Empresas: ${a.empresas&&a.empresas.length?a.empresas.map(i=>esc(admEmp(i).nome)).join(', '):'todas'} · Unidades: ${a.unidades&&a.unidades.length?a.unidades.map(i=>esc(admUni(i).nome)).join(', '):'todas'}</div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start"><button class="small" data-ad="aced|${a.id}">Editar</button>${a.ativo?`<button class="small" data-ad="acconv|${a.id}">Reenviar convite</button><button class="small danger" data-ad="acat|${a.id}|0">Desativar</button>`:`<button class="small" data-ad="acat|${a.id}|1">Reativar</button>`}</div></div>`).join('')||'<div class="vazio">Nenhum acesso criado.</div>'}</div>
  <div class="meta" style="margin-top:10px"><b>Você (Iago)</b> é o administrador master: vê todos os registros, confere documentos, aprova fechamentos, devolve itens e consulta o histórico.</div>`;}
function admEdCad(tipo,id,empresa){const e=tipo==='empresa'?ADM.emp.find(x=>x.id===id):ADM.uni.find(x=>x.id===id)||{empresa_id:empresa,ativa:true};
  abrir(`<h2>${id?'Editar':'Nova'} ${tipo}</h2><div class="campo"><label>Nome</label><input id="ce_n" value="${esc(e&&e.nome||'')}"></div>
  ${tipo==='empresa'?`<div class="campo"><label>CNPJ</label><input id="ce_c" value="${esc(e.cnpj||'')}"></div>`:`<div class="campo"><label>Empresa</label><select id="ce_e">${admOpts(ADM.emp,e.empresa_id)}</select></div>`}
  ${id?`<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" id="ce_a" style="width:18px;height:18px" ${e.ativa?'checked':''}> Ativa</label>`:''}
  <div class="erro"></div><div class="rodape"><button id="cx">Voltar</button><button class="primary" id="ok">Salvar</button></div>`);
  $('cx').onclick=fechar;$('ok').onclick=()=>rodar($('ok'),async()=>{await rpc('adm_salvar_cadastro',{p_tipo:tipo,p_id:id||null,p_dados:{nome:val('ce_n'),cnpj:tipo==='empresa'?val('ce_c'):undefined,empresa_id:tipo==='unidade'?val('ce_e'):undefined,ativa:$('ce_a')?$('ce_a').checked:true}});await admRecarregar();fechar();toast('Cadastro salvo.');});}
async function admSalvarAcesso(a,ativo,convite){
  await rpc('adm_definir_acesso',{p_email:a.email,p_nome:a.nome,p_empresas:a.empresas&&a.empresas.length?a.empresas:null,p_unidades:a.unidades&&a.unidades.length?a.unidades:null,p_ativo:ativo});
  let aviso='';if(convite&&ativo){try{await e19EnviarConvite(a.email,a.nome);}catch(err){aviso=' Convite não enviado agora ('+msgErro(err)+'). Use "Reenviar convite" em alguns minutos.';}}
  await carregar();toast((ativo?'Acesso salvo para '+a.nome+'.':'Acesso desativado.')+(convite&&ativo&&!aviso?' Convite enviado para '+a.email+'.':aviso));}
function admEditarAcesso(id){const a=ADM.acessos.find(x=>x.id===+id);if(!a)return;
  abrir(`<h2>Acesso de ${esc(a.nome)}</h2><div class="sub">${esc(a.email)}</div><div class="campo"><label>Nome</label><input id="ea_n" value="${esc(a.nome)}"></div>
  <div class="meta">Empresas (nenhuma = todas):</div><div class="ccs">${ADM.emp.map(e=>`<button type="button" class="${(a.empresas||[]).map(Number).includes(e.id)?'on':''}" data-ea="e|${e.id}">${esc(e.nome)}</button>`).join('')}</div>
  <div class="meta" style="margin-top:6px">Unidades (nenhuma = todas):</div><div class="ccs">${ADM.uni.map(u=>`<button type="button" class="${(a.unidades||[]).map(Number).includes(u.id)?'on':''}" data-ea="u|${u.id}">${esc(admEmp(u.empresa_id).nome+' · '+u.nome)}</button>`).join('')}</div>
  <div class="erro"></div><div class="rodape"><button id="cx">Voltar</button><button class="primary" id="ok">Salvar</button></div>`);
  const M=$('modal');M.querySelectorAll('[data-ea]').forEach(b=>b.onclick=()=>b.classList.toggle('on'));$('cx').onclick=fechar;
  $('ok').onclick=()=>rodar($('ok'),async()=>{const sel=k=>[...M.querySelectorAll('[data-ea^="'+k+'|"].on')].map(b=>+b.dataset.ea.split('|')[1]);await admSalvarAcesso({...a,nome:val('ea_n'),empresas:sel('e'),unidades:sel('u')},a.ativo,false);fechar();});}

// ---------- eventos ----------
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-ad],[data-acsel]');if(!t||!$('app').contains(t)&&!$('modal').contains(t))return;
  if(t.dataset.acsel){t.classList.toggle('on');return;}
  const [a,x,y]=t.dataset.ad.split('|');
  if(a==='doc'){admAbrirDoc(+x);return;}
  if(a==='ver'){admVer(x,+y);return;}
  if($('modal').contains(t))return;
  if(a==='rk'||a==='rdia'){const f=admFechAtual();if(!f)return;if(a==='rk')admKpiAbrir(x,admSel(f.empresa_id,f.unidade_id,f.de,f.ate));else admDiaLista(f,x);return;}
  if(a==='presp'||a==='pres'||a==='preab'){admPendAcao(a,+x,t,null);return;}
  if(a==='sub'){admSub=x;admQ='';log('aba','ADM · '+t.textContent.trim());render();window.scrollTo(0,0);return;}
  if(a==='per'){const h=hoje();if(x==='hoje'){admF.de=h;admF.ate=h;}if(x==='sem'){[admF.de,admF.ate]=admSemana(h);}if(x==='ant'){const d=admDt(h);d.setDate(d.getDate()-7);[admF.de,admF.ate]=admSemana(admIso(d));}if(x==='mes'){admF.de=h.slice(0,8)+'01';const d=admDt(admF.de);d.setMonth(d.getMonth()+1);d.setDate(0);admF.ate=admIso(d);}render();return;}
  if(a==='kpi'){admKpiAbrir(x);return;}
  if(a==='novo'){admForm(x,null);return;}
  if(a==='movf'){admMovF=x;render();return;}
  if(a==='pendf'){admPF=x;admSub='pend';render();return;}
  if(a==='func'){admFuncForm(x?+x:null);return;}
  if(a==='npend'){admNovaPend();return;}
  if(a==='vinc'){admVincular(+x);return;}
  if(a==='rtipo'){admRel.tipo=x;render();return;}
  if(a==='fech'){admConferir(+x);return;}
  if(a==='cfg'){admCfg=x;render();return;}
  if(a==='nemp'){t.disabled=true;try{await rpc('adm_salvar_cadastro',{p_tipo:'empresa',p_id:null,p_dados:{nome:val('cf_en'),cnpj:val('cf_ec')}});await admRecarregar();toast('Empresa adicionada.');}catch(err){toast(msgErro(err));t.disabled=false;}return;}
  if(a==='remp'){admEdCad('empresa',+x);return;}
  if(a==='runi'){admEdCad('unidade',+x);return;}
  if(a==='nuni'){admEdCad('unidade',null,+x);return;}
  if(a==='aced'){admEditarAcesso(+x);return;}
  if(a==='gerar'){const [de,ate]=admPeriodoRel();const emps=admEmpsAtivas();const emp=admF.emp||(emps.length===1?emps[0].id:'');t.disabled=true;
    try{await rpc('adm_gerar_fechamento',{p_tipo:admRel.tipo,p_emp:+emp,p_uni:+admF.uni||null,p_de:de,p_ate:ate});await admRecarregar();toast('Resumo gerado. Revise e envie para conferência.');}catch(err){toast(msgErro(err));t.disabled=false;}return;}
  if(a==='enviar'){const f=ADM.fech.find(z=>z.id===+x);const obs=val('adf_robs');
    const vaz=admDias(f.de,f.ate).filter(d=>d<=hoje()).filter(d=>{const i=admDiaInfo(f.empresa_id,f.unidade_id,d);return !i.n&&!i.sem;});
    const go=async()=>{await rpc('adm_enviar_fechamento',{p_id:f.id,p_obs:obs||null,p_resumo:admResumoJSON(f)});delete admRel.obs[f.id];await admRecarregar();toast('Fechamento enviado para conferência do Iago.');};
    if(vaz.length){confirmar('Há dias sem lançamento','Os dias '+vaz.map(d=>fd(d).slice(0,5)).join(', ')+' não têm lançamento nem confirmação de "Sem movimentação no dia". Enviar mesmo assim? O Iago verá esses dias como "a preencher".','Enviar mesmo assim',go);return;}
    t.disabled=true;try{await go();}catch(err){toast(msgErro(err));t.disabled=false;}return;}
  if(a==='acsalvar'){const nome=val('ac_nome'),email=val('ac_email').toLowerCase();if(!nome||!email){toast('Informe nome e e-mail.');return;}
    const sel=id=>[...$(id).querySelectorAll('.on')].map(b=>+b.dataset.acsel);t.disabled=true;try{await admSalvarAcesso({nome,email,empresas:sel('ac_emps'),unidades:sel('ac_unis')},true,true);}catch(err){toast(msgErro(err));t.disabled=false;}return;}
  if(a==='acconv'){const ac=ADM.acessos.find(z=>z.id===+x);t.disabled=true;try{await e19EnviarConvite(ac.email,ac.nome);toast('Convite reenviado para '+ac.email+'.');}catch(err){toast(msgErro(err));}t.disabled=false;return;}
  if(a==='acat'){const ac=ADM.acessos.find(z=>z.id===+x);const go=()=>admSalvarAcesso(ac,y==='1',false);if(y==='0')return confirmar('Desativar acesso','Desativar o acesso de '+ac.nome+' à página ADM? Ela deixa de entrar imediatamente. Os lançamentos dela continuam guardados.','Desativar',go);
    t.disabled=true;try{await go();}catch(err){toast(msgErro(err));t.disabled=false;}return;}
});
document.addEventListener('change',async e=>{const id=e.target.id||'';if(!$('app').contains(e.target))return;
  if(id==='adf_emp'){admF.emp=e.target.value;admF.uni='';render();return;}
  if(id==='adf_uni'){admF.uni=e.target.value;render();return;}
  if(id==='adf_de'||id==='adf_ate'){admF[id==='adf_de'?'de':'ate']=e.target.value;if(admF.de&&admF.ate&&admF.ate<admF.de)admF.ate=admF.de;render();return;}
  if(id==='adf_func'){admPontoF=e.target.value;render();return;}
  if(id==='adf_rdata'){admRel.data=e.target.value||hoje();render();return;}
  if(e.target.dataset&&e.target.dataset.adsem){const [de,ate]=admPeriodoRel();const emps=admEmpsAtivas();const emp=admF.emp||(emps.length===1?emps[0].id:'');
    try{await rpc('adm_marcar_dia',{p_emp:+emp,p_uni:+admF.uni||null,p_data:e.target.dataset.adsem,p_sem:e.target.checked});await admRecarregar();}catch(err){toast(msgErro(err));await admRecarregar();}}
});
document.addEventListener('input',e=>{const id=e.target.id||'';if(!$('app').contains(e.target))return;
  if(id==='adf_robs'){const f=admFechAtual();if(f)admRel.obs[f.id]=e.target.value;return;}
  if(id==='adf_q'||id==='adf_hq'){if(id==='adf_q')admQ=e.target.value;else admHistQ=e.target.value;const p=e.target.selectionStart;render();const b=$(id);if(b){b.focus();b.setSelectionRange(p,p);}}
});
