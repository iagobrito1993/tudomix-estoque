// ================= Nota fiscal (Focus NFe) =================
// Fase 1: NF de remessa a partir de uma saída (ex.: envio para o Full).
// Só administrador. A emissão passa pela Edge Function "focus-nfe" (o token da Focus nunca fica no site).
let NFE={ok:false,emit:[],dest:[],fisc:[],notas:[]};
const NFE_ST={enviando:['Enviando','b-hoje'],processando:['Processando na Sefaz','b-hoje'],autorizada:['Autorizada','b-rec'],erro:['Erro','b-venc'],denegada:['Denegada','b-venc'],cancelada:['Cancelada','b-can']};
const NFE_REG={simples:'Simples Nacional',simples_excesso:'Simples – excesso de sublimite',normal:'Regime normal (Lucro Presumido/Real)'};
const NFE_ORIG={'0':'0 – Nacional','1':'1 – Estrangeira (importação direta)','2':'2 – Estrangeira (adquirida no mercado interno)','3':'3 – Nacional, mais de 40% importado','4':'4 – Nacional, processo produtivo básico','5':'5 – Nacional, até 40% importado','6':'6 – Estrangeira (importação direta, sem similar)','7':'7 – Estrangeira (mercado interno, sem similar)','8':'8 – Nacional, mais de 70% importado'};

async function nfeCarregar(){
  if(!ehAdmin()){NFE.ok=false;return;}
  try{
    const q=t=>sb.from(t).select('*').then(r=>{if(r.error)throw r.error;return r.data;});
    const [emit,dest,fisc,notas]=await Promise.all([q('nfe_emitentes'),q('nfe_destinatarios'),tudo(()=>sb.from('produtos_fiscal').select('*')),
      sb.from('nfe_notas').select('*').order('id',{ascending:false}).limit(2000).then(r=>{if(r.error)throw r.error;return r.data;})]);
    NFE={ok:true,emit,dest,fisc,notas};
  }catch(e){console.warn('NF-e ainda não configurada no banco:',e&&e.message);NFE={ok:false,emit:[],dest:[],fisc:[],notas:[]};}
}
function nfeEmit(contaId){return NFE.emit.find(e=>e.conta_id===contaId)||null;}
function nfeFisc(pid){return NFE.fisc.find(f=>f.produto_id===pid)||null;}
function nfeBadge(n){const s=NFE_ST[n.status]||[n.status,'b-can'];return `<span class="badge ${s[1]}">${s[0]}</span>`;}
function nfeCnpj(c){c=String(c||'').replace(/\D/g,'');return c.length===14?c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):c;}
function nfeAviso(){return '<div class="warn">A nota fiscal ainda não foi ativada no banco de dados. Rode o arquivo <b>sql/nfe.sql</b> no Supabase e publique a função <b>focus-nfe</b>.</div>';}
async function nfeChamar(acao,corpo){
  const {data,error}=await sb.functions.invoke('focus-nfe',{body:{acao,...corpo}});
  if(error){let m=error.message;try{const j=await error.context.json();if(j&&j.erro)m=j.erro;}catch(e){}throw new Error(m);}
  if(data&&data.erro)throw new Error(data.erro);
  return data||{};
}

