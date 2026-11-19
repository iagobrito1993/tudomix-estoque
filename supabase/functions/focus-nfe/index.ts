// Edge Function: focus-nfe
// Emite, consulta e cancela NF-e na Focus NFe a partir das saídas do Tudo Mix Estoque.
// Só administrador. O token da Focus é lido aqui (service role) e nunca vai para o site.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const HOST = { homologacao: "https://homologacao.focusnfe.com.br", producao: "https://api.focusnfe.com.br" } as const;
type Amb = keyof typeof HOST;

const resp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const erro = (m: string, status = 400) => resp({ erro: m }, status);
const so = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const r2 = (n: number) => Math.round(n * 100) / 100;
const STATUS: Record<string, string> = {
  processando_autorizacao: "processando", autorizado: "autorizada", erro_autorizacao: "erro",
  denegado: "denegada", cancelado: "cancelada",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(jwt);
    if (!u?.user) return erro("Entre no sistema de novo.", 401);
    const { data: pf } = await db.from("perfis").select("papel").eq("user_id", u.user.id).maybeSingle();
    if (pf?.papel !== "admin") return erro("Seu acesso não permite emitir nota.", 403);

    const body = await req.json();
    const acao = body.acao as string;

    async function focus(emitenteId: number, amb: Amb, metodo: string, caminho: string, dados?: unknown) {
      const { data: t } = await db.from("nfe_tokens").select("*").eq("emitente_id", emitenteId).maybeSingle();
      const token = amb === "producao" ? t?.token_prod : t?.token_homolog;
      if (!token) throw new Error(`Falta o token da Focus (${amb === "producao" ? "produção" : "homologação"}) desta empresa. Cadastre em Contas › Dados fiscais.`);
      const r = await fetch(HOST[amb] + caminho, {
        method: metodo,
        headers: { Authorization: "Basic " + btoa(token + ":"), "Content-Type": "application/json" },
        body: dados ? JSON.stringify(dados) : undefined,
      });
      const txt = await r.text();
      let j: any = {};
      try { j = txt ? JSON.parse(txt) : {}; } catch { j = { mensagem: txt }; }
      return { ok: r.ok, status: r.status, j };
    }

    async function atualizar(nota: any, j: any) {
      const amb = nota.ambiente as Amb;
      const msgs = [j.mensagem_sefaz, j.mensagem, ...(j.erros || []).map((e: any) => e.mensagem)].filter(Boolean);
      const upd: Record<string, unknown> = {
        status: STATUS[j.status] || nota.status, mensagem: msgs.join(" · ") || null, resposta: j, atualizado_em: new Date().toISOString(),
      };
      if (j.numero) upd.numero = String(j.numero);
      if (j.serie) upd.serie = String(j.serie);
      if (j.chave_nfe) upd.chave = String(j.chave_nfe).replace(/^NFe/, "");
      if (j.caminho_danfe) upd.danfe_url = HOST[amb] + j.caminho_danfe;
      if (j.caminho_xml_nota_fiscal) upd.xml_url = HOST[amb] + j.caminho_xml_nota_fiscal;
      const { data } = await db.from("nfe_notas").update(upd).eq("id", nota.id).select().single();
      return data;
    }

    // ---------- emitir NF de remessa a partir de uma saída ----------
    if (acao === "emitir") {
      const { saida_id, destinatario_id, itens, obs } = body;
      const { data: s } = await db.from("saidas").select("id,conta_id,status").eq("id", saida_id).maybeSingle();
      if (!s) return erro("Saída não encontrada.");
      if (s.status !== "ativa") return erro("Esta saída está cancelada.");
      const { data: em } = await db.from("nfe_emitentes").select("*").eq("conta_id", s.conta_id).maybeSingle();
      if (!em) return erro("Esta conta ainda não tem os dados fiscais da empresa. Preencha em Contas › Dados fiscais.");
      const { data: de } = await db.from("nfe_destinatarios").select("*").eq("id", destinatario_id).maybeSingle();
      if (!de) return erro("Escolha o destinatário.");
      const ativa = await db.from("nfe_notas").select("id").eq("saida_id", s.id).in("status", ["enviando", "processando", "autorizada"]);
      if ((ativa.data || []).length) return erro("Esta saída já tem nota emitida ou em processamento.");

      const interna = (em.uf || "").toUpperCase() === (de.uf || "").toUpperCase();
      const cfop = interna ? em.cfop_interno : em.cfop_interestadual;
      if (!cfop) return erro(`Falta o CFOP ${interna ? "interno" : "interestadual"} da empresa (Contas › Dados fiscais).`);
      if (!em.icms_cst) return erro("Falta a situação tributária do ICMS (CST/CSOSN) da empresa (Contas › Dados fiscais).");

      const ids = (itens || []).map((i: any) => +i.produto_id);
      if (!ids.length) return erro("Sem itens.");
      const [{ data: ps }, { data: fs }] = await Promise.all([
        db.from("produtos").select("id,nome,sku,ean").in("id", ids),
        db.from("produtos_fiscal").select("*").in("produto_id", ids),
      ]);
      const falta: string[] = [];
      const items = (itens as any[]).map((i, k) => {
        const p = (ps || []).find((x: any) => x.id === +i.produto_id) || { nome: "?", sku: "" };
        const f = (fs || []).find((x: any) => x.produto_id === +i.produto_id) || {};
        if (!/^\d{8}$/.test(f.ncm || "")) falta.push(p.nome);
        const q = +i.qtd, v = r2(+i.valor_unit);
        if (!(q > 0) || !(v > 0)) throw new Error(`Quantidade e valor de "${p.nome}" precisam ser maiores que zero.`);
        const ean = /^\d{8}$|^\d{12,14}$/.test(p.ean || "") ? p.ean : "SEM GTIN";
        return {
          numero_item: k + 1, codigo_produto: p.sku || String(p.id), descricao: p.nome.slice(0, 120),
          codigo_ncm: f.ncm, cest: f.cest || undefined, cfop, icms_origem: f.origem || "0",
          icms_situacao_tributaria: em.icms_cst, pis_situacao_tributaria: em.pis_cst || "49", cofins_situacao_tributaria: em.cofins_cst || "49",
          unidade_comercial: f.unidade || "UN", quantidade_comercial: q, valor_unitario_comercial: v,
          unidade_tributavel: f.unidade || "UN", quantidade_tributavel: q, valor_unitario_tributavel: v,
          valor_bruto: r2(q * v), codigo_barras_comercial: ean, codigo_barras_tributavel: ean, inclui_no_total: 1,
        };
      });
      if (falta.length) return erro("Falta o NCM (8 dígitos) destes produtos: " + falta.join(", ") + ". Abra o produto › Dados fiscais.");

      const amb = em.ambiente as Amb;
      const agora = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19) + "-03:00";
      const payload = {
        natureza_operacao: em.natureza_remessa, data_emissao: agora, tipo_documento: 1,
        local_destino: interna ? 1 : 2, finalidade_emissao: 1, consumidor_final: 0, presenca_comprador: 9,
        cnpj_emitente: em.cnpj, inscricao_estadual_emitente: em.ie || undefined,
        nome_destinatario: amb === "homologacao" ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" : de.nome,
        cnpj_destinatario: de.cnpj, inscricao_estadual_destinatario: de.ie || undefined,
        indicador_inscricao_estadual_destinatario: de.ie ? 1 : 9,
        logradouro_destinatario: de.logradouro, numero_destinatario: de.numero, complemento_destinatario: de.complemento || undefined,
        bairro_destinatario: de.bairro, municipio_destinatario: de.municipio, uf_destinatario: de.uf, cep_destinatario: de.cep,
        modalidade_frete: 9,
        informacoes_adicionais_contribuinte: [em.info_complementar, obs, `Saída #${s.id} Tudo Mix Estoque`].filter(Boolean).join(" | ").slice(0, 2000),
        items,
      };
      const ref = `tm-${s.id}-${Date.now()}`;
      const total = r2(items.reduce((a, i) => a + i.valor_bruto, 0));
      const { data: nota, error: e1 } = await db.from("nfe_notas").insert({
        ref, saida_id: s.id, emitente_id: em.id, destinatario_id: de.id, ambiente: amb, status: "enviando",
        valor_total: total, payload, criado_por: u.user.id,
      }).select().single();
      if (e1) throw e1;
      const r = await focus(em.id, amb, "POST", `/v2/nfe?ref=${encodeURIComponent(ref)}`, payload);
      if (!r.ok && !r.j.status) {
        const m = [r.j.mensagem, ...(r.j.erros || []).map((e: any) => e.mensagem)].filter(Boolean).join(" · ") || `Erro ${r.status} na Focus.`;
        await db.from("nfe_notas").update({ status: "erro", mensagem: m, resposta: r.j, atualizado_em: new Date().toISOString() }).eq("id", nota.id);
        return erro(m);
      }
      // a Focus processa em segundo plano: consulta logo em seguida
      await new Promise((ok) => setTimeout(ok, 2500));
      const c = await focus(em.id, amb, "GET", `/v2/nfe/${encodeURIComponent(ref)}`);
      return resp({ nota: await atualizar(nota, c.j.status ? c.j : { ...r.j, status: "processando_autorizacao" }) });
    }

    // ---------- consultar ----------
    if (acao === "consultar" || acao === "cancelar") {
      const { data: nota } = await db.from("nfe_notas").select("*").eq("id", body.nota_id).maybeSingle();
      if (!nota) return erro("Nota não encontrada.");
      if (acao === "consultar") {
        const c = await focus(nota.emitente_id, nota.ambiente, "GET", `/v2/nfe/${encodeURIComponent(nota.ref)}`);
        return resp({ nota: await atualizar(nota, c.j) });
      }
      const just = String(body.justificativa || "").trim();
      if (just.length < 15) return erro("A justificativa do cancelamento precisa ter pelo menos 15 caracteres.");
      const c = await focus(nota.emitente_id, nota.ambiente, "DELETE", `/v2/nfe/${encodeURIComponent(nota.ref)}`, { justificativa: just });
      if (c.j.status !== "cancelado") {
        const m = [c.j.mensagem_sefaz, c.j.mensagem].filter(Boolean).join(" · ") || "A Sefaz não aceitou o cancelamento.";
        return erro(m);
      }
      await db.from("nfe_notas").update({ cancelado_em: new Date().toISOString(), cancelado_motivo: just }).eq("id", nota.id);
      const g = await focus(nota.emitente_id, nota.ambiente, "GET", `/v2/nfe/${encodeURIComponent(nota.ref)}`);
      return resp({ nota: await atualizar(nota, g.j.status ? g.j : c.j) });
    }

    return erro("Ação inválida.");
  } catch (e) {
    console.error(e);
    return erro((e as Error).message || "Erro inesperado.", 500);
  }
});
