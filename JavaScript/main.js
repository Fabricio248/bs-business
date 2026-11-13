let todosOsProdutos = [];
let carrinho = JSON.parse(localStorage.getItem("carrinho_bsbusiness")) || [];
let itensParaCheckout = []; // Guarda os itens da compra atual (seja do carrinho ou "Comprar Agora")

function obterSessaoUsuario() {
    const usuarioSalvo = localStorage.getItem("usuario_bsbusiness");
    if (usuarioSalvo) {
        return JSON.parse(usuarioSalvo);
    }
    return { autenticado: false, tipo: 'visitante', nome: '' };
}

function resetarDropZoneImagem() {
    document.getElementById("prodImg").value = "";
    document.getElementById("prodImgFile").value = "";
    document.getElementById("imgPreviewProduto").src = "";
    document.getElementById("dropZonePrompt").style.display = "flex";
    document.getElementById("dropZonePreview").style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
    identificarPerfilEAtualizarInterface();
    atualizarBadgeCarrinho();
    renderizarCarrinho();

    // -------------------------------------------------------------
    // 1. MENU DO AVATAR (Foto de Perfil, Trocar Conta, Logout)
    // -------------------------------------------------------------
    const btnAvatar = document.getElementById("btnAvatarUsuario");
    const dropdownAvatar = document.getElementById("dropdownAvatar");
    const inputFotoPerfil = document.getElementById("inputFotoPerfil");
    const btnLogout = document.getElementById("btnLogout");
    const btnTrocarConta = document.getElementById("btnTrocarConta");

    if (btnAvatar && dropdownAvatar) {
        btnAvatar.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdownAvatar.classList.toggle("ativo");
        });

        document.addEventListener("click", (e) => {
            if (!dropdownAvatar.contains(e.target) && e.target !== btnAvatar) {
                dropdownAvatar.classList.remove("ativo");
            }
        });
    }

    if (inputFotoPerfil) {
        inputFotoPerfil.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (event) {
                const sessao = obterSessaoUsuario();
                sessao.avatarUrl = event.target.result;
                localStorage.setItem("usuario_bsbusiness", JSON.stringify(sessao));
                identificarPerfilEAtualizarInterface();
                alert("Foto de perfil atualizada com sucesso!");
            };
            reader.readAsDataURL(file);
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            localStorage.removeItem("usuario_bsbusiness");
            alert("Você saiu da sua conta.");
            window.location.reload();
        });
    }

    if (btnTrocarConta) {
        btnTrocarConta.addEventListener("click", () => {
            localStorage.removeItem("usuario_bsbusiness");
            window.location.href = "login.html";
        });
    }

    // -------------------------------------------------------------
    // 2. ABA LATERAL DO CARRINHO
    // -------------------------------------------------------------
    const btnAbrirCarrinho = document.getElementById("btnAbrirCarrinho");
    const btnFecharCarrinho = document.getElementById("btnFecharCarrinho");
    const btnRetomarCompras = document.getElementById("btnRetomarCompras");
    const btnApagarCarrinho = document.getElementById("btnApagarCarrinho");
    const btnFinalizarCompra = document.getElementById("btnFinalizarCompra");
    const overlayCarrinho = document.getElementById("overlayCarrinho");

    if (btnAbrirCarrinho) btnAbrirCarrinho.addEventListener("click", abrirAbaCarrinho);
    if (btnFecharCarrinho) btnFecharCarrinho.addEventListener("click", fecharAbaCarrinho);
    if (btnRetomarCompras) btnRetomarCompras.addEventListener("click", fecharAbaCarrinho);
    if (overlayCarrinho) overlayCarrinho.addEventListener("click", fecharAbaCarrinho);

    if (btnApagarCarrinho) {
        btnApagarCarrinho.addEventListener("click", () => {
            if (carrinho.length === 0) return;
            if (confirm("Deseja realmente apagar todos os itens do carrinho?")) {
                carrinho = [];
                salvarERenderizarCarrinho();
            }
        });
    }

    if (btnFinalizarCompra) {
        btnFinalizarCompra.addEventListener("click", () => {
            if (carrinho.length === 0) {
                alert("Seu carrinho está vazio!");
                return;
            }
            fecharAbaCarrinho();
            iniciarCheckout(carrinho, true);
        });
    }

    // -------------------------------------------------------------
    // 3. FILTROS DE CATEGORIA E BUSCA
    // -------------------------------------------------------------
    const selectCategoria = document.getElementById("selectCategoria");
    const inputBusca = document.getElementById("inputBusca");

    if (selectCategoria) selectCategoria.addEventListener("change", aplicarFiltrosCatalogo);
    if (inputBusca) inputBusca.addEventListener("input", aplicarFiltrosCatalogo);

    // -------------------------------------------------------------
    // 4. MODAL CADASTRO E EDIÇÃO DE PRODUTO (VENDEDOR)
    // -------------------------------------------------------------
    const btnNovoProduto = document.getElementById("btnNovoProduto");
    const formCadastroProduto = document.getElementById("formCadastroProduto");

    if (btnNovoProduto) {
        btnNovoProduto.addEventListener("click", () => {
            document.getElementById("prodIdEdicao").value = "";
            document.getElementById("tituloModalProdutoForm").innerText = "Cadastrar Novo Produto";
            document.getElementById("btnSalvarProdutoForm").innerText = "Publicar Anúncio";
            formCadastroProduto.reset();
            document.getElementById("modalCadastroProduto").style.display = "flex";
        });
    }

    if (formCadastroProduto) {
        formCadastroProduto.addEventListener("submit", async (e) => {
            e.preventDefault();
            const usuario = obterSessaoUsuario();
            const idEdicao = document.getElementById("prodIdEdicao").value;

            const payload = {
                nome: document.getElementById("prodNome").value,
                preco: parseFloat(document.getElementById("prodPreco").value),
                quantidade_em_estoque: parseInt(document.getElementById("prodQtd").value),
                categoria: document.getElementById("prodCategoria").value,
                estado_conservacao: document.getElementById("prodEstado").value,
                imagem_url: document.getElementById("prodImg").value,
                descricao: document.getElementById("prodDescricao").value,
                id_vendedor: usuario.id
            };

            const url = idEdicao 
                ? `http://localhost:3000/api/produtos/${idEdicao}` 
                : 'http://localhost:3000/api/produtos';
            const method = idEdicao ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    alert(idEdicao ? "Produto atualizado com sucesso!" : "Produto publicado com sucesso!");
                    fecharModalCadastroProduto();
                    formCadastroProduto.reset();
                    carregarProdutos();
                } else {
                    alert("Erro ao salvar produto.");
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    // -------------------------------------------------------------
    // 5. LÓGICA DE LOGIN E CADASTRO
    // -------------------------------------------------------------
    const formLogin = document.getElementById("formLogin");
    if (formLogin) {
        formLogin.addEventListener("submit", async (e) => {
            e.preventDefault();
            const tipo = document.querySelector('input[name="tipo_login"]:checked').value;
            const identificador = document.getElementById("identificador").value;
            const senha = document.getElementById("senha").value;

            try {
                const response = await fetch('http://localhost:3000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identificador, senha, tipo })
                });
                const data = await response.json();
                if (!response.ok) {
                    alert(data.error || "Erro ao realizar login.");
                    return;
                }

                const sessao = {
                    autenticado: true,
                    id: data.usuario.id,
                    nome: data.usuario.nome,
                    tipo: data.usuario.tipo,
                    avatarUrl: ''
                };
                localStorage.setItem("usuario_bsbusiness", JSON.stringify(sessao));
                window.location.href = "index.html";
            } catch (error) {
                alert("Não foi possível conectar ao servidor.");
            }
        });
    }

    const inputCep = document.getElementById("cep");
    if (inputCep) {
        inputCep.addEventListener("blur", async () => {
            const cep = inputCep.value.replace(/\D/g, '');
            if (cep.length === 8) {
                try {
                    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    const data = await res.json();
                    if (!data.erro) {
                        document.getElementById("rua").value = data.logradouro;
                        document.getElementById("bairro").value = data.bairro;
                        document.getElementById("cidade").value = data.localidade;
                        document.getElementById("estado").value = data.uf;
                        document.getElementById("numero").focus();
                    }
                } catch (err) {}
            }
        });
    }

    const formCadastro = document.getElementById("formCadastroUsuario");
    if (formCadastro) {
        formCadastro.addEventListener("submit", async (e) => {
            e.preventDefault();
            const senha = document.getElementById("senha_cad").value;
            const confirmarSenha = document.getElementById("confirmar_senha_cad").value;

            if (senha !== confirmarSenha) {
                alert("As senhas digitadas não coincidem!");
                document.getElementById("confirmar_senha_cad").focus();
                return;
            }

            const tipoConta = document.querySelector('input[name="tipo_conta"]:checked').value;
            const email = document.getElementById("email_cad").value;
            const endereco = {
                cep: document.getElementById("cep").value,
                rua: document.getElementById("rua").value,
                bairro: document.getElementById("bairro").value,
                numero: document.getElementById("numero").value || null,
                lote_complemento: null,
                cidade: document.getElementById("cidade").value,
                estado: document.getElementById("estado").value
            };

            let url = 'http://localhost:3000/api/clientes';
            let payload = {};

            if (tipoConta === 'cliente') {
                payload = {
                    nome: document.getElementById("nome_cad").value,
                    sobrenome: document.getElementById("sobrenome").value,
                    email,
                    senha,
                    endereco
                };
            } else {
                url = 'http://localhost:3000/api/vendedores';
                payload = {
                    nome_empresa: document.getElementById("nome_empresa").value,
                    cnpj: document.getElementById("cnpj").value.replace(/\D/g, ''),
                    email,
                    senha,
                    endereco
                };
            }

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (!response.ok) {
                    alert(data.error || "Erro ao realizar cadastro.");
                    return;
                }

                const sessao = {
                    autenticado: true,
                    id: data.usuario.id,
                    nome: data.usuario.nome,
                    tipo: data.usuario.tipo,
                    avatarUrl: ''
                };
                localStorage.setItem("usuario_bsbusiness", JSON.stringify(sessao));

                if (tipoConta === 'vendedor' && data.chave_acesso) {
                    alert(`Cadastro realizado!\n\nSua Chave de 12 dígitos é: ${data.chave_acesso}\nEla também foi enviada para o seu e-mail (${email}).`);
                }

                window.location.href = "index.html";
            } catch (error) {
                alert("Erro ao conectar com o servidor.");
            }
        });
    }

    if (document.getElementById('catalogo')) {
        carregarProdutos();
    }

    // =============================================================
// ARRASTAR E SOLTAR IMAGEM NO CADASTRO/EDIÇÃO DE PRODUTO
// =============================================================
const dropZone = document.getElementById("dropZoneImagem");
const inputFileImg = document.getElementById("prodImgFile");
const inputHiddenImg = document.getElementById("prodImg");
const promptDrop = document.getElementById("dropZonePrompt");
const previewDrop = document.getElementById("dropZonePreview");
const imgPreview = document.getElementById("imgPreviewProduto");
const btnRemoverPreview = document.getElementById("btnRemoverImgPreview");

function processarArquivoImagem(file) {
    if (!file || !file.type.startsWith("image/")) {
        alert("Por favor, solte apenas arquivos de imagem (JPG, PNG, WEBP).");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target.result;
        inputHiddenImg.value = base64;
        imgPreview.src = base64;
        promptDrop.style.display = "none";
        previewDrop.style.display = "flex";
    };
    reader.readAsDataURL(file);
}

if (dropZone && inputFileImg) {
    // Clicar na área abre a pasta de arquivos
    dropZone.addEventListener("click", (e) => {
        if (e.target !== btnRemoverPreview) {
            inputFileImg.click();
        }
    });

    // Seleção normal pelo explorador de arquivos
    inputFileImg.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            processarArquivoImagem(e.target.files[0]);
        }
    });

    // Efeitos visuais ao arrastar por cima
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drag-over");
    });

    // Soltar o arquivo da pasta dentro do site
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        if (e.dataTransfer.files.length > 0) {
            processarArquivoImagem(e.dataTransfer.files[0]);
        }
    });

    // Botão para trocar/remover a imagem selecionada
    if (btnRemoverPreview) {
        btnRemoverPreview.addEventListener("click", (e) => {
            e.stopPropagation();
            resetarDropZoneImagem();
        });
    }
}

});

