/* ================================================================
   Doce Gestão — script.js
   Organização do arquivo:
  1. DB      -> camada de dados (Supabase)
   2. Estado  -> variáveis de controle da tela
   3. Utilitários (máscara de celular, validação, toast)
   4. Navegação entre telas
   5. Telas: Início / Clientes / Formulário
   6. Modal de confirmação de exclusão
   7. Inicialização
   ================================================================ */

/* ------------------------------------------------------------
   1. CAMADA DE DADOS (DB)
   ------------------------------------------------------------
  O acesso ao banco passa pelo cliente autenticado; as políticas
  RLS do Supabase limitam os registros ao proprietário da sessão.
   ------------------------------------------------------------ */

const DB = {
  KEYS: {
    CLIENTES: 'docegestao_clientes',
    COMPRAS: 'docegestao_compras',
    DOCES: 'docegestao_doces'
  },
  clienteSupabase: null,

  _supabase() {
    const configuracao = window.DOCE_GESTAO_SUPABASE_CONFIG;
    if (!configuracao?.url || !configuracao?.anonKey) {
      throw new Error('Configure a Project URL e a chave publicável do Supabase em js/supabase-config.js.');
    }
    if (!window.supabase?.createClient) {
      throw new Error('Não foi possível carregar o SDK do Supabase. Verifique sua conexão com a internet.');
    }
    if (!this.clienteSupabase) {
      this.clienteSupabase = window.supabase.createClient(configuracao.url, configuracao.anonKey);
    }
    return this.clienteSupabase;
  },

  _validarResposta({ data, error }) {
    if (error) throw new Error(error.message);
    return data;
  },

  _clienteDaLinha(linha) {
    return {
      id: linha.id,
      nome: linha.name,
      celular: linha.phone,
      criadoEm: linha.created_at,
      atualizadoEm: linha.updated_at
    };
  },

  _doceDaLinha(linha) {
    return { id: linha.id, nome: linha.name, valor: Number(linha.price), criadoEm: linha.created_at };
  },

  _compraDaLinha(linha) {
    const valor = Number(linha.total_amount);
    const valorPago = Number(linha.amount_paid) || 0;
    return {
      id: linha.id,
      clienteId: linha.client_id,
      doceId: linha.sweet_id,
      descricao: linha.item_name,
      quantidade: Number(linha.quantity),
      valorUnitario: Number(linha.unit_price),
      valor,
      data: linha.purchase_date,
      valorPago,
      pago: valorPago >= valor,
      dataPagamento: linha.paid_at,
      criadoEm: linha.created_at
    };
  },

  async obterPerfilAtual(usuarioId) {
    const linha = this._validarResposta(await this._supabase().from('user_profiles')
      .select('display_name,access_role').eq('id', usuarioId).single());
    if (!['admin', 'viewer'].includes(linha.access_role)) {
      throw new Error('O perfil desta conta não possui um nível de acesso válido.');
    }
    return { nome: linha.display_name, papel: linha.access_role };
  },

  async listarAtividades() {
    return this._validarResposta(await this._supabase().from('activity_logs')
      .select('*').order('created_at', { ascending: false }).limit(8));
  },

  async registrarAtividade({ evento, entidade, nome, detalhes = '' }) {
    try {
      this._validarResposta(await this._supabase().from('activity_logs').insert({
        actor_id: estado.usuarioId,
        actor_name: estado.nomeUsuario,
        event_type: evento,
        entity_type: entidade,
        entity_name: nome,
        details: detalhes
      }));
      if (estado.telaAtual === 'home') atualizarListaAtividades();
    } catch (erro) {
      console.error('Não foi possível registrar a atividade:', erro);
    }
  },

  async migrarDadosLocais() {
    const cliente = this._supabase();
    const usuario = this._validarResposta(await cliente.auth.getUser()).user;
    if (!usuario) throw new Error('Sessão Supabase não encontrada.');

    const statusMigracao = this._validarResposta(await cliente
      .from('local_migrations').select('owner_id').eq('owner_id', usuario.id).maybeSingle());
    if (statusMigracao) return false;

    const locais = Object.fromEntries(Object.entries(this.KEYS).map(([nome, chave]) => {
      try {
        return [nome, JSON.parse(localStorage.getItem(chave) || '[]')];
      } catch (erro) {
        console.warn(`Não foi possível ler os dados locais de ${nome}.`, erro);
        return [nome, []];
      }
    }));
    const existemDadosLocais = Object.values(locais).some((lista) => lista.length > 0);
    if (!existemDadosLocais) return false;

    const clientesPorId = new Map();
    for (const antigo of locais.CLIENTES) {
      const salvo = this._validarResposta(await cliente.from('clients').upsert({
        legacy_id: String(antigo.id),
        name: antigo.nome,
        phone: antigo.celular,
        created_at: antigo.criadoEm || new Date().toISOString()
      }, { onConflict: 'owner_id,legacy_id' }).select('*').single());
      clientesPorId.set(String(antigo.id), salvo.id);
    }

    const docesPorId = new Map();
    for (const antigo of locais.DOCES) {
      const salvo = this._validarResposta(await cliente.from('sweets').upsert({
        legacy_id: String(antigo.id),
        name: antigo.nome,
        price: antigo.valor,
        created_at: antigo.criadoEm || new Date().toISOString()
      }, { onConflict: 'owner_id,legacy_id' }).select('*').single());
      docesPorId.set(String(antigo.id), salvo.id);
    }

    for (const antiga of locais.COMPRAS) {
      const clientId = clientesPorId.get(String(antiga.clienteId));
      if (!clientId) continue;
      const quantidade = Number(antiga.quantidade) || 1;
      const valor = Number(antiga.valor) || 0;
      const valorPago = Math.min(valor, Math.max(0, Number(antiga.valorPago ?? (antiga.pago ? valor : 0))));
      this._validarResposta(await cliente.from('purchases').upsert({
        legacy_id: String(antiga.id),
        client_id: clientId,
        sweet_id: docesPorId.get(String(antiga.doceId)) || null,
        item_name: antiga.descricao,
        quantity: quantidade,
        unit_price: Number(antiga.valorUnitario ?? valor / quantidade),
        total_amount: valor,
        amount_paid: valorPago,
        purchase_date: antiga.data,
        paid_at: valorPago >= valor ? antiga.dataPagamento || null : null,
        created_at: antiga.criadoEm || new Date().toISOString()
      }, { onConflict: 'owner_id,legacy_id' }));
    }

    this._validarResposta(await cliente.from('local_migrations').insert({ owner_id: usuario.id }));
    return locais.CLIENTES.length > 0;
  },

  // ---------- Clientes ----------

  async listarClientes() {
    const data = this._validarResposta(await this._supabase().from('clients').select('*').order('name'));
    return data.map((linha) => this._clienteDaLinha(linha));
  },

  async buscarClientePorId(id) {
    const data = this._validarResposta(await this._supabase().from('clients').select('*').eq('id', id).maybeSingle());
    return data ? this._clienteDaLinha(data) : null;
  },

  async salvarCliente(dadosCliente) {
    const cliente = this._supabase();
    const dados = { name: dadosCliente.nome, phone: dadosCliente.celular, updated_at: new Date().toISOString() };
    if (dadosCliente.id) {
      const data = this._validarResposta(await cliente.from('clients').update(dados).eq('id', dadosCliente.id).select('*').single());
      await this.registrarAtividade({ evento: 'client_updated', entidade: 'cliente', nome: dadosCliente.nome });
      return this._clienteDaLinha(data);
    }
    const data = this._validarResposta(await cliente.from('clients').insert({ ...dados, created_at: new Date().toISOString() }).select('*').single());
    await this.registrarAtividade({ evento: 'client_created', entidade: 'cliente', nome: dadosCliente.nome });
    return this._clienteDaLinha(data);
  },

  async excluirCliente(id, nome) {
    this._validarResposta(await this._supabase().from('clients').delete().eq('id', id));
    await this.registrarAtividade({ evento: 'client_deleted', entidade: 'cliente', nome });
    return true;
  },

  // ---------- Compras ----------

  async listarCompras() {
    const data = this._validarResposta(await this._supabase().from('purchases').select('*'));
    return data.map((linha) => this._compraDaLinha(linha));
  },

  async listarComprasPorCliente(clienteId) {
    const data = this._validarResposta(await this._supabase().from('purchases').select('*')
      .eq('client_id', clienteId).order('purchase_date').order('created_at'));
    return data.map((linha) => this._compraDaLinha(linha));
  },

  async salvarCompra(dadosCompra) {
    const cliente = this._supabase();
    const dados = {
      client_id: dadosCompra.clienteId,
      sweet_id: dadosCompra.doceId || null,
      item_name: dadosCompra.descricao,
      quantity: dadosCompra.quantidade,
      unit_price: dadosCompra.valorUnitario,
      total_amount: dadosCompra.valor,
      purchase_date: dadosCompra.data
    };
    if (dadosCompra.id) {
      const existente = this._validarResposta(await cliente.from('purchases').select('amount_paid,paid_at')
        .eq('id', dadosCompra.id).single());
      const valorPago = Math.min(Number(existente.amount_paid), Number(dadosCompra.valor));
      const estaPaga = valorPago >= Number(dadosCompra.valor);
      const data = this._validarResposta(await cliente.from('purchases').update({
        ...dados,
        amount_paid: valorPago,
        paid_at: estaPaga ? existente.paid_at || obterDataLocalISO() : null
      }).eq('id', dadosCompra.id).select('*').single());
      await this.registrarAtividade({
        evento: 'purchase_updated', entidade: 'compra', nome: dadosCompra.descricao,
        detalhes: `Cliente: ${dadosCompra.clienteNome} - ${dadosCompra.quantidade} item(ns) - ${formatarMoeda(dadosCompra.valor)}`
      });
      return this._compraDaLinha(data);
    }
    const data = this._validarResposta(await cliente.from('purchases').insert(dados).select('*').single());
    await this.registrarAtividade({
      evento: 'purchase_created', entidade: 'compra', nome: dadosCompra.descricao,
      detalhes: `Cliente: ${dadosCompra.clienteNome} - ${dadosCompra.quantidade} item(ns) - ${formatarMoeda(dadosCompra.valor)}`
    });
    return this._compraDaLinha(data);
  },

  async atualizarPagamentoCompra(id, pago, compra) {
    const cliente = this._supabase();
    const existente = this._validarResposta(await cliente.from('purchases').select('total_amount')
      .eq('id', id).single());
    const data = this._validarResposta(await cliente.from('purchases').update({
      amount_paid: pago ? Number(existente.total_amount) : 0,
      paid_at: pago ? obterDataLocalISO() : null
    }).eq('id', id).select('*').single());
    await this.registrarAtividade({
      evento: pago ? 'payment_received' : 'payment_reopened', entidade: 'pagamento',
      nome: compra?.descricao || 'Compra', detalhes: formatarMoeda(existente.total_amount)
    });
    return this._compraDaLinha(data);
  },

  async marcarComprasDoClienteComoPagas(clienteId, nomeCliente) {
    const quantidade = this._validarResposta(await this._supabase().rpc('mark_client_purchases_paid', {
      p_client_id: clienteId,
      p_paid_at: obterDataLocalISO()
    }));
    if (quantidade > 0) {
      await this.registrarAtividade({
        evento: 'payments_settled', entidade: 'pagamento', nome: nomeCliente,
        detalhes: `${quantidade} compra(s)`
      });
    }
    return quantidade;
  },

  async registrarPagamentoCliente(clienteId, valor, nomeCliente) {
    const data = this._validarResposta(await this._supabase().rpc('register_client_payment', {
      p_client_id: clienteId,
      p_amount: valor,
      p_paid_at: obterDataLocalISO()
    }));
    await this.registrarAtividade({
      evento: 'payment_received', entidade: 'pagamento', nome: nomeCliente,
      detalhes: formatarMoeda(data.applied)
    });
    return { valorPago: Number(data.applied), saldoDevedor: Number(data.balance) };
  },

  async excluirCompra(id, nome, nomeCliente) {
    this._validarResposta(await this._supabase().from('purchases').delete().eq('id', id));
    await this.registrarAtividade({
      evento: 'purchase_deleted', entidade: 'compra', nome,
      detalhes: nomeCliente ? `Cliente: ${nomeCliente}` : ''
    });
    return true;
  },

  async excluirComprasDoCliente(clienteId) {
    this._validarResposta(await this._supabase().from('purchases').delete().eq('client_id', clienteId));
    return true;
  },

  // ---------- Catálogo de doces ----------

  async listarDoces() {
    const data = this._validarResposta(await this._supabase().from('sweets').select('*').order('name'));
    return data.map((linha) => this._doceDaLinha(linha));
  },

  async salvarDoce(dadosDoce) {
    const cliente = this._supabase();
    const dados = { name: dadosDoce.nome, price: dadosDoce.valor };
    if (dadosDoce.id) {
      const data = this._validarResposta(await cliente.from('sweets').update(dados).eq('id', dadosDoce.id).select('*').single());
      await this.registrarAtividade({
        evento: 'sweet_updated', entidade: 'doce', nome: dadosDoce.nome,
        detalhes: `Preço: ${formatarMoeda(dadosDoce.valor)}`
      });
      return this._doceDaLinha(data);
    }
    const data = this._validarResposta(await cliente.from('sweets').insert(dados).select('*').single());
    await this.registrarAtividade({
      evento: 'sweet_created', entidade: 'doce', nome: dadosDoce.nome,
      detalhes: `Preço: ${formatarMoeda(dadosDoce.valor)}`
    });
    return this._doceDaLinha(data);
  },

  async excluirDoce(id, nome) {
    this._validarResposta(await this._supabase().from('sweets').delete().eq('id', id));
    await this.registrarAtividade({ evento: 'sweet_deleted', entidade: 'doce', nome });
    return true;
  }
};