// ---------- dados fiscais da empresa de cada conta ----------
function nfeModalEmitente(contaId){
  if(!NFE.ok){abrir(`<h2>Dados fiscais</h2>${nfeAviso()}<div class="rodape"><button id="cx">Fechar</button></div>`);$('cx').onclick=fechar;return;}
  const c=conta(contaId),e=nfeEmit(contaId)||{regime:'simples',ambiente:'homologacao',natureza_remessa:'Remessa para depósito',pis_cst:'49',cofins_cst:'49'};
  const opt=(o,v)=>Object.entries(o).map(([k,l])=>`<option value="${k}" ${v===k?'selected':''}>${l}</option>`).join('');
  abrir(`<h2>Dados fiscais · ${esc(c.nome)}</h2><div class="sub">Empresa (CNPJ) que emite a nota das saídas desta conta. Os códigos fiscais (CFOP, CST/CSOSN) devem ser os que o seu contador indicar.</div>
  <div class="duas"><div class="campo"><label>CNPJ</label><input id="fe_cnpj" value="${esc(nfeCnpj(e.cnpj))}"></div><div class="campo"><label>Razão social</label><input id="fe_rz" value="${esc(e.razao_social||'')}"></div></div>
  <div class="tres"><div class="campo"><label>Inscrição estadual</label><input id="fe_ie" value="${esc(e.ie||'')}"></div><div class="campo"><label>UF</label><input id="fe_uf" maxlength="2" value="${esc(e.uf||'')}"></div>
    <div class="campo"><label>Regime</label><select id="fe_reg">${opt(NFE_REG,e.regime)}</select></div></div>
  <h3>Remessa (envio para o Full / depósito)</h3>
  <div class="campo"><label>Natureza da operação</label><input id="fe_nat" value="${esc(e.natureza_remessa||'')}"></div>
  <div class="duas"><div class="campo"><label>CFOP dentro do estado</label><input id="fe_cfi" inputmode="numeric" maxlength="4" value="${esc(e.cfop_interno||'')}"></div><div class="campo"><label>CFOP para outro estado</label><input id="fe_cfe" inputmode="numeric" maxlength="4" value="${esc(e.cfop_interestadual||'')}"></div></div>
  <div class="tres"><div class="campo"><label>ICMS (CSOSN no Simples / CST)</label><input id="fe_icms" inputmode="numeric" maxlength="3" value="${esc(e.icms_cst||'')}"></div><div class="campo"><label>CST PIS</label><input id="fe_pis" inputmode="numeric" maxlength="2" value="${esc(e.pis_cst||'')}"></div><div class="campo"><label>CST COFINS</label><input id="fe_cof" inputmode="numeric" maxlength="2" value="${esc(e.cofins_cst||'')}"></div></div>
  <div class="campo"><label>Informações complementares (saem em toda nota)</label><textarea id="fe_inf" rows="2">${esc(e.info_complementar||'')}</textarea></div>
  <h3>Focus NFe</h3>
  <div class="campo"><label>Ambiente de emissão</label><select id="fe_amb"><option value="homologacao" ${e.ambiente!=='producao'?'selected':''}>Homologação (teste, sem valor fiscal)</option><option value="producao" ${e.ambiente==='producao'?'selected':''}>Produção (nota real)</option></select></div>
  <div class="duas"><div class="campo"><label>Token de homologação ${e.tem_token_homolog?'✅ cadastrado':''}</label><input id="fe_th" type="password" autocomplete="off" placeholder="${e.tem_token_homolog?'deixe vazio para manter':'cole o token'}"></div>
    <div class="campo"><label>Token de produção ${e.tem_token_prod?'✅ cadastrado':''}</label><input id="fe_tp" type="password" autocomplete="off" placeholder="${e.tem_token_prod?'deixe vazio para manter':'cole o token'}"></div></div>
  <div class="meta">Os tokens ficam guardados só no banco e não aparecem mais no site depois de salvos.</div>
  <div class="erro"></div><div class="rodape"><button id="cx">Voltar</button><button class="primary" id="ok">Salvar</button></div>`,true);
  $('cx').onclick=fechar;
  $('ok').onclick=()=>rodar($('ok'),async()=>{
    if($('fe_amb').value==='producao'&&!e.tem_token_prod&&!val('fe_tp'))throw new Error('Para emitir em produção, cole o token de produção.');
    const id=await rpc('nfe_salvar_emitente',{p:{conta_id:contaId,cnpj:val('fe_cnpj'),razao_social:val('fe_rz'),ie:val('fe_ie'),uf:val('fe_uf'),regime:$('fe_reg').value,
      ambiente:$('fe_amb').value,natureza_remessa:val('fe_nat'),cfop_interno:val('fe_cfi'),cfop_interestadual:val('fe_cfe'),icms_cst:val('fe_icms'),pis_cst:val('fe_pis'),cofins_cst:val('fe_cof'),info_complementar:val('fe_inf')}});
    if(val('fe_th'))await rpc('nfe_salvar_token',{p_emitente:id,p_ambiente:'homologacao',p_token:val('fe_th')});
    if(val('fe_tp'))await rpc('nfe_salvar_token',{p_emitente:id,p_ambiente:'producao',p_token:val('fe_tp')});
    await nfeCarregar();fechar();render();toast('Dados fiscais salvos.');});
}