// Atualiza Avatar e Menu do Usuário
function identificarPerfilEAtualizarInterface() {
    const usuario = obterSessaoUsuario();
    const btnNovo = document.getElementById("btnNovoProduto");
    const linkLogin = document.getElementById("linkLoginUsuario");
    const avatarContainer = document.getElementById("avatarContainer");
    const imgAvatar = document.getElementById("imgAvatarUsuario");
    const svgAvatar = document.getElementById("svgAvatarPadrao");
    const nomeMenu = document.getElementById("nomeUsuarioMenu");
    const tipoMenu = document.getElementById("tipoUsuarioMenu");

    if (usuario.autenticado) {
        if (linkLogin) linkLogin.style.display = "none";
        if (avatarContainer) avatarContainer.style.display = "flex";
        if (nomeMenu) nomeMenu.innerText = usuario.nome || "Usuário";
        if (tipoMenu) tipoMenu.innerText = usuario.tipo === 'vendedor' ? 'Vendedor' : 'Cliente';

        if (usuario.avatarUrl && imgAvatar) {
            imgAvatar.src = usuario.avatarUrl;
            imgAvatar.style.display = "block";
            if (svgAvatar) svgAvatar.style.display = "none";
        } else {
            if (imgAvatar) imgAvatar.style.display = "none";
            if (svgAvatar) svgAvatar.style.display = "block";
        }

        if (usuario.tipo === 'vendedor' && btnNovo) {
            btnNovo.style.display = "inline-flex";
        } else if (btnNovo) {
            btnNovo.style.display = "none";
        }
    } else {
        if (linkLogin) linkLogin.style.display = "flex";
        if (avatarContainer) avatarContainer.style.display = "none";
        if (btnNovo) btnNovo.style.display = "none";
    }

    
}