/* ------------------------------------------------------------
   2. ESTADO DA TELA
   ------------------------------------------------------------ */

const estado = {
  telaAtual: 'home',
  idEmEdicao: null,             // cliente em edição (null = cadastro novo)
  origemFormularioCliente: 'clients', // para onde voltar após salvar/cancelar: 'clients' ou 'detalhe'
  termoBusca: '',
  clienteDetalheAtual: null,    // cliente exibido na tela de detalhe
  compraIdEmEdicao: null,       // compra em edição (null = cadastro novo)
  doceIdEmEdicao: null,
  origemFormularioDoce: 'sweets',
  usuarioId: null,
  nomeUsuario: '',
  papelUsuario: 'viewer',
  aplicacaoIniciada: false,
  exclusao: null                // { tipo: 'cliente' | 'compra', id }
};

/* ------------------------------------------------------------
   3. UTILITÁRIOS
   ------------------------------------------------------------ */

function apenasNumeros(texto) {
  return (texto || '').replace(/\D/g, '');
}

function aplicarMascaraCelular(valor) {
  const numeros = apenasNumeros(valor).slice(0, 11);

  if (numeros.length <= 2) return numeros;
  if (numeros.length <= 6) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  if (numeros.length <= 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  }
  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
}

function formatarDataResumo(isoString) {
  if (!isoString) return '';
  // Datas "YYYY-MM-DD" (input type="date") são tratadas como locais,
  // evitando o problema comum de exibir o dia anterior.
  const data = isoString.length === 10 ? new Date(isoString + 'T00:00:00') : new Date(isoString);
  return data.toLocaleDateString('pt-BR');
}

function obterDataLocalISO() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarMoeda(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function entrarNoSistema(usuario) {
  const perfil = await DB.obterPerfilAtual(usuario.id);
  const metadados = usuario.user_metadata || {};
  estado.nomeUsuario = perfil.nome || metadados.display_name || metadados.name || usuario.email?.split('@')[0] || 'Usuário';
  estado.usuarioId = usuario.id;
  estado.papelUsuario = perfil.papel;
  aplicarPermissoesInterface();
  document.getElementById('login-screen').hidden = true;
  document.getElementById('app').hidden = false;
  document.getElementById('erro-login').textContent = '';
  document.getElementById('home-saudacao').textContent = `Olá, ${estado.nomeUsuario}!`;

  if (!estado.aplicacaoIniciada) {
    estado.aplicacaoIniciada = true;
    let dadosMigrados = false;
    let erroMigracao = null;
    if (estado.papelUsuario === 'admin') {
      try {
        dadosMigrados = await DB.migrarDadosLocais();
      } catch (erro) {
        erroMigracao = erro;
        console.error('Falha ao migrar dados locais para o Supabase:', erro);
      }
    }
    iniciar();
    if (dadosMigrados) mostrarToast('Dados locais importados para o Supabase.');
    if (erroMigracao) mostrarToast('Não foi possível concluir a importação dos dados locais.', 'erro');
  } else {
    irParaTela('home');
  }
}

function aplicarPermissoesInterface() {
  const somenteAdmin = estado.papelUsuario === 'admin';
  document.querySelectorAll('[data-admin-only]').forEach((elemento) => {
    elemento.hidden = !somenteAdmin;
  });
}

async function sairDoSistema() {
  try {
    const { error } = await DB._supabase().auth.signOut();
    if (error) throw error;
  } catch (erro) {
    mostrarToast('Não foi possível encerrar a sessão.', 'erro');
    console.error(erro);
    return;
  }

  document.getElementById('app').hidden = true;
  document.getElementById('login-screen').hidden = false;
  document.getElementById('login-senha').value = '';
  document.getElementById('login-usuario').value = '';
  document.getElementById('login-usuario').focus({ preventScroll: true });
}

function iniciarAutenticacao() {
  const formulario = document.getElementById('form-login');
  const erroLogin = document.getElementById('erro-login');
  const botaoTemaLogin = document.getElementById('theme-toggle');
  const botaoTemaApp = document.getElementById('theme-toggle-app');

  try {
    const temaSalvo = localStorage.getItem('docegestao_theme') || 'light';
    aplicarTema(temaSalvo);
  } catch (erro) {
    console.warn('Não foi possível carregar a preferência de tema.', erro);
  }

  if (botaoTemaLogin) {
    botaoTemaLogin.addEventListener('click', alternarTema);
  }
  if (botaoTemaApp) {
    botaoTemaApp.addEventListener('click', alternarTema);
  }

  if (!window.DOCE_GESTAO_SUPABASE_CONFIG?.url || !window.DOCE_GESTAO_SUPABASE_CONFIG?.anonKey) {
    erroLogin.textContent = 'Configure a URL e a chave publicável do Supabase em js/supabase-config.js.';
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const email = document.getElementById('login-usuario').value.trim();
    const senha = document.getElementById('login-senha').value;
    const botaoEnviar = formulario.querySelector('[type="submit"]');
    botaoEnviar.disabled = true;
    erroLogin.textContent = '';

    try {
      const { data, error } = await DB._supabase().auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      await entrarNoSistema(data.user);
    } catch (erro) {
      erroLogin.textContent = erro.message?.includes('Invalid login credentials')
        ? 'E-mail ou senha incorretos.'
        : erro.message || 'Não foi possível conectar ao Supabase.';
      document.getElementById('login-senha').value = '';
      document.getElementById('login-senha').focus({ preventScroll: true });
    } finally {
      botaoEnviar.disabled = false;
    }
  });

  document.getElementById('btn-sair').addEventListener('click', sairDoSistema);

  let clienteSupabase;
  try {
    clienteSupabase = DB._supabase();
  } catch (erro) {
    erroLogin.textContent = erro.message;
    return;
  }

  clienteSupabase.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    if (data.session?.user) entrarNoSistema(data.session.user);
    else document.getElementById('login-usuario').focus({ preventScroll: true });
  }).catch((erro) => {
    erroLogin.textContent = erro.message || 'Não foi possível verificar a sessão do Supabase.';
  });
}

function paraCentavos(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100);
}

function obterValorPagoCompra(compra) {
  const total = Math.max(0, Number(compra.valor) || 0);
  if (compra.valorPago === undefined || compra.valorPago === null) {
    return compra.pago ? total : 0;
  }
  return Math.min(total, Math.max(0, Number(compra.valorPago) || 0));
}

let timeoutToast = null;
function mostrarToast(mensagem, tipo) {
  const toast = document.getElementById('toast');
  toast.textContent = mensagem;
  toast.classList.toggle('toast--erro', tipo === 'erro');
  toast.hidden = false;
  clearTimeout(timeoutToast);
  timeoutToast = setTimeout(() => { toast.hidden = true; }, 2600);
}

function aplicarTema(tema) {
  const temaAtual = tema === 'dark' ? 'dark' : 'light';
  const iconeLua = '<svg viewBox="0 0 24 24"><path d="M21 12.8A8.8 8.8 0 0 1 11.2 3a8.8 8.8 0 1 0 9.8 9.8Z"/></svg>';
  const iconeSol = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/></svg>';
  const paleta = temaAtual === 'dark' ? {
    'cor-fundo': '#201a1d',
    'cor-superficie': '#2b2428',
    'cor-superficie-alt': '#372d32',
    'cor-primaria': '#f4dbe5',
    'cor-primaria-escura': '#ffffff',
    'cor-primaria-clara': 'rgba(244, 219, 229, 0.14)',
    'cor-acento': '#f0a6c2',
    'cor-acento-clara': 'rgba(240, 166, 194, 0.16)',
    'cor-texto': '#f6eef1',
    'cor-texto-suave': '#cbbbc2',
    'cor-borda': '#55464d',
    'cor-perigo': '#ee8f7b',
    'cor-perigo-clara': 'rgba(238, 143, 123, 0.12)',
    'cor-sucesso': '#76c79b'
  } : {
    'cor-fundo': '#faf7f8',
    'cor-superficie': '#ffffff',
    'cor-superficie-alt': '#f5eef2',
    'cor-primaria': '#4a3d45',
    'cor-primaria-escura': '#30262d',
    'cor-primaria-clara': 'rgba(74, 61, 69, 0.10)',
    'cor-acento': '#c6537d',
    'cor-acento-clara': 'rgba(198, 83, 125, 0.14)',
    'cor-texto': '#302a2d',
    'cor-texto-suave': '#766c72',
    'cor-borda': '#eadfe4',
    'cor-perigo': '#d96f60',
    'cor-perigo-clara': 'rgba(217, 111, 96, 0.12)',
    'cor-sucesso': '#3d8e69'
  };

  Object.entries(paleta).forEach(([nome, valor]) => {
    document.body.style.setProperty(`--${nome}`, valor);
  });

  document.body.dataset.theme = temaAtual;
  document.body.classList.toggle('dark', temaAtual === 'dark');

  const botoesTema = [
    document.getElementById('theme-toggle'),
    document.getElementById('theme-toggle-app')
  ].filter(Boolean);

  botoesTema.forEach((botao) => {
    const icone = botao.querySelector('.theme-toggle__icon, .nav__icon');
    if (botao.id === 'theme-toggle') {
      const label = botao.querySelector('.theme-toggle__label');
      if (label) {
        label.textContent = temaAtual === 'dark' ? 'Claro' : 'Escuro';
      }
      if (icone) {
        icone.innerHTML = temaAtual === 'dark' ? iconeSol : iconeLua;
      }
      botao.setAttribute('aria-label', temaAtual === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
      return;
    }

    if (icone) {
      icone.innerHTML = temaAtual === 'dark' ? iconeSol : iconeLua;
    }
    const label = botao.querySelector('.nav__label');
    if (label) {
      label.textContent = temaAtual === 'dark' ? 'Claro' : 'Tema';
    }
  });

  try {
    localStorage.setItem('docegestao_theme', temaAtual);
  } catch (erro) {
    console.warn('Não foi possível salvar a preferência de tema.', erro);
  }
}

function alternarTema() {
  const temaAtual = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  aplicarTema(temaAtual);
}

/* ------------------------------------------------------------
   4. NAVEGAÇÃO ENTRE TELAS
   ------------------------------------------------------------ */

function irParaTela(nomeTela) {
  estado.telaAtual = nomeTela;

  document.querySelectorAll('.screen').forEach((secao) => {
    secao.classList.toggle('is-active', secao.dataset.screen === nomeTela);
  });

  // "detalhe" e "compra-form" são sub-telas de Clientes: o menu continua
  // destacando "Clientes" enquanto o usuário estiver nelas.
  const nomeParaMenu = (nomeTela === 'detalhe' || nomeTela === 'compra-form')
    ? 'clients'
    : nomeTela === 'sweet-form' ? 'sweets' : nomeTela;
  document.querySelectorAll('.nav__item[data-screen]').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.screen === nomeParaMenu);
  });

  if (nomeTela === 'home') atualizarTelaHome();
  if (nomeTela === 'payments') atualizarTelaPagamentos();
  if (nomeTela === 'clients') atualizarTelaClientes();
  if (nomeTela === 'sweets') atualizarTelaDoces();

  document.getElementById('main').scrollTo({ top: 0 });
}

function definirMenuAberto(aberto, devolverFoco = false) {
  const botao = document.getElementById('nav-toggle');
  const itens = document.getElementById('nav-items');
  if (!botao || !itens) return;

  botao.setAttribute('aria-expanded', String(aberto));
  botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
  itens.classList.toggle('is-open', aberto);
  itens.setAttribute('aria-hidden', String(!aberto));
  itens.inert = !aberto;

  if (devolverFoco) botao.focus();
}

function sincronizarMenuComTela() {
  const itens = document.getElementById('nav-items');
  if (!itens) return;

  const menuDisponivel = window.matchMedia('(min-width: 860px)').matches;
  if (menuDisponivel) {
    itens.classList.remove('is-open');
    itens.setAttribute('aria-hidden', 'false');
    itens.inert = false;
    document.getElementById('nav-toggle')?.setAttribute('aria-expanded', 'false');
  } else {
    definirMenuAberto(false);
  }
}

function abrirFormulario(modo, cliente, origem) {
  const formulario = document.getElementById('form-cliente');
  formulario.reset();
  limparErrosFormulario();

  estado.origemFormularioCliente = origem || 'clients';

  if (modo === 'editar' && cliente) {
    estado.idEmEdicao = cliente.id;
    document.getElementById('form-titulo').textContent = 'Editar cliente';
    document.getElementById('cliente-id').value = cliente.id;
    document.getElementById('cliente-nome').value = cliente.nome;
    document.getElementById('cliente-celular').value = cliente.celular;
  } else {
    estado.idEmEdicao = null;
    document.getElementById('form-titulo').textContent = 'Novo cliente';
    document.getElementById('cliente-id').value = '';
  }

  irParaTela('form');
  document.getElementById('cliente-nome').focus({ preventScroll: true });
}

function voltarDoFormularioCliente() {
  irParaTela(estado.origemFormularioCliente === 'detalhe' ? 'detalhe' : 'clients');
}

function atualizarTelaDoces() {
  DB.listarDoces().then((doces) => {
    const ordenados = [...doces].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    document.getElementById('sweets-subtitulo').textContent =
      ordenados.length === 1 ? '1 doce cadastrado' : `${ordenados.length} doces cadastrados`;
    document.getElementById('empty-doces').hidden = ordenados.length !== 0;

    const lista = document.getElementById('lista-doces');
    lista.innerHTML = '';
    ordenados.forEach((doce) => lista.appendChild(criarLinhaDoce(doce)));
  });
}

function criarLinhaDoce(doce) {
  const linha = document.createElement('div');
  linha.className = 'doce-row';
  linha.innerHTML = `
    <div class="doce-row__info">
      <strong class="doce-row__nome">${escaparHtml(doce.nome)}</strong>
      <span class="doce-row__valor">${formatarMoeda(doce.valor)}</span>
    </div>
    <div class="doce-row__acoes">
      <button class="client-row__acao client-row__acao--editar" type="button">
        <span class="btn__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="m16.5 3.5 4 4L7 21l-5 1 1-5 14.5-13.5Z"/></svg></span>
        <span class="btn__label">Editar</span>
      </button>
      <button class="client-row__acao client-row__acao--excluir" type="button">
        <span class="btn__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 13h8l1-13"/></svg></span>
        <span class="btn__label">Excluir</span>
      </button>
    </div>
  `;
  linha.querySelector('.doce-row__acoes').hidden = estado.papelUsuario !== 'admin';
  linha.querySelector('.client-row__acao--editar').addEventListener('click', () => {
    abrirFormularioDoce('editar', doce);
  });
  linha.querySelector('.client-row__acao--excluir').addEventListener('click', () => {
    abrirModalConfirmacaoDoce(doce);
  });
  return linha;
}

function abrirFormularioDoce(modo, doce, origem) {
  const formulario = document.getElementById('form-doce');
  formulario.reset();
  limparErrosFormularioDoce();
  estado.origemFormularioDoce = origem || 'sweets';

  if (modo === 'editar' && doce) {
    estado.doceIdEmEdicao = doce.id;
    document.getElementById('doce-form-titulo').textContent = 'Editar doce';
    document.getElementById('doce-id').value = doce.id;
    document.getElementById('doce-nome').value = doce.nome;
    document.getElementById('doce-valor').value = doce.valor;
  } else {
    estado.doceIdEmEdicao = null;
    document.getElementById('doce-form-titulo').textContent = 'Novo doce';
    document.getElementById('doce-id').value = '';
  }

  irParaTela('sweet-form');
  document.getElementById('doce-nome').focus({ preventScroll: true });
}

function voltarDoFormularioDoce() {
  irParaTela(estado.origemFormularioDoce === 'compra-form' ? 'compra-form' : 'sweets');
}

function limparErrosFormularioDoce() {
  document.getElementById('erro-doce-nome').textContent = '';
  document.getElementById('erro-doce-valor').textContent = '';
  document.getElementById('doce-nome').classList.remove('is-invalido');
  document.getElementById('doce-valor').classList.remove('is-invalido');
}

function tratarEnvioFormularioDoce(evento) {
  evento.preventDefault();
  limparErrosFormularioDoce();

  const nome = document.getElementById('doce-nome').value.trim();
  const valor = Number(document.getElementById('doce-valor').value);
  let valido = true;

  if (nome.length < 2) {
    document.getElementById('erro-doce-nome').textContent = 'Informe o nome do doce.';
    document.getElementById('doce-nome').classList.add('is-invalido');
    valido = false;
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    document.getElementById('erro-doce-valor').textContent = 'Informe um valor válido.';
    document.getElementById('doce-valor').classList.add('is-invalido');
    valido = false;
  }
  if (!valido) return;

  const origem = estado.origemFormularioDoce;
  DB.salvarDoce({ id: estado.doceIdEmEdicao, nome, valor }).then((doceSalvo) => {
    mostrarToast(estado.doceIdEmEdicao ? 'Doce atualizado com sucesso!' : 'Doce cadastrado com sucesso!');
    estado.doceIdEmEdicao = null;
    if (origem === 'compra-form') {
      carregarOpcoesDoces(null, doceSalvo.id).then(() => irParaTela('compra-form'));
    } else {
      irParaTela('sweets');
    }
  }).catch(() => mostrarToast('Não foi possível salvar o doce.', 'erro'));
}

/* ------------------------------------------------------------
   5.1 TELA: INÍCIO
   ------------------------------------------------------------ */

function atualizarTelaHome() {
  Promise.all([DB.listarClientes(), DB.listarCompras()]).then(([clientes, compras]) => {
    document.getElementById('stat-total-clientes').textContent = clientes.length;

    const totalItensVendidos = compras.reduce((total, compra) => total + (Number(compra.quantidade) || 1), 0);
    document.getElementById('stat-total-itens-vendidos').textContent = totalItensVendidos.toLocaleString('pt-BR');
  });
  atualizarListaAtividades();
}

const rotulosAtividade = {
  client_created: 'Cliente cadastrado',
  client_updated: 'Cliente atualizado',
  client_deleted: 'Cliente excluído',
  purchase_created: 'Compra registrada',
  purchase_updated: 'Compra atualizada',
  purchase_deleted: 'Compra excluída',
  payment_received: 'Pagamento registrado',
  payment_reopened: 'Pagamento reaberto',
  payments_settled: 'Compras marcadas como pagas',
  sweet_created: 'Doce cadastrado',
  sweet_updated: 'Doce atualizado',
  sweet_deleted: 'Doce excluído'
};

function atualizarListaAtividades() {
  DB.listarAtividades().then(renderizarAtividades).catch((erro) => {
    console.error('Não foi possível carregar as atividades recentes:', erro);
    document.getElementById('lista-atividades').replaceChildren();
    document.getElementById('empty-atividades').hidden = false;
    document.querySelector('#empty-atividades p').textContent = 'Não foi possível carregar as atividades.';
  });
}