// ---------- dados fiscais do produto ----------
function nfeModalProduto(pid,voltar){
  const p=produto(pid),f=nfeFisc(pid)||{origem:'0',unidade:'UN'};
  if(!NFE.ok){abrir(`<h2>Dados fiscais</h2>${nfeAviso()}<div class="rodape"><button id="cx">Voltar</button></div>`);$('cx').onclick=voltar||fechar;return;}
  abrir(`<h2>Dados fiscais</h2><div class="sub">${esc(p.nome)}${p.sku?' · SKU '+esc(p.sku):''}</div>
  <div class="tres"><div class="campo"><label>NCM (8 dígitos)</label><input id="pf_ncm" inputmode="numeric" maxlength="10" value="${esc(f.ncm||'')}"></div><div class="campo"><label>CEST (se houver)</label><input id="pf_cest" inputmode="numeric" maxlength="9" value="${esc(f.cest||'')}"></div><div class="campo"><label>Unidade</label><input id="pf_un" maxlength="6" value="${esc(f.unidade||'UN')}"></div></div>
  <div class="campo"><label>Origem da mercadoria</label><select id="pf_or">${Object.entries(NFE_ORIG).map(([k,l])=>`<option value="${k}" ${String(f.origem)===k?'selected':''}>${l}</option>`).join('')}</select></div>
  <div class="meta">Dica: o NCM costuma vir na nota do fornecedor (campo NCM de cada item).</div>
  <div class="erro"></div><div class="rodape"><button id="cx">Voltar</button><button class="primary" id="ok">Salvar</button></div>`);
  $('cx').onclick=voltar||fechar;
  $('ok').onclick=()=>rodar($('ok'),async()=>{const ncm=val('pf_ncm').replace(/\D/g,'');if(ncm&&ncm.length!==8)throw new Error('O NCM tem 8 dígitos.');
    await rpc('nfe_salvar_fiscal_produto',{p_produto:pid,p_ncm:ncm,p_cest:val('pf_cest'),p_origem:$('pf_or').value,p_unidade:val('pf_un')});await nfeCarregar();toast('Dados fiscais salvos.');(voltar||fechar)();});
}

// ---------- destinatário (ex.: centro de distribuição do Full) ----------
function nfeModalDestinatario(id,voltar){
  const d=NFE.dest.find(x=>x.id===id)||{};
  const c=(k,l,v,x='')=>`<div class="campo"><label>${l}</label><input id="nd_${k}" value="${esc(v||'')}" ${x}></div>`;
  abrir(`<h2>${d.id?'Editar':'Novo'} destinatário</h2><div class="sub">Use os dados que o Mercado Livre mostra no agendamento do envio Full (CNPJ, IE e endereço do centro de distribuição).</div>
  ${c('ap','Apelido (ex.: Full Cajamar SP04)',d.apelido)}
  <div class="duas">${c('nome','Razão social',d.nome)}${c('cnpj','CNPJ',nfeCnpj(d.cnpj))}</div>
  <div class="tres">${c('ie','Inscrição estadual',d.ie)}${c('cep','CEP',d.cep,'inputmode="numeric"')}${c('uf','UF',d.uf,'maxlength="2"')}</div>
  <div class="tres">${c('log','Logradouro',d.logradouro)}${c('num','Número',d.numero)}${c('comp','Complemento',d.complemento)}</div>
  <div class="duas">${c('bai','Bairro',d.bairro)}${c('mun','Município',d.municipio)}</div>
  <div class="erro"></div><div class="rodape"><button id="cx">Voltar</button><button class="primary" id="ok">Salvar</button></div>`,true);
  $('cx').onclick=voltar;
  $('ok').onclick=()=>rodar($('ok'),async()=>{const v={id:d.id||null,apelido:val('nd_ap'),nome:val('nd_nome'),cnpj:val('nd_cnpj'),ie:val('nd_ie'),cep:val('nd_cep'),uf:val('nd_uf'),
      logradouro:val('nd_log'),numero:val('nd_num'),complemento:val('nd_comp'),bairro:val('nd_bai'),municipio:val('nd_mun')};
    for(const [k,l] of [['apelido','apelido'],['nome','razão social'],['cnpj','CNPJ'],['logradouro','logradouro'],['numero','número'],['bairro','bairro'],['municipio','município'],['uf','UF'],['cep','CEP']])if(!v[k])throw new Error('Preencha: '+l+'.');
    if(String(v.cnpj).replace(/\D/g,'').length!==14)throw new Error('CNPJ do destinatário inválido.');
    const nid=await rpc('nfe_salvar_destinatario',{p:v});await nfeCarregar();toast('Destinatário salvo.');voltar(nid);});
}