// ==========================================
// CATÁLOGO & MODAL DE PRODUTO
// ==========================================
async function carregarProdutos() {
    try {
        const response = await fetch('http://localhost:3000/api/produtos');
        todosOsProdutos = await response.json();
        renderizarCatalogo(todosOsProdutos);
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

function renderizarCatalogo(lista) {
    const container = document.getElementById('catalogo');
    if (!container) return;
    container.innerHTML = '';

    if (lista.length === 0) {
        container.innerHTML = '<p class="sem-produtos">Nenhum produto encontrado para este filtro.</p>';
        return;
    }

    lista.forEach(prod => {
        const precoFormatado = parseFloat(prod.preco).toFixed(2).replace('.', ',');
        const vendas = prod.vendas || 0;
        const card = document.createElement('div');
        card.className = 'produto-card';
        card.innerHTML = `
            <div class="produto-imagem" onclick="abrirModalProduto(${prod.id})">
                <span class="tag-desconto">${prod.estado_conservacao || 'Novo'}</span>
                <span class="tag-vendas-card">${vendas} vendidos</span>
                <img src="${prod.imagem_url || 'https://via.placeholder.com/300'}" alt="${prod.nome}" class="img-produto-card">
            </div>
            <div class="produto-info">
                <span class="badge-estado-card">${prod.nome_vendedor || 'B.S.BUSINESS'}</span>
                <h3 onclick="abrirModalProduto(${prod.id})">${prod.nome}</h3>
                <p class="preco-atual">R$ ${precoFormatado}</p>
                <p class="parcelamento">Estoque: ${prod.quantidade_em_estoque} un.</p>
                <div class="card-botoes-acao">
                    <button class="btn-comprar-agora" onclick="comprarProdutoDireto(${prod.id})">Comprar Agora</button>
                    <button class="btn-comprar-secundario" onclick="adicionarAoCarrinho(${prod.id})" title="Adicionar ao carrinho">+ Carrinho</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function aplicarFiltrosCatalogo() {
    const cat = document.getElementById("selectCategoria")?.value || "";
    const termo = (document.getElementById("inputBusca")?.value || "").toLowerCase();

    const filtrados = todosOsProdutos.filter(p => {
        const bateCat = !cat || (p.categoria && p.categoria.toLowerCase() === cat.toLowerCase());
        const bateNome = !termo || p.nome.toLowerCase().includes(termo) || (p.descricao && p.descricao.toLowerCase().includes(termo));
        return bateCat && bateNome;
    });

    renderizarCatalogo(filtrados);
}

function filtrarPorCategoria(cat) {
    const select = document.getElementById("selectCategoria");
    if (select) {
        select.value = cat;
        aplicarFiltrosCatalogo();
    }
}

function abrirModalProduto(idProduto) {
    const prod = todosOsProdutos.find(p => p.id === idProduto);
    if (!prod) return;

    const usuario = obterSessaoUsuario();
    const vendas = prod.vendas || 0;

    document.getElementById("modalImg").src = prod.imagem_url || 'https://via.placeholder.com/300';
    document.getElementById("modalEstado").innerText = prod.estado_conservacao || 'Novo';
    document.getElementById("modalVendas").innerText = `${vendas} vendas realizadas`;
    document.getElementById("modalNome").innerText = prod.nome;
    document.getElementById("modalPreco").innerText = `R$ ${parseFloat(prod.preco).toFixed(2).replace('.', ',')}`;
    document.getElementById("modalEstoque").innerText = `Quantidade em estoque: ${prod.quantidade_em_estoque} unidades`;
    document.getElementById("modalDescricao").innerText = prod.descricao || 'Sem descrição detalhada.';

    // Botão Comprar Direto
    document.getElementById("btnModalComprarDireto").onclick = () => {
        fecharModalProduto();
        comprarProdutoDireto(prod.id);
    };

    // Botão Adicionar ao Carrinho
    document.getElementById("btnModalAdicionarCarrinho").onclick = () => {
        adicionarAoCarrinho(prod.id);
        fecharModalProduto();
    };

    // Botão Editar Produto (se for o vendedor dono do anúncio)
    const btnEditar = document.getElementById("btnEditarProdutoModal");
    if (usuario.autenticado && usuario.tipo === 'vendedor' && usuario.id === prod.id_vendedor) {
        btnEditar.style.display = "block";
        btnEditar.onclick = () => {
            fecharModalProduto();
            abrirModalEdicaoProduto(prod);
        };
    } else {
        btnEditar.style.display = "none";
    }

    // Avaliações do Produto
    const listaAvaliacoes = document.getElementById("listaAvaliacoesProduto");
    listaAvaliacoes.innerHTML = `
        <div class="avaliacao-item">
            <div class="avaliacao-topo"><strong>Carlos M.</strong> <span>★★★★★</span></div>
            <p>Excelente produto! Chegou muito rápido e exatamente conforme a descrição.</p>
        </div>
        <div class="avaliacao-item">
            <div class="avaliacao-topo"><strong>Fernanda R.</strong> <span>★★★★★</span></div>
            <p>Ótimo custo-benefício e vendedor muito atencioso. Recomendo!</p>
        </div>
    `;

    document.getElementById("modalProduto").style.display = "flex";

    
}

function abrirModalEdicaoProduto(prod) {
    document.getElementById("prodIdEdicao").value = prod.id;
    document.getElementById("tituloModalProdutoForm").innerText = "Editar Produto e Estoque";
    document.getElementById("btnSalvarProdutoForm").innerText = "Salvar Alterações";
    document.getElementById("prodNome").value = prod.nome;
    document.getElementById("prodPreco").value = prod.preco;
    document.getElementById("prodQtd").value = prod.quantidade_em_estoque;
    document.getElementById("prodCategoria").value = prod.categoria || "geral";
    document.getElementById("prodEstado").value = prod.estado_conservacao || "Novo";
    document.getElementById("prodImg").value = prod.imagem_url;
    document.getElementById("prodDescricao").value = prod.descricao;

    document.getElementById("modalCadastroProduto").style.display = "flex";
    document.getElementById("prodImg").value = prod.imagem_url;
if (prod.imagem_url) {
    document.getElementById("imgPreviewProduto").src = prod.imagem_url;
    document.getElementById("dropZonePrompt").style.display = "none";
    document.getElementById("dropZonePreview").style.display = "flex";
} else {
    resetarDropZoneImagem();
}
}

function fecharModalProduto() {
    document.getElementById("modalProduto").style.display = "none";
}

function fecharModalCadastroProduto() {
    document.getElementById("modalCadastroProduto").style.display = "none";
}

// ==========================================
// COMPRA DIRETA & CARRINHO
// ==========================================
function comprarProdutoDireto(idProduto) {
    const prod = todosOsProdutos.find(p => p.id === idProduto);
    if (!prod) return;

    const itemUnico = [{
        id: prod.id,
        nome: prod.nome,
        preco: parseFloat(prod.preco),
        imagem: prod.imagem_url,
        qtd: 1
    }];

    iniciarCheckout(itemUnico, false);
}

function abrirAbaCarrinho() {
    document.getElementById("abaCarrinho")?.classList.add("aberto");
    document.getElementById("overlayCarrinho")?.classList.add("ativo");
}

function fecharAbaCarrinho() {
    document.getElementById("abaCarrinho")?.classList.remove("aberto");
    document.getElementById("overlayCarrinho")?.classList.remove("ativo");
}

function adicionarAoCarrinho(idProduto) {
    const produto = todosOsProdutos.find(p => p.id === idProduto);
    if (!produto) return;

    const existente = carrinho.find(item => item.id === idProduto);
    if (existente) {
        existente.qtd += 1;
    } else {
        carrinho.push({
            id: produto.id,
            nome: produto.nome,
            preco: parseFloat(produto.preco),
            imagem: produto.imagem_url || 'https://via.placeholder.com/80',
            qtd: 1
        });
    }

    salvarERenderizarCarrinho();
    abrirAbaCarrinho();
}

function removerItemCarrinho(idProduto) {
    carrinho = carrinho.filter(item => item.id !== idProduto);
    salvarERenderizarCarrinho();
}

function salvarERenderizarCarrinho() {
    localStorage.setItem("carrinho_bsbusiness", JSON.stringify(carrinho));
    atualizarBadgeCarrinho();
    renderizarCarrinho();
}

function atualizarBadgeCarrinho() {
    const badge = document.getElementById("badgeCarrinho");
    if (badge) {
        const totalItens = carrinho.reduce((acc, item) => acc + item.qtd, 0);
        badge.innerText = totalItens;
    }
}

function renderizarCarrinho() {
    const lista = document.getElementById("listaItensCarrinho");
    const totalEl = document.getElementById("valorTotalCarrinho");
    if (!lista || !totalEl) return;

    lista.innerHTML = '';

    if (carrinho.length === 0) {
        lista.innerHTML = '<div class="carrinho-vazio"><p>Seu carrinho está vazio no momento.</p></div>';
        totalEl.innerText = 'R$ 0,00';
        return;
    }

    let total = 0;
    carrinho.forEach(item => {
        total += item.preco * item.qtd;
        const div = document.createElement('div');
        div.className = 'carrinho-item';
        div.innerHTML = `
            <img src="${item.imagem}" alt="${item.nome}">
            <div class="carrinho-item-info">
                <h4>${item.nome}</h4>
                <p>Qtd: ${item.qtd} x R$ ${item.preco.toFixed(2).replace('.', ',')}</p>
            </div>
            <button type="button" class="btn-remover-item" title="Remover item" onclick="removerItemCarrinho(${item.id})">
                &times;
            </button>
        `;
        lista.appendChild(div);
    });

    totalEl.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

// ==========================================
// MODAL DE PAGAMENTO (PIX, CARTÃO, BOLETO)
// ==========================================
let vindoDoCarrinho = false;

function iniciarCheckout(listaItens, veioDoCarrinho) {
    const usuario = obterSessaoUsuario();
    if (!usuario.autenticado) {
        alert("Faça login ou cadastre-se para concluir sua compra!");
        window.location.href = "login.html";
        return;
    }

    itensParaCheckout = listaItens;
    vindoDoCarrinho = veioDoCarrinho;

    const total = itensParaCheckout.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
    document.getElementById("pagamentoValorTotal").innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;

    // Gera chave PIX aleatória (32 caracteres numéricos/alfanuméricos)
    const chavePix = Array.from({ length: 32 }, () => Math.floor(Math.random() * 10)).join('');
    document.getElementById("chavePixAleatoria").value = chavePix;

    // Gera linha digitável aleatória de Boleto
    const linhaBoleto = `34191.79001 01043.510047 91020.150008 8 ${Math.floor(10000000000000 + Math.random() * 90000000000000)}`;
    document.getElementById("codigoBoleto").value = linhaBoleto;

    document.getElementById("modalPagamento").style.display = "flex";
}

function fecharModalPagamento() {
    document.getElementById("modalPagamento").style.display = "none";
}

function selecionarMetodoPagamento(metodo, botaoClicado) {
    document.querySelectorAll(".tab-pag").forEach(btn => btn.classList.remove("active"));
    botaoClicado.classList.add("active");

    document.getElementById("painelPix").style.display = metodo === 'pix' ? 'block' : 'none';
    document.getElementById("painelCartao").style.display = metodo === 'cartao' ? 'flex' : 'none';
    document.getElementById("painelBoleto").style.display = metodo === 'boleto' ? 'block' : 'none';
}

function copiarTexto(idInput) {
    const input = document.getElementById(idInput);
    input.select();
    navigator.clipboard.writeText(input.value);
    alert("Código copiado para a área de transferência!");
}

async function confirmarPagamentoPedido(metodoEscolhido) {
    try {
        await fetch('http://localhost:3000/api/comprar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itens: itensParaCheckout })
        });
    } catch (e) {
        console.error(e);
    }

    alert(`Pedido confirmado via ${metodoEscolhido}! Obrigado por comprar na B.S.BUSINESS.`);

    if (vindoDoCarrinho) {
        carrinho = [];
        salvarERenderizarCarrinho();
    }

    fecharModalPagamento();
    carregarProdutos(); // Atualiza estoque e número de vendas na tela
}

function alternarTipoConta(tipo) {
    const boxNomePessoa = document.getElementById("boxNomePessoa");
    const boxEmpresa = document.getElementById("boxEmpresa");
    const avisoEmail = document.getElementById("avisoEmailVendedor");
    
    if (tipo === "vendedor") {
        boxNomePessoa.style.display = "none";
        boxEmpresa.style.display = "flex";
        if (avisoEmail) avisoEmail.style.display = "inline";
        document.getElementById("nome_empresa").required = true;
        document.getElementById("cnpj").required = true;
        document.getElementById("nome_cad").required = false;
        document.getElementById("sobrenome").required = false;
    } else {
        boxNomePessoa.style.display = "flex";
        boxEmpresa.style.display = "none";
        if (avisoEmail) avisoEmail.style.display = "none";
        document.getElementById("nome_empresa").required = false;
        document.getElementById("cnpj").required = false;
        document.getElementById("nome_cad").required = true;
        document.getElementById("sobrenome").required = true;
    }
}

function alternarTipoLogin(tipo) {
    const label = document.getElementById("labelIdentificador");
    const input = document.getElementById("identificador");
    if (tipo === "vendedor") {
        label.innerText = "Chave de Identificação (12 dígitos)";
        input.placeholder = "Ex: 202610000001";
        input.maxLength = 12;
    } else {
        label.innerText = "E-mail";
        input.placeholder = "seu.email@exemplo.com";
        input.removeAttribute("maxLength");
    }
}