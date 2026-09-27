/* ================================================================
   Doce Gestão — script.js
   Organização do arquivo:
   1. DB      -> camada de dados (hoje: localStorage)
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
   Todas as funções retornam Promises de propósito: assim, no
   futuro, dá para trocar o corpo de cada método por uma chamada
   fetch() a uma API/banco de dados real, sem precisar reescrever
   as telas que consomem esses dados.

   Estrutura pensada para crescer: quando "Compras" e "Histórico
   de compras" forem criados, basta adicionar uma nova chave
   (ex.: DB.KEYS.COMPRAS) e novos métodos (listarCompras,
   salvarCompra...), seguindo o mesmo padrão do módulo Clientes.
   ------------------------------------------------------------ */

const DB = {
  KEYS: {
    CLIENTES: 'docegestao_clientes',
    NEXT_ID: 'docegestao_next_id_cliente',
    COMPRAS: 'docegestao_compras',
    NEXT_ID_COMPRA: 'docegestao_next_id_compra',
    DOCES: 'docegestao_doces',
    NEXT_ID_DOCE: 'docegestao_next_id_doce'
  },

  _lerLista(chave) {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? JSON.parse(bruto) : [];
    } catch (erro) {
      console.error('Não foi possível ler os dados salvos:', erro);
      return [];
    }
  },

  _salvarLista(chave, lista) {
    localStorage.setItem(chave, JSON.stringify(lista));
  },

  _gerarProximoId(chaveContador) {
    const atual = parseInt(localStorage.getItem(chaveContador) || '1', 10);
    localStorage.setItem(chaveContador, String(atual + 1));
    return atual;
  },

  // ---------- Clientes ----------

  listarClientes() {
    return Promise.resolve(this._lerLista(this.KEYS.CLIENTES));
  },

  buscarClientePorId(id) {
    const clientes = this._lerLista(this.KEYS.CLIENTES);
    return Promise.resolve(clientes.find((c) => c.id === id) || null);
  },

  salvarCliente(dadosCliente) {
    const clientes = this._lerLista(this.KEYS.CLIENTES);

    if (dadosCliente.id) {
      // Edição
      const indice = clientes.findIndex((c) => c.id === dadosCliente.id);
      if (indice === -1) return Promise.reject(new Error('Cliente não encontrado.'));
      clientes[indice] = {
        ...clientes[indice],
        nome: dadosCliente.nome,
        celular: dadosCliente.celular,
        atualizadoEm: new Date().toISOString()
      };
      this._salvarLista(this.KEYS.CLIENTES, clientes);
      return Promise.resolve(clientes[indice]);
    }

    // Cadastro novo
    const novoCliente = {
      id: this._gerarProximoId(this.KEYS.NEXT_ID),
      nome: dadosCliente.nome,
      celular: dadosCliente.celular,
      criadoEm: new Date().toISOString()
      // Campo que poderá ser usado por uma futura indicação automática
      // de "próxima compra prevista": previsaoProximaCompraEm: null
    };
    clientes.push(novoCliente);
    this._salvarLista(this.KEYS.CLIENTES, clientes);
    return Promise.resolve(novoCliente);
  },

  excluirCliente(id) {
    const clientes = this._lerLista(this.KEYS.CLIENTES);
    const restantes = clientes.filter((c) => c.id !== id);
    this._salvarLista(this.KEYS.CLIENTES, restantes);
    // Ao excluir o cliente, as compras dele também são removidas.
    return this.excluirComprasDoCliente(id).then(() => true);
  },

  // ---------- Compras ----------
  // Cada compra pertence a um cliente (clienteId). É esse vínculo que
  // permite montar o histórico de compras e, futuramente, calcular
  // quando o cliente poderá fazer uma nova compra.

  listarCompras() {
    return Promise.resolve(this._lerLista(this.KEYS.COMPRAS));
  },

  listarComprasPorCliente(clienteId) {
    const compras = this._lerLista(this.KEYS.COMPRAS).filter((c) => c.clienteId === clienteId);
    return Promise.resolve(compras);
  },

  salvarCompra(dadosCompra) {
    const compras = this._lerLista(this.KEYS.COMPRAS);

    if (dadosCompra.id) {
      // Edição
      const indice = compras.findIndex((c) => c.id === dadosCompra.id);
      if (indice === -1) return Promise.reject(new Error('Compra não encontrada.'));
      const valorPago = Math.min(obterValorPagoCompra(compras[indice]), Number(dadosCompra.valor));
      const estaPaga = valorPago >= Number(dadosCompra.valor);
      compras[indice] = {
        ...compras[indice],
        doceId: dadosCompra.doceId,
        descricao: dadosCompra.descricao,
        quantidade: dadosCompra.quantidade,
        valorUnitario: dadosCompra.valorUnitario,
        valor: dadosCompra.valor,
        data: dadosCompra.data,
        valorPago,
        pago: estaPaga,
        dataPagamento: estaPaga ? compras[indice].dataPagamento || obterDataLocalISO() : null
      };
      this._salvarLista(this.KEYS.COMPRAS, compras);
      return Promise.resolve(compras[indice]);
    }

    // Cadastro novo
    const novaCompra = {
      id: this._gerarProximoId(this.KEYS.NEXT_ID_COMPRA),
      clienteId: dadosCompra.clienteId,
      doceId: dadosCompra.doceId,
      descricao: dadosCompra.descricao,
      quantidade: dadosCompra.quantidade,
      valorUnitario: dadosCompra.valorUnitario,
      valor: dadosCompra.valor,
      data: dadosCompra.data,
      valorPago: 0,
      pago: false,
      dataPagamento: null,
      criadoEm: new Date().toISOString()
    };
    compras.push(novaCompra);
    this._salvarLista(this.KEYS.COMPRAS, compras);
    return Promise.resolve(novaCompra);
  },

  atualizarPagamentoCompra(id, pago) {
    const compras = this._lerLista(this.KEYS.COMPRAS);
    const indice = compras.findIndex((compra) => compra.id === id);
    if (indice === -1) return Promise.reject(new Error('Compra não encontrada.'));

    compras[indice] = {
      ...compras[indice],
      pago,
      valorPago: pago ? Number(compras[indice].valor) : 0,
      dataPagamento: pago ? obterDataLocalISO() : null
    };
    this._salvarLista(this.KEYS.COMPRAS, compras);
    return Promise.resolve(compras[indice]);
  },

  marcarComprasDoClienteComoPagas(clienteId) {
    const compras = this._lerLista(this.KEYS.COMPRAS);
    const dataPagamento = obterDataLocalISO();
    let atualizadas = 0;
    const comprasAtualizadas = compras.map((compra) => {
      if (compra.clienteId !== clienteId || compra.pago) return compra;
      atualizadas += 1;
      return { ...compra, valorPago: Number(compra.valor), pago: true, dataPagamento };
    });

    if (atualizadas > 0) this._salvarLista(this.KEYS.COMPRAS, comprasAtualizadas);
    return Promise.resolve(atualizadas);
  },

  registrarPagamentoCliente(clienteId, valor) {
    const compras = this._lerLista(this.KEYS.COMPRAS);
    const comprasDoCliente = compras
      .filter((compra) => compra.clienteId === clienteId)
      .sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);
    const valorPagamentoCentavos = paraCentavos(valor);
    const saldoInicialCentavos = comprasDoCliente.reduce((saldo, compra) => {
      return saldo + paraCentavos(compra.valor) - paraCentavos(obterValorPagoCompra(compra));
    }, 0);

    if (valorPagamentoCentavos <= 0) {
      return Promise.reject(new Error('Informe um valor de pagamento maior que zero.'));
    }
    if (valorPagamentoCentavos > saldoInicialCentavos) {
      return Promise.reject(new Error('O pagamento não pode ser maior que o saldo em aberto.'));
    }

    let restanteCentavos = valorPagamentoCentavos;
    const dataPagamento = obterDataLocalISO();
    const atualizadasPorId = new Map();

    comprasDoCliente.forEach((compra) => {
      const totalCentavos = paraCentavos(compra.valor);
      const pagoAntesCentavos = paraCentavos(obterValorPagoCompra(compra));
      const aplicadoCentavos = Math.min(totalCentavos - pagoAntesCentavos, restanteCentavos);
      const valorPagoCentavos = pagoAntesCentavos + aplicadoCentavos;
      const estaPaga = valorPagoCentavos >= totalCentavos;

      if (aplicadoCentavos > 0 || compra.valorPago === undefined) {
        atualizadasPorId.set(compra.id, {
          ...compra,
          valorPago: valorPagoCentavos / 100,
          pago: estaPaga,
          dataPagamento: estaPaga ? compra.dataPagamento || dataPagamento : null
        });
      }
      restanteCentavos -= aplicadoCentavos;
    });

    const comprasAtualizadas = compras.map((compra) => atualizadasPorId.get(compra.id) || compra);
    this._salvarLista(this.KEYS.COMPRAS, comprasAtualizadas);
    return Promise.resolve({
      valorPago: valorPagamentoCentavos / 100,
      saldoDevedor: (saldoInicialCentavos - valorPagamentoCentavos) / 100
    });
  },

  excluirCompra(id) {
    const compras = this._lerLista(this.KEYS.COMPRAS);
    const restantes = compras.filter((c) => c.id !== id);
    this._salvarLista(this.KEYS.COMPRAS, restantes);
    return Promise.resolve(true);
  },

  excluirComprasDoCliente(clienteId) {
    const compras = this._lerLista(this.KEYS.COMPRAS);
    const restantes = compras.filter((c) => c.clienteId !== clienteId);
    this._salvarLista(this.KEYS.COMPRAS, restantes);
    return Promise.resolve(true);
  },

  // ---------- Catálogo de doces ----------

  listarDoces() {
    return Promise.resolve(this._lerLista(this.KEYS.DOCES));
  },

  salvarDoce(dadosDoce) {
    const doces = this._lerLista(this.KEYS.DOCES);

    if (dadosDoce.id) {
      const indice = doces.findIndex((doce) => doce.id === dadosDoce.id);
      if (indice === -1) return Promise.reject(new Error('Doce não encontrado.'));
      doces[indice] = {
        ...doces[indice],
        nome: dadosDoce.nome,
        valor: dadosDoce.valor
      };
      this._salvarLista(this.KEYS.DOCES, doces);
      return Promise.resolve(doces[indice]);
    }

    const novoDoce = {
      id: this._gerarProximoId(this.KEYS.NEXT_ID_DOCE),
      nome: dadosDoce.nome,
      valor: dadosDoce.valor,
      criadoEm: new Date().toISOString()
    };
    doces.push(novoDoce);
    this._salvarLista(this.KEYS.DOCES, doces);
    return Promise.resolve(novoDoce);
  },

  excluirDoce(id) {
    const doces = this._lerLista(this.KEYS.DOCES);
    this._salvarLista(this.KEYS.DOCES, doces.filter((doce) => doce.id !== id));
    return Promise.resolve(true);
  }
};

const CREDENCIAIS_LOGIN = {
  usuario: 'Beatriz',
  senha: 'meumaridolindo',
  chaveSessao: 'docegestao_sessao_autenticada'
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

function credenciaisValidas(usuario, senha) {
  return usuario.trim().toLowerCase() === CREDENCIAIS_LOGIN.usuario.toLowerCase()
    && senha === CREDENCIAIS_LOGIN.senha;
}

function entrarNoSistema() {
  document.getElementById('login-screen').hidden = true;
  document.getElementById('app').hidden = false;
  document.getElementById('erro-login').textContent = '';

  if (!estado.aplicacaoIniciada) {
    estado.aplicacaoIniciada = true;
    iniciar();
  } else {
    irParaTela('home');
  }
}

function sairDoSistema() {
  try {
    sessionStorage.removeItem(CREDENCIAIS_LOGIN.chaveSessao);
  } catch (erro) {
    console.warn('Não foi possível encerrar a sessão do navegador.', erro);
  }

  document.getElementById('app').hidden = true;
  document.getElementById('login-screen').hidden = false;
  document.getElementById('login-senha').value = '';
  document.getElementById('login-usuario').focus({ preventScroll: true });
}

function iniciarAutenticacao() {
  document.getElementById('form-login').addEventListener('submit', (evento) => {
    evento.preventDefault();
    const usuario = document.getElementById('login-usuario').value;
    const senha = document.getElementById('login-senha').value;

    if (!credenciaisValidas(usuario, senha)) {
      document.getElementById('erro-login').textContent = 'Usuário ou senha inválidos.';
      document.getElementById('login-senha').value = '';
      document.getElementById('login-senha').focus({ preventScroll: true });
      return;
    }

    try {
      sessionStorage.setItem(CREDENCIAIS_LOGIN.chaveSessao, 'true');
    } catch (erro) {
      console.warn('A sessão ficará ativa somente até esta página ser fechada.', erro);
    }
    entrarNoSistema();
  });

  document.getElementById('btn-sair').addEventListener('click', sairDoSistema);

  let sessaoValida = false;
  try {
    sessaoValida = sessionStorage.getItem(CREDENCIAIS_LOGIN.chaveSessao) === 'true';
  } catch (erro) {
    console.warn('Não foi possível recuperar a sessão do navegador.', erro);
  }

  if (sessaoValida) entrarNoSistema();
  else document.getElementById('login-usuario').focus({ preventScroll: true });
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
  if (nomeTela === 'clients') atualizarTelaClientes();
  if (nomeTela === 'sweets') atualizarTelaDoces();

  document.getElementById('main').scrollTo({ top: 0 });
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
      <button class="client-row__acao client-row__acao--editar" type="button">✏️ Editar</button>
      <button class="client-row__acao client-row__acao--excluir" type="button">🗑️ Excluir</button>
    </div>
  `;
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

    const totalVendido = compras.reduce((soma, c) => soma + Number(c.valor || 0), 0);
    document.getElementById('stat-total-vendido').textContent = formatarMoeda(totalVendido);

    const recentes = [...clientes]
      .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
      .slice(0, 5);

    const container = document.getElementById('lista-recentes');
    container.innerHTML = '';

    if (recentes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon">🍬</span>
          <h3>Nenhum cliente por aqui ainda</h3>
          <p>Cadastre o primeiro cliente para começar a organizar sua doceria.</p>
          <button class="btn btn--primary" data-abrir-form="novo" type="button">Cadastrar cliente</button>
        </div>`;
        container.querySelector('[data-abrir-form="novo"]').addEventListener('click', () => abrirFormulario('novo'));
      return;
    }

    recentes.forEach((cliente) => {
      container.appendChild(criarCardRecente(cliente));
    });
  });
}

function criarCardRecente(cliente) {
  const card = document.createElement('div');
  card.className = 'client-card';
  card.innerHTML = `
    <div class="client-card__info">
      <div class="client-card__nome">${escaparHtml(cliente.nome)}</div>
      <a class="client-card__celular" href="tel:${apenasNumeros(cliente.celular)}">${escaparHtml(cliente.celular)}</a>
    </div>
    <button class="client-card__editar" type="button">Editar</button>
  `;
  card.addEventListener('click', () => abrirDetalheCliente(cliente));
  card.querySelector('.client-card__celular').addEventListener('click', (evento) => evento.stopPropagation());
  card.querySelector('.client-card__editar').addEventListener('click', (evento) => {
    evento.stopPropagation();
    abrirFormulario('editar', cliente, 'clients');
  });
  return card;
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
        ? apenasNumeros(cliente.celular).includes(termoNumerico)
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
  linha.innerHTML = `
    <div class="client-row__nome">${escaparHtml(cliente.nome)} <span class="client-row__id">#${cliente.id}</span></div>
    <a class="client-row__celular" href="tel:${apenasNumeros(cliente.celular)}">📞 ${escaparHtml(cliente.celular)}</a>
    <div class="client-row__acoes">
      <button class="client-row__acao client-row__acao--editar" type="button">✏️ Editar</button>
      <button class="client-row__acao client-row__acao--excluir" type="button">🗑️ Excluir</button>
    </div>
  `;

  linha.addEventListener('click', () => abrirDetalheCliente(cliente));
  linha.querySelector('.client-row__celular').addEventListener('click', (evento) => evento.stopPropagation());
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
  if (numeros.length < 10 || numeros.length > 11) {
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
    document.getElementById('btn-marcar-todas-pagas').hidden = !temSaldoPendente;
    document.getElementById('btn-registrar-pagamento').hidden = !temSaldoPendente;

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

  DB.registrarPagamentoCliente(estado.clienteDetalheAtual.id, valor).then((resultado) => {
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
        <button class="icon-btn" type="button" aria-label="Editar compra">✏️</button>
        <button class="icon-btn" type="button" aria-label="Excluir compra">🗑️</button>
      </div>
    </div>
  `;

  linha.querySelector('.compra-row__acao-pagamento').addEventListener('click', () => {
    DB.atualizarPagamentoCompra(compra.id, !paga).then(() => {
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
    ? (opcaoDoce.dataset.doceId ? Number(opcaoDoce.dataset.doceId) : null)
    : Number(opcaoDoce.value);

  const dados = {
    id: estado.compraIdEmEdicao,
    clienteId: Number(document.getElementById('compra-cliente-id').value),
    doceId,
    descricao: descricao.trim(),
    quantidade,
    valorUnitario,
    valor: valor,
    data: data
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
  estado.exclusao = { tipo: 'cliente', id: cliente.id };
  document.getElementById('modal-confirm-titulo').textContent = 'Excluir cliente?';
  document.getElementById('modal-confirm-texto').textContent =
    `Tem certeza de que deseja excluir "${cliente.nome}"? As compras registradas dele também serão apagadas.`;
  document.getElementById('modal-confirm').hidden = false;
}

function abrirModalConfirmacaoCompra(compra) {
  estado.exclusao = { tipo: 'compra', id: compra.id };
  document.getElementById('modal-confirm-titulo').textContent = 'Excluir compra?';
  document.getElementById('modal-confirm-texto').textContent =
    `Tem certeza de que deseja excluir "${compra.descricao}"? Essa ação não pode ser desfeita.`;
  document.getElementById('modal-confirm').hidden = false;
}

function abrirModalConfirmacaoDoce(doce) {
  estado.exclusao = { tipo: 'doce', id: doce.id };
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
  const { tipo, id } = estado.exclusao;

  if (tipo === 'cliente') {
    DB.excluirCliente(id).then(() => {
      mostrarToast('Cliente excluído.');
      fecharModalConfirmacao();
      if (estado.telaAtual === 'detalhe') irParaTela('clients');
      else if (estado.telaAtual === 'clients') atualizarTelaClientes();
      atualizarTelaHome();
    });
  } else if (tipo === 'compra') {
    DB.excluirCompra(id).then(() => {
      mostrarToast('Compra excluída.');
      fecharModalConfirmacao();
      atualizarTelaDetalhe();
      atualizarTelaHome();
    });
  } else {
    DB.excluirDoce(id).then(() => {
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
  // Navegação (menu inferior / lateral)
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

    DB.marcarComprasDoClienteComoPagas(cliente.id).then((quantidadeAtualizada) => {
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

  // Modal de exclusão
  document.getElementById('btn-modal-cancelar').addEventListener('click', fecharModalConfirmacao);
  document.getElementById('btn-modal-confirmar').addEventListener('click', confirmarExclusao);
  document.getElementById('modal-confirm').addEventListener('click', (evento) => {
    if (evento.target.id === 'modal-confirm') fecharModalConfirmacao();
  });

  atualizarTelaHome();
}

document.addEventListener('DOMContentLoaded', iniciarAutenticacao);