// ---------- quadro "Nota fiscal" no detalhe da saída ----------
function nfeBoxSaida(s){
  if(!ehAdmin())return '';
  if(!NFE.ok)return `<h3>Nota fiscal</h3>${nfeAviso()}`;
  const ns=NFE.notas.filter(n=>n.saida_id===s.id);const em=nfeEmit(s.conta_id);
  const temAtiva=ns.some(n=>['enviando','processando','autorizada'].includes(n.status));
  return `<h3>Nota fiscal</h3>
  ${ns.map(n=>`<div class="card" style="margin-bottom:6px"><div><div class="t">${n.numero?'NF '+esc(n.numero)+(n.serie?' série '+esc(n.serie):''):'NF (sem número ainda)'} ${nfeBadge(n)} ${n.ambiente==='homologacao'?'<span class="badge b-can">Teste</span>':''}</div>
    <div class="meta">${fts(n.criado_em)} · ${brl(n.valor_total)}${n.chave?'<br>Chave '+esc(n.chave):''}${n.mensagem&&n.status!=='autorizada'?'<br>'+esc(n.mensagem):''}${n.cancelado_motivo?'<br>Cancelada: '+esc(n.cancelado_motivo):''}</div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${n.danfe_url?`<a href="${esc(n.danfe_url)}" target="_blank" rel="noopener"><button class="small">DANFE</button></a>`:''}${n.xml_url?`<a href="${esc(n.xml_url)}" target="_blank" rel="noopener"><button class="small">XML</button></a>`:''}
      ${['enviando','processando'].includes(n.status)||(!n.numero&&n.status!=='erro')?`<button class="small" data-nfecons="${n.id}">Atualizar</button>`:''}${n.status==='autorizada'?`<button class="small danger" data-nfecanc="${n.id}">Cancelar NF</button>`:''}</div></div>`).join('')||'<div class="meta">Nenhuma nota emitida para esta saída.</div>'}
  ${s.status==='ativa'&&!temAtiva?`<button class="small primary" id="nfe_emitir" style="margin-top:8px">🧾 Emitir NF de remessa</button>${em?` <span class="meta">por ${esc(em.razao_social)} · ${em.ambiente==='producao'?'produção':'homologação (teste)'}</span>`:' <span class="meta">(preencha antes os dados fiscais da conta)</span>'}`:''}`;
}
function nfeLigarSaida(s){
  if(!ehAdmin()||!NFE.ok)return;
  const reabrir=()=>modalDetalheSaida(s.id);
  if($('nfe_emitir'))$('nfe_emitir').onclick=()=>{if(!nfeEmit(s.conta_id))return nfeModalEmitente(s.conta_id);nfeModalEmitir(s);};
  $('modal').querySelectorAll('[data-nfecons]').forEach(b=>b.onclick=()=>rodar(b,async()=>{await nfeChamar('consultar',{nota_id:+b.dataset.nfecons});await nfeCarregar();toast('Situação atualizada.');reabrir();}));
  $('modal').querySelectorAll('[data-nfecanc]').forEach(b=>b.onclick=()=>{const n=NFE.notas.find(x=>x.id===+b.dataset.nfecanc);
    abrir(`<h2>Cancelar NF ${esc(n.numero||'')}</h2><div class="sub">O cancelamento vai para a Sefaz e não tem volta. Em geral só é aceito até 24 horas depois da autorização.</div>
    <div class="campo"><label>Justificativa (mínimo 15 caracteres)</label><textarea id="nc_j" rows="2"></textarea></div>
    <div class="erro"></div><div class="rodape"><button id="cx">Voltar</button><button class="danger" id="ok">Cancelar a nota</button></div>`);
    $('cx').onclick=reabrir;$('ok').onclick=()=>rodar($('ok'),async()=>{await nfeChamar('cancelar',{nota_id:n.id,justificativa:val('nc_j')});await nfeCarregar();toast('Nota cancelada.');reabrir();});});
}

// ---------- emitir ----------
let nfeRasc=null;
function nfeModalEmitir(s,destSel){
  const em=nfeEmit(s.conta_id);const reabrir=()=>modalDetalheSaida(s.id);
  if(!nfeRasc||nfeRasc.sid!==s.id)nfeRasc={sid:s.id,dest:'',obs:'',itens:itensSaida(s).map(i=>{const c=um(i.saida_itens_custo);const p=produto(i.produto_id);return {pid:i.produto_id,qtd:i.qtd,valor:c?+c.custo_medio:custo(p)};})};
  if(destSel)nfeRasc.dest=String(destSel);
  const R=nfeRasc;const semNcm=R.itens.filter(i=>!/^\d{8}$/.test((nfeFisc(i.pid)||{}).ncm||''));
  const tot=R.itens.reduce((a,i)=>a+i.qtd*(+i.valor||0),0);
  abrir(`<h2>Emitir NF de remessa · Saída #${s.id}</h2><div class="sub">Emitente: <b>${esc(em.razao_social)}</b> (${esc(nfeCnpj(em.cnpj))}) · ${em.ambiente==='producao'?'<b>PRODUÇÃO – nota real</b>':'homologação (teste, sem valor fiscal)'}</div>
  <div class="campo"><label>Destinatário</label><div style="display:flex;gap:6px"><select id="ne_dest" style="flex:1"><option value="">Escolha…</option>${NFE.dest.filter(d=>d.ativo).map(d=>`<option value="${d.id}" ${R.dest===String(d.id)?'selected':''}>${esc(d.apelido)} · ${esc(d.municipio)}/${esc(d.uf)}</option>`).join('')}</select><button class="small" id="ne_novo">+ Novo</button>${R.dest?'<button class="small" id="ne_ed">Editar</button>':''}</div></div>
  <div class="scroll"><table class="planilha"><tr><th>Produto</th><th>NCM</th><th class="n">Qtd</th><th class="n">Valor unit. (R$)</th><th class="n">Total</th></tr>
  ${R.itens.map((i,k)=>{const p=produto(i.pid),f=nfeFisc(i.pid);const ok=f&&/^\d{8}$/.test(f.ncm||'');return `<tr><td>${esc(p.nome)}</td><td>${ok?esc(f.ncm):`<button class="small danger" data-nencm="${i.pid}">Falta NCM</button>`}</td><td class="n">${un(i.qtd)}</td>
    <td class="n"><input data-nev="${k}" inputmode="decimal" style="width:90px;text-align:right" value="${i.valor?String((+i.valor).toFixed(2)).replace('.',','):''}"></td><td class="n">${brl(i.qtd*(+i.valor||0))}</td></tr>`;}).join('')}
  <tr><td colspan="4"><b>Total da nota</b></td><td class="n"><b>${brl(tot)}</b></td></tr></table></div>
  <div class="meta">O valor sugerido é o custo médio de cada produto. Confira com o seu contador qual valor usar na remessa.</div>
  <div class="campo"><label>Observação na nota (opcional)</label><input id="ne_obs" value="${esc(R.obs)}" placeholder="ex.: nº do agendamento do Full"></div>
  ${semNcm.length?`<div class="warn">Preencha o NCM de ${semNcm.length} produto(s) antes de emitir (toque em "Falta NCM").</div>`:''}
  <div class="erro"></div><div class="rodape"><button id="cx">Voltar</button><button class="primary" id="ok" ${semNcm.length?'disabled':''}>Emitir nota</button></div>`,true);
  const guardar=()=>{R.dest=$('ne_dest').value;R.obs=val('ne_obs');$('modal').querySelectorAll('[data-nev]').forEach(x=>{const v=dinheiro(x.value);R.itens[+x.dataset.nev].valor=isNaN(v)?0:v;});};
  $('cx').onclick=()=>{nfeRasc=null;reabrir();};
  $('ne_dest').onchange=()=>{guardar();nfeModalEmitir(s);};
  $('modal').querySelectorAll('[data-nev]').forEach(x=>x.onchange=()=>{guardar();nfeModalEmitir(s);});
  $('ne_novo').onclick=()=>{guardar();nfeModalDestinatario(null,nid=>nfeModalEmitir(s,nid));};
  if($('ne_ed'))$('ne_ed').onclick=()=>{guardar();nfeModalDestinatario(+R.dest,nid=>nfeModalEmitir(s,nid));};
  $('modal').querySelectorAll('[data-nencm]').forEach(b=>b.onclick=()=>{guardar();nfeModalProduto(+b.dataset.nencm,()=>nfeModalEmitir(s));});
  $('ok').onclick=()=>{guardar();if(!R.dest){$('modal').querySelector('.erro').textContent='Escolha o destinatário.';return;}
    if(R.itens.some(i=>!(+i.valor>0))){$('modal').querySelector('.erro').textContent='Informe o valor unitário de todos os produtos.';return;}
    const go=()=>rodar($('ok'),async()=>{$('ok').textContent='Emitindo…';const r=await nfeChamar('emitir',{saida_id:s.id,destinatario_id:+R.dest,obs:R.obs,itens:R.itens.map(i=>({produto_id:i.pid,qtd:i.qtd,valor_unit:+i.valor}))});
      nfeRasc=null;await nfeCarregar();const n=r.nota||{};toast(n.status==='autorizada'?'Nota autorizada!':n.status==='erro'?'A Sefaz recusou a nota: veja o motivo.':'Nota enviada. Toque em Atualizar em alguns segundos.');reabrir();});
    if(em.ambiente==='producao'){const ok=$('ok');ok.textContent='Confirmar: emitir nota REAL de '+brl(tot);ok.onclick=go;return;}
    go();};
}