function renderizarAtividades(atividades) {
  const lista = document.getElementById('lista-atividades');
  const vazio = document.getElementById('empty-atividades');
  lista.replaceChildren();
  vazio.hidden = atividades.length !== 0;
  document.querySelector('#empty-atividades p').textContent = 'Nenhuma atividade registrada ainda.';

  atividades.forEach((atividade) => {
    const item = document.createElement('article');
    item.className = 'activity-item';
    const icone = document.createElement('span');
    icone.className = 'activity-item__icon';
    icone.setAttribute('aria-hidden', 'true');
    icone.textContent = atividade.entity_type === 'pagamento'
      ? 'R$'
      : atividade.entity_name.slice(0, 1).toLocaleUpperCase('pt-BR');

    const conteudo = document.createElement('div');
    conteudo.className = 'activity-item__content';
    const cabecalho = document.createElement('div');
    cabecalho.className = 'activity-item__heading';
    const rotulo = document.createElement('strong');
    rotulo.textContent = rotulosAtividade[atividade.event_type] || 'Atividade registrada';
    const horario = document.createElement('time');
    horario.className = 'activity-item__time';
    horario.dateTime = atividade.created_at;
    horario.textContent = new Date(atividade.created_at).toLocaleString('pt-BR', {
      dateStyle: 'short', timeStyle: 'short'
    });
    cabecalho.append(rotulo, horario);

    const detalhes = document.createElement('p');
    detalhes.className = 'activity-item__details';
    detalhes.textContent = [atividade.entity_name, atividade.details, `por ${atividade.actor_name}`]
      .filter(Boolean).join(' · ');
    conteudo.append(cabecalho, detalhes);
    item.append(icone, conteudo);
    lista.appendChild(item);
  });
}

let dadosPagamentosPendentes = null;

function atualizarTelaPagamentos() {
  Promise.all([DB.listarCompras(), DB.listarClientes()]).then(([compras, clientes]) => {
    dadosPagamentosPendentes = { compras, clientes };
    renderizarPagamentosPendentes(compras, clientes);
  });
}

function renderizarPagamentosPendentes(compras, clientes) {
  const lista = document.getElementById('lista-pagamentos-pendentes');
  const vazio = document.getElementById('empty-pagamentos-pendentes');
  const clientePorId = new Map(clientes.map((cliente) => [cliente.id, cliente]));
  const porData = new Map();
  const termoCliente = document.getElementById('busca-pagamentos-cliente').value.trim().toLocaleLowerCase('pt-BR');
  let totalPendenteCentavos = 0;

  compras.forEach((compra) => {
    const valorPendente = Math.max(0, paraCentavos(compra.valor) - paraCentavos(obterValorPagoCompra(compra)));
    const cliente = clientePorId.get(compra.clienteId);
    if (valorPendente === 0 || !cliente || !compra.data
      || (termoCliente && !cliente.nome.toLocaleLowerCase('pt-BR').includes(termoCliente))) return;

    totalPendenteCentavos += valorPendente;
    if (!porData.has(compra.data)) porData.set(compra.data, new Map());

    const clientesDoDia = porData.get(compra.data);
    const pendencia = clientesDoDia.get(cliente.id) || { cliente, valorCentavos: 0 };
    pendencia.valorCentavos += valorPendente;
    clientesDoDia.set(cliente.id, pendencia);
  });

  document.getElementById('total-pagamentos-pendentes').textContent = formatarMoeda(totalPendenteCentavos / 100);
  lista.replaceChildren();
  vazio.hidden = porData.size !== 0;
  vazio.querySelector('p').textContent = termoCliente
    ? 'Nenhum pagamento pendente encontrado para esse cliente.'
    : 'Nenhum pagamento pendente.';

  const ordenacaoData = document.getElementById('ordenacao-pagamentos-data').value;
  const ordenacaoValor = document.getElementById('ordenacao-pagamentos-valor').value;
  const gruposOrdenados = [...porData.entries()].map(([data, clientesDoDia]) => {
    const pendencias = [...clientesDoDia.values()].sort((a, b) => {
      if (ordenacaoValor === 'valor-maior') {
        return b.valorCentavos - a.valorCentavos || a.cliente.nome.localeCompare(b.cliente.nome, 'pt-BR');
      }
      return a.valorCentavos - b.valorCentavos || a.cliente.nome.localeCompare(b.cliente.nome, 'pt-BR');
    });
    const totalCentavos = pendencias.reduce((total, pendencia) => total + pendencia.valorCentavos, 0);
    return { data, pendencias, totalCentavos };
  });

  gruposOrdenados.sort((grupoA, grupoB) => {
    if (ordenacaoData === 'data-antiga') return grupoA.data.localeCompare(grupoB.data);
    return grupoB.data.localeCompare(grupoA.data);
  });

  gruposOrdenados.forEach(({ data, pendencias, totalCentavos }) => {
    const grupo = document.createElement('section');
    grupo.className = 'pending-day';

    const cabecalho = document.createElement('div');
    cabecalho.className = 'pending-day__header';
    cabecalho.innerHTML = `<h3>${formatarDataResumo(data)}</h3><span>${formatarMoeda(totalCentavos / 100)}</span>`;

    const itens = document.createElement('div');
    itens.className = 'pending-day__items';
    pendencias.forEach(({ cliente, valorCentavos }) => {
      const item = document.createElement('button');
      item.className = 'pending-item';
      item.type = 'button';
      item.setAttribute('aria-label', `${cliente.nome}, saldo pendente ${formatarMoeda(valorCentavos / 100)}. Abrir dados do cliente.`);
      item.innerHTML = `<span class="pending-item__name">${escaparHtml(cliente.nome)}</span><strong>${formatarMoeda(valorCentavos / 100)}</strong>`;
      item.addEventListener('click', () => abrirDetalheCliente(cliente));
      itens.appendChild(item);
    });

    grupo.append(cabecalho, itens);
    lista.appendChild(grupo);
  });
}

/* ------------------------------------------------------------
   5.2 TELA: CLIENTES (lista + busca)
   ------------------------------------------------------------ */

function atualizarTelaClientes() {
  DB.listarClientes().then((clientes) => {
    const total = clientes.length;
    document.getElementById('clients-subtitulo').textContent =
      total === 1 ? '1 cliente cadastrado' : `${total} clientes cadastrados`;

    document.getElementById('empty-clientes').hidden = total !== 0;
    document.getElementById('client-table').hidden = total === 0;

    if (total === 0) {
      document.getElementById('empty-busca').hidden = true;
      document.getElementById('lista-clientes').innerHTML = '';
      return;
    }

    renderizarListaFiltrada(clientes);
  });
}

function renderizarListaFiltrada(todosClientes) {
  const termo = estado.termoBusca.trim().toLowerCase();
  const termoNumerico = apenasNumeros(estado.termoBusca);

  const filtrados = todosClientes
    .filter((cliente) => {
      if (!termo) return true;
      const nomeCorresponde = cliente.nome.toLowerCase().includes(termo);
      const celularCorresponde = termoNumerico
        ? apenasNumeros(cliente.celular || '').includes(termoNumerico)
        : false;
      return nomeCorresponde || celularCorresponde;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const container = document.getElementById('lista-clientes');
  container.innerHTML = '';

  const semResultado = termo.length > 0 && filtrados.length === 0;
  document.getElementById('empty-busca').hidden = !semResultado;
  document.getElementById('client-table').hidden = semResultado;

  filtrados.forEach((cliente) => {
    container.appendChild(criarLinhaCliente(cliente));
  });
}

function criarLinhaCliente(cliente) {
  const linha = document.createElement('div');
  linha.className = 'client-row';
  const celular = cliente.celular?.trim();
  linha.innerHTML = `
    <div class="client-row__nome">${escaparHtml(cliente.nome)}</div>
    ${celular ? `<a class="client-row__celular" href="tel:${apenasNumeros(celular)}"><span class="btn__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.4A19.5 19.5 0 0 1 3.2 9.8 2 2 0 0 1 5.1 8h3a2 2 0 0 1 2 1.7l.4 2.1a2 2 0 0 1-.6 1.8L8.3 14a16 16 0 0 0 5.7 5.7l.4-.6a2 2 0 0 1 1.8-.6l2.1.4A2 2 0 0 1 18.3 20Z"/></svg></span>${escaparHtml(celular)}</a>` : '<span class="client-row__celular">Número não informado</span>'}
    <div class="client-row__acoes">
      <button class="client-row__acao client-row__acao--compra" type="button">
        <span class="btn__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span>
        <span class="btn__label">Nova compra</span>
      </button>
      <button class="client-row__acao client-row__acao--editar" type="button">
        <span class="btn__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="m16.5 3.5 4 4L7 21l-5 1 1-5 14.5-13.5Z"/></svg></span>
        <span class="btn__label">Editar</span>
      </button>
      <button class="client-row__acao client-row__acao--excluir" type="button">
        <span class="btn__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 13h8l1-13"/></svg></span>
        <span class="btn__label">Excluir</span>
      </button>
    </div>
  `;

  linha.querySelector('.client-row__acoes').hidden = estado.papelUsuario !== 'admin';
  linha.addEventListener('click', () => abrirDetalheCliente(cliente));
  linha.querySelector('.client-row__celular')?.addEventListener('click', (evento) => evento.stopPropagation());
  linha.querySelector('.client-row__acao--compra').addEventListener('click', (evento) => {
    evento.stopPropagation();
    estado.clienteDetalheAtual = cliente;
    abrirFormularioCompra('novo');
  });
  linha.querySelector('.client-row__acao--editar').addEventListener('click', (evento) => {
    evento.stopPropagation();
    abrirFormulario('editar', cliente, 'clients');
  });
  linha.querySelector('.client-row__acao--excluir').addEventListener('click', (evento) => {
    evento.stopPropagation();
    abrirModalConfirmacao(cliente);
  });

  return linha;
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

/* ------------------------------------------------------------
   5.3 FORMULÁRIO: validar e salvar
   ------------------------------------------------------------ */

function limparErrosFormulario() {
  document.getElementById('erro-nome').textContent = '';
  document.getElementById('erro-celular').textContent = '';
  document.getElementById('cliente-nome').classList.remove('is-invalido');
  document.getElementById('cliente-celular').classList.remove('is-invalido');
}

function validarFormulario(nome, celular) {
  limparErrosFormulario();
  let valido = true;

  if (nome.trim().length < 3) {
    document.getElementById('erro-nome').textContent = 'Informe o nome completo.';
    document.getElementById('cliente-nome').classList.add('is-invalido');
    valido = false;
  }

  const numeros = apenasNumeros(celular);
  if (numeros.length > 0 && (numeros.length < 10 || numeros.length > 11)) {
    document.getElementById('erro-celular').textContent = 'Informe um celular válido com DDD.';
    document.getElementById('cliente-celular').classList.add('is-invalido');
    valido = false;
  }

  return valido;
}

function tratarEnvioFormulario(evento) {
  evento.preventDefault();

  const nome = document.getElementById('cliente-nome').value;
  const celular = document.getElementById('cliente-celular').value;

  if (!validarFormulario(nome, celular)) return;

  const dados = {
    id: estado.idEmEdicao,
    nome: nome.trim(),
    celular: celular.trim()
  };

  DB.salvarCliente(dados).then((clienteSalvo) => {
    mostrarToast(estado.idEmEdicao ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
    estado.idEmEdicao = null;

    if (estado.origemFormularioCliente === 'detalhe') {
      estado.clienteDetalheAtual = clienteSalvo;
      document.getElementById('detalhe-nome').textContent = clienteSalvo.nome;
      document.getElementById('detalhe-celular').textContent = clienteSalvo.celular;
      irParaTela('detalhe');
      atualizarTelaDetalhe();
    } else {
      irParaTela('clients');
    }
  }).catch(() => {
    mostrarToast('Não foi possível salvar o cliente.', 'erro');
  });
}

/* ------------------------------------------------------------
   5.4 TELA: DETALHE DO CLIENTE (perfil + histórico de compras)
   ------------------------------------------------------------ */

function abrirDetalheCliente(cliente) {
  estado.clienteDetalheAtual = cliente;
  document.getElementById('detalhe-nome').textContent = cliente.nome;
  document.getElementById('detalhe-celular').textContent = cliente.celular;
  irParaTela('detalhe');
  atualizarTelaDetalhe();
}

function atualizarTelaDetalhe() {
  const cliente = estado.clienteDetalheAtual;
  if (!cliente) return;

  DB.listarComprasPorCliente(cliente.id).then((compras) => {
    const totalGasto = compras.reduce((soma, c) => soma + Number(c.valor || 0), 0);
    const totalPago = compras.reduce((soma, compra) => soma + obterValorPagoCompra(compra), 0);
    document.getElementById('detalhe-total-gasto').textContent = formatarMoeda(totalGasto);
    document.getElementById('detalhe-total-pago').textContent = formatarMoeda(totalPago);
    document.getElementById('detalhe-saldo-devedor').textContent = formatarMoeda(Math.max(0, totalGasto - totalPago));
    document.getElementById('detalhe-qtd-compras').textContent = compras.length;
    const temSaldoPendente = compras.some((compra) => obterValorPagoCompra(compra) < Number(compra.valor));
    const podeEditar = estado.papelUsuario === 'admin';
    document.getElementById('btn-marcar-todas-pagas').hidden = !podeEditar || !temSaldoPendente;
    document.getElementById('btn-registrar-pagamento').hidden = !podeEditar || !temSaldoPendente;

    const ordenadas = [...compras].sort((a, b) => new Date(b.data) - new Date(a.data));

    const lista = document.getElementById('lista-compras');
    lista.innerHTML = '';
    document.getElementById('empty-compras').hidden = ordenadas.length !== 0;

    ordenadas.forEach((compra) => lista.appendChild(criarLinhaCompra(compra)));
  });
}

function abrirModalPagamento() {
  const cliente = estado.clienteDetalheAtual;
  if (!cliente) return;

  DB.listarComprasPorCliente(cliente.id).then((compras) => {
    const saldoCentavos = compras.reduce((saldo, compra) => {
      return saldo + paraCentavos(compra.valor) - paraCentavos(obterValorPagoCompra(compra));
    }, 0);
    const saldo = Math.max(0, saldoCentavos) / 100;
    if (saldo <= 0) {
      mostrarToast('Este cliente não possui saldo em aberto.');
      atualizarTelaDetalhe();
      return;
    }

    document.getElementById('modal-pagamento-saldo').textContent = `Saldo em aberto: ${formatarMoeda(saldo)}`;
    const campoValor = document.getElementById('pagamento-valor');
    campoValor.max = saldo.toFixed(2);
    campoValor.value = '';
    document.getElementById('erro-pagamento-valor').textContent = '';
    campoValor.classList.remove('is-invalido');
    document.getElementById('modal-pagamento').hidden = false;
    campoValor.focus({ preventScroll: true });
  });
}

function fecharModalPagamento() {
  document.getElementById('modal-pagamento').hidden = true;
  document.getElementById('form-pagamento').reset();
  document.getElementById('erro-pagamento-valor').textContent = '';
  document.getElementById('pagamento-valor').classList.remove('is-invalido');
}

function tratarEnvioFormularioPagamento(evento) {
  evento.preventDefault();
  const campoValor = document.getElementById('pagamento-valor');
  const erro = document.getElementById('erro-pagamento-valor');
  const valor = Number(campoValor.value);
  erro.textContent = '';
  campoValor.classList.remove('is-invalido');

  if (!Number.isFinite(valor) || valor <= 0) {
    erro.textContent = 'Informe um valor maior que zero.';
    campoValor.classList.add('is-invalido');
    return;
  }

  DB.registrarPagamentoCliente(estado.clienteDetalheAtual.id, valor, estado.clienteDetalheAtual.nome).then((resultado) => {
    fecharModalPagamento();
    mostrarToast(`Pagamento de ${formatarMoeda(resultado.valorPago)} registrado. Saldo: ${formatarMoeda(resultado.saldoDevedor)}.`);
    atualizarTelaDetalhe();
    atualizarTelaHome();
  }).catch((erroPagamento) => {
    erro.textContent = erroPagamento.message || 'Não foi possível registrar o pagamento.';
    campoValor.classList.add('is-invalido');
  });
}

function criarLinhaCompra(compra) {
  const linha = document.createElement('div');
  linha.className = 'compra-row';
  const valorTotal = Number(compra.valor) || 0;
  const valorPago = obterValorPagoCompra(compra);
  const paga = valorPago >= valorTotal;
  const classeStatus = paga ? 'compra-row__status--pago' : '';
  const textoStatus = paga
    ? `Pago${compra.dataPagamento ? ` em ${formatarDataResumo(compra.dataPagamento)}` : ''}`
    : valorPago > 0 ? `Pagamento parcial: ${formatarMoeda(valorPago)} pago` : 'Pagamento pendente';
  const textoAcaoPagamento = paga ? 'Reabrir pagamento' : valorPago > 0 ? 'Quitar saldo' : 'Marcar pago';

  linha.innerHTML = `
    <div class="compra-row__cabecalho">
      <div class="compra-row__info">
        <div class="compra-row__descricao">${escaparHtml(compra.descricao)}</div>
        <div class="compra-row__quantidade">${Number(compra.quantidade) || 1} × ${formatarMoeda(compra.valorUnitario ?? (Number(compra.valor) / (Number(compra.quantidade) || 1)))}</div>
        <div class="compra-row__data">Compra em ${formatarDataResumo(compra.data)}</div>
      </div>
      <strong class="compra-row__valor">${formatarMoeda(compra.valor)}</strong>
    </div>
    <div class="compra-row__rodape">
      <span class="compra-row__status ${classeStatus}">${textoStatus}</span>
      <div class="compra-row__acoes">
        <button class="compra-row__acao-pagamento" type="button">${textoAcaoPagamento}</button>
        <button class="icon-btn" type="button" aria-label="Editar compra"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="m16.5 3.5 4 4L7 21l-5 1 1-5 14.5-13.5Z"/></svg></button>
        <button class="icon-btn" type="button" aria-label="Excluir compra"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 13h8l1-13"/></svg></button>
      </div>
    </div>
  `;

  linha.querySelector('.compra-row__acoes').hidden = estado.papelUsuario !== 'admin';
  linha.querySelector('.compra-row__acao-pagamento').addEventListener('click', () => {
    DB.atualizarPagamentoCompra(compra.id, !paga, compra).then(() => {
      mostrarToast(paga ? 'Pagamento reaberto.' : 'Compra marcada como paga.');
      atualizarTelaDetalhe();
      atualizarTelaHome();
    }).catch(() => mostrarToast('Não foi possível atualizar o pagamento.', 'erro'));
  });
  linha.querySelector('[aria-label="Editar compra"]').addEventListener('click', () => {
    abrirFormularioCompra('editar', compra);
  });
  linha.querySelector('[aria-label="Excluir compra"]').addEventListener('click', () => {
    abrirModalConfirmacaoCompra(compra);
  });

  return linha;
}

/* ------------------------------------------------------------
   5.5 FORMULÁRIO DE COMPRA: abrir, validar e salvar
   ------------------------------------------------------------ */

function abrirFormularioCompra(modo, compra) {
  const formulario = document.getElementById('form-compra');
  formulario.reset();
  limparErrosFormularioCompra();

  document.getElementById('compra-cliente-id').value = estado.clienteDetalheAtual.id;

  if (modo === 'editar' && compra) {
    estado.compraIdEmEdicao = compra.id;
    document.getElementById('compra-form-titulo').textContent = 'Editar compra';
    document.getElementById('compra-id').value = compra.id;
    document.getElementById('compra-data').value = compra.data;
    document.getElementById('compra-quantidade').value = compra.quantidade || 1;
    carregarOpcoesDoces(compra);
  } else {
    estado.compraIdEmEdicao = null;
    document.getElementById('compra-form-titulo').textContent = 'Nova compra';
    document.getElementById('compra-id').value = '';
    document.getElementById('compra-data').value = obterDataLocalISO();
    document.getElementById('compra-quantidade').value = 1;
    carregarOpcoesDoces();
  }

  irParaTela('compra-form');
  document.getElementById('compra-doce').focus({ preventScroll: true });
}

function carregarOpcoesDoces(compraAtual, doceSelecionadoId) {
  const seletor = document.getElementById('compra-doce');
  seletor.replaceChildren(new Option('Selecione um doce', ''));

  return DB.listarDoces().then((doces) => {
    if (compraAtual) {
      const historico = new Option(
        `${compraAtual.descricao} (valor salvo: ${formatarMoeda(compraAtual.valor)})`,
        `historico-${compraAtual.id}`
      );
      historico.dataset.tipo = 'historico';
      historico.dataset.nome = compraAtual.descricao;
      historico.dataset.valor = compraAtual.valorUnitario ?? (Number(compraAtual.valor) / (Number(compraAtual.quantidade) || 1));
      historico.dataset.doceId = compraAtual.doceId || '';
      seletor.add(historico);
    }

    doces.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).forEach((doce) => {
      const opcao = new Option(`${doce.nome} · ${formatarMoeda(doce.valor)}`, String(doce.id));
      opcao.dataset.nome = doce.nome;
      opcao.dataset.valor = doce.valor;
      seletor.add(opcao);
    });

    if (doceSelecionadoId) seletor.value = String(doceSelecionadoId);
    else if (compraAtual) seletor.value = `historico-${compraAtual.id}`;
    atualizarValorCompra();
    return doces;
  });
}

function atualizarValorCompra() {
  const seletor = document.getElementById('compra-doce');
  const opcao = seletor.selectedOptions[0];
  const valorUnitario = Number(opcao?.dataset.valor);
  const quantidade = Number(document.getElementById('compra-quantidade').value);
  document.getElementById('compra-valor').value = valorUnitario > 0 && quantidade > 0
    ? (valorUnitario * quantidade).toFixed(2)
    : '';
}

function limparErrosFormularioCompra() {
  document.getElementById('erro-compra-doce').textContent = '';
  document.getElementById('erro-compra-quantidade').textContent = '';
  document.getElementById('erro-compra-valor').textContent = '';
  document.getElementById('compra-doce').classList.remove('is-invalido');
  document.getElementById('compra-quantidade').classList.remove('is-invalido');
  document.getElementById('compra-valor').classList.remove('is-invalido');
}

function validarFormularioCompra(doceSelecionado, quantidade, valor) {
  limparErrosFormularioCompra();
  let valido = true;

  if (!doceSelecionado) {
    document.getElementById('erro-compra-doce').textContent = 'Selecione um doce cadastrado.';
    document.getElementById('compra-doce').classList.add('is-invalido');
    valido = false;
  }

  if (!Number.isInteger(quantidade) || quantidade < 1) {
    document.getElementById('erro-compra-quantidade').textContent = 'Informe uma quantidade inteira maior que zero.';
    document.getElementById('compra-quantidade').classList.add('is-invalido');
    valido = false;
  }

  if (isNaN(valor) || valor <= 0) {
    document.getElementById('erro-compra-valor').textContent = 'Informe um valor válido.';
    document.getElementById('compra-valor').classList.add('is-invalido');
    valido = false;
  }

  return valido;
}

function tratarEnvioFormularioCompra(evento) {
  evento.preventDefault();

  const seletorDoce = document.getElementById('compra-doce');
  const opcaoDoce = seletorDoce.selectedOptions[0];
  const descricao = opcaoDoce?.dataset.nome || '';
  const valorUnitario = Number(opcaoDoce?.dataset.valor);
  const quantidade = Number(document.getElementById('compra-quantidade').value);
  const valor = valorUnitario * quantidade;
  const data = document.getElementById('compra-data').value || obterDataLocalISO();

  if (!validarFormularioCompra(seletorDoce.value, quantidade, valor)) return;

  const doceId = opcaoDoce.dataset.tipo === 'historico'
    ? (opcaoDoce.dataset.doceId || null)
    : opcaoDoce.value;

  const dados = {
    id: estado.compraIdEmEdicao,
    clienteId: document.getElementById('compra-cliente-id').value,
    doceId,
    descricao: descricao.trim(),
    quantidade,
    valorUnitario,
    valor: valor,
    data: data,
    clienteNome: estado.clienteDetalheAtual.nome
  };

  DB.salvarCompra(dados).then(() => {
    mostrarToast(estado.compraIdEmEdicao ? 'Compra atualizada com sucesso!' : 'Compra registrada com sucesso!');
    estado.compraIdEmEdicao = null;
    irParaTela('detalhe');
    atualizarTelaDetalhe();
  }).catch(() => {
    mostrarToast('Não foi possível salvar a compra.', 'erro');
  });
}

/* ------------------------------------------------------------
   6. MODAL DE CONFIRMAÇÃO (excluir cliente)
   ------------------------------------------------------------ */

function abrirModalConfirmacao(cliente) {
  estado.exclusao = { tipo: 'cliente', id: cliente.id, nome: cliente.nome };
  document.getElementById('modal-confirm-titulo').textContent = 'Excluir cliente?';
  document.getElementById('modal-confirm-texto').textContent =
    `Tem certeza de que deseja excluir "${cliente.nome}"? As compras registradas dele também serão apagadas.`;
  document.getElementById('modal-confirm').hidden = false;
}

function abrirModalConfirmacaoCompra(compra) {
  estado.exclusao = { tipo: 'compra', id: compra.id, nome: compra.descricao, nomeCliente: estado.clienteDetalheAtual?.nome };
  document.getElementById('modal-confirm-titulo').textContent = 'Excluir compra?';
  document.getElementById('modal-confirm-texto').textContent =
    `Tem certeza de que deseja excluir "${compra.descricao}"? Essa ação não pode ser desfeita.`;
  document.getElementById('modal-confirm').hidden = false;
}

function abrirModalConfirmacaoDoce(doce) {
  estado.exclusao = { tipo: 'doce', id: doce.id, nome: doce.nome };
  document.getElementById('modal-confirm-titulo').textContent = 'Excluir doce?';
  document.getElementById('modal-confirm-texto').textContent =
    `Tem certeza de que deseja excluir "${doce.nome}" do catálogo? Compras já registradas não serão alteradas.`;
  document.getElementById('modal-confirm').hidden = false;
}

function fecharModalConfirmacao() {
  estado.exclusao = null;
  document.getElementById('modal-confirm').hidden = true;
}

function confirmarExclusao() {
  if (!estado.exclusao) return;
  const { tipo, id, nome, nomeCliente } = estado.exclusao;

  if (tipo === 'cliente') {
    DB.excluirCliente(id, nome).then(() => {
      mostrarToast('Cliente excluído.');
      fecharModalConfirmacao();
      if (estado.telaAtual === 'detalhe') irParaTela('clients');
      else if (estado.telaAtual === 'clients') atualizarTelaClientes();
      atualizarTelaHome();
    });
  } else if (tipo === 'compra') {
    DB.excluirCompra(id, nome, nomeCliente).then(() => {
      mostrarToast('Compra excluída.');
      fecharModalConfirmacao();
      atualizarTelaDetalhe();
      atualizarTelaHome();
    });
  } else {
    DB.excluirDoce(id, nome).then(() => {
      mostrarToast('Doce excluído do catálogo.');
      fecharModalConfirmacao();
      atualizarTelaDoces();
    });
  }
}

/* ------------------------------------------------------------
   7. INICIALIZAÇÃO E EVENTOS
   ------------------------------------------------------------ */

function iniciar() {
  // Navegação (menu hambúrguer no celular / lateral no computador)
  const botaoMenu = document.getElementById('nav-toggle');
  const navegacao = document.getElementById('nav');
  botaoMenu.addEventListener('click', () => {
    definirMenuAberto(botaoMenu.getAttribute('aria-expanded') !== 'true');
  });
  navegacao.addEventListener('click', (evento) => {
    if (evento.target.closest('.nav__item') && !window.matchMedia('(min-width: 860px)').matches) {
      definirMenuAberto(false, true);
    }
  });
  document.addEventListener('click', (evento) => {
    if (!navegacao.contains(evento.target) && botaoMenu.getAttribute('aria-expanded') === 'true') {
      definirMenuAberto(false);
    }
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && botaoMenu.getAttribute('aria-expanded') === 'true') {
      definirMenuAberto(false, true);
    }
  });
  window.addEventListener('resize', sincronizarMenuComTela);
  sincronizarMenuComTela();

  document.querySelectorAll('.nav__item[data-screen]').forEach((item) => {
    item.addEventListener('click', () => irParaTela(item.dataset.screen));
  });

  // Botões que abrem o formulário de novo cadastro
  document.querySelectorAll('[data-abrir-form="novo"]').forEach((botao) => {
    botao.addEventListener('click', () => abrirFormulario('novo'));
  });

  document.getElementById('btn-voltar-form').addEventListener('click', voltarDoFormularioCliente);
  document.getElementById('btn-cancelar-form').addEventListener('click', voltarDoFormularioCliente);

  document.getElementById('form-cliente').addEventListener('submit', tratarEnvioFormulario);

  // Catálogo de doces
  document.getElementById('btn-novo-doce').addEventListener('click', () => abrirFormularioDoce('novo'));
  document.getElementById('btn-cadastrar-primeiro-doce').addEventListener('click', () => abrirFormularioDoce('novo'));
  document.getElementById('btn-voltar-doce-form').addEventListener('click', voltarDoFormularioDoce);
  document.getElementById('btn-cancelar-doce-form').addEventListener('click', voltarDoFormularioDoce);
  document.getElementById('form-doce').addEventListener('submit', tratarEnvioFormularioDoce);
  document.getElementById('btn-cadastrar-doce-compra').addEventListener('click', () => {
    abrirFormularioDoce('novo', null, 'compra-form');
  });

  // Tela de detalhe do cliente
  document.getElementById('btn-voltar-detalhe').addEventListener('click', () => irParaTela('clients'));
  document.getElementById('btn-detalhe-editar').addEventListener('click', () => {
    abrirFormulario('editar', estado.clienteDetalheAtual, 'detalhe');
  });
  document.getElementById('btn-detalhe-excluir').addEventListener('click', () => {
    abrirModalConfirmacao(estado.clienteDetalheAtual);
  });
  document.getElementById('btn-nova-compra').addEventListener('click', () => abrirFormularioCompra('novo'));
  document.getElementById('btn-marcar-todas-pagas').addEventListener('click', () => {
    const cliente = estado.clienteDetalheAtual;
    if (!cliente) return;

    DB.marcarComprasDoClienteComoPagas(cliente.id, cliente.nome).then((quantidadeAtualizada) => {
      if (quantidadeAtualizada === 0) return;
      mostrarToast('Todas as compras foram marcadas como pagas.');
      atualizarTelaDetalhe();
      atualizarTelaHome();
    }).catch(() => mostrarToast('Não foi possível atualizar os pagamentos.', 'erro'));
  });
  document.getElementById('btn-registrar-pagamento').addEventListener('click', abrirModalPagamento);
  document.getElementById('form-pagamento').addEventListener('submit', tratarEnvioFormularioPagamento);
  document.getElementById('btn-pagamento-cancelar').addEventListener('click', fecharModalPagamento);
  document.getElementById('modal-pagamento').addEventListener('click', (evento) => {
    if (evento.target.id === 'modal-pagamento') fecharModalPagamento();
  });

  // Formulário de compra
  const voltarDaCompra = () => { irParaTela('detalhe'); atualizarTelaDetalhe(); };
  document.getElementById('btn-voltar-compra-form').addEventListener('click', voltarDaCompra);
  document.getElementById('btn-cancelar-compra-form').addEventListener('click', voltarDaCompra);
  document.getElementById('form-compra').addEventListener('submit', tratarEnvioFormularioCompra);
  document.getElementById('compra-doce').addEventListener('change', atualizarValorCompra);
  document.getElementById('compra-quantidade').addEventListener('input', atualizarValorCompra);

  document.getElementById('cliente-celular').addEventListener('input', (evento) => {
    evento.target.value = aplicarMascaraCelular(evento.target.value);
  });

  // Busca de clientes
  document.getElementById('input-busca').addEventListener('input', (evento) => {
    estado.termoBusca = evento.target.value;
    DB.listarClientes().then(renderizarListaFiltrada);
  });

  const atualizarOrdenacaoPagamentos = () => {
    if (dadosPagamentosPendentes) {
      renderizarPagamentosPendentes(dadosPagamentosPendentes.compras, dadosPagamentosPendentes.clientes);
    }
  };
  document.getElementById('ordenacao-pagamentos-data').addEventListener('change', atualizarOrdenacaoPagamentos);
  document.getElementById('ordenacao-pagamentos-valor').addEventListener('change', atualizarOrdenacaoPagamentos);
  document.getElementById('busca-pagamentos-cliente').addEventListener('input', atualizarOrdenacaoPagamentos);
  document.getElementById('limpar-filtros-pagamentos').addEventListener('click', () => {
    document.getElementById('ordenacao-pagamentos-data').value = 'data-recente';
    document.getElementById('ordenacao-pagamentos-valor').value = 'valor-menor';
    document.getElementById('busca-pagamentos-cliente').value = '';
    atualizarOrdenacaoPagamentos();
  });

  // Modal de exclusão
  document.getElementById('btn-modal-cancelar').addEventListener('click', fecharModalConfirmacao);
  document.getElementById('btn-modal-confirmar').addEventListener('click', confirmarExclusao);
  document.getElementById('modal-confirm').addEventListener('click', (evento) => {
    if (evento.target.id === 'modal-confirm') fecharModalConfirmacao();
  });

  atualizarTelaHome();
}

document.addEventListener('DOMContentLoaded', iniciarAutenticacao);
