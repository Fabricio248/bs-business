let todosOsProdutos = [];
let produtosFiltradosAtuais = [];
let quantidadeExibida = 0;
const LOTE_PRODUTOS_SCROLL = 6; // Carrega 6 produtos por vez ao rolar

let carrinho = JSON.parse(localStorage.getItem("carrinho_bsbusiness")) || [];
let itensParaCheckout = [];
let vindoDoCarrinho = false;
let intervaloPropaganda = null;

function obterSessaoUsuario() {
    const usuarioSalvo = localStorage.getItem("usuario_bsbusiness");
    if (usuarioSalvo) {
        return JSON.parse(usuarioSalvo);
    }
    return { autenticado: false, tipo: 'visitante', nome: '' };
}

// ==========================================
// MASCOTE BOY GALÁCTICO
// ==========================================
function mostrarBoyGalactico(mensagem, duracaoMs = 8000) {
    const widget = document.getElementById("widgetBoyGalactico");
    const texto = document.getElementById("boyMensagemTexto");
    if (!widget || !texto) return;

    texto.innerText = mensagem;
    widget.style.display = "flex";

    if (duracaoMs > 0) {
        setTimeout(() => {
            widget.style.display = "none";
        }, duracaoMs);
    }
}

function fecharBoyGalactico() {
    const widget = document.getElementById("widgetBoyGalactico");
    if (widget) widget.style.display = "none";
}

// ==========================================
// RASTREAMENTO DE INTERESSE POR CATEGORIA
// ==========================================
function registrarInteresseCategoria(categoria) {
    if (!categoria) return;
    const catNormalizada = categoria.toLowerCase();
    const historico = JSON.parse(localStorage.getItem("interesses_bsbusiness")) || {};
    historico[catNormalizada] = (historico[catNormalizada] || 0) + 1;
    localStorage.setItem("interesses_bsbusiness", JSON.stringify(historico));
}

function obterCategoriaFavorita() {
    const historico = JSON.parse(localStorage.getItem("interesses_bsbusiness")) || {};
    let favorita = null;
    let maiorPontuacao = 0;

    for (const [cat, pontos] of Object.entries(historico)) {
        if (pontos > maiorPontuacao) {
            maiorPontuacao = pontos;
            favorita = cat;
        }
    }
    return favorita;
}

function resetarDropZoneImagem() {
    const prodImg = document.getElementById("prodImg");
    if (!prodImg) return;
    prodImg.value = "";
    document.getElementById("prodImgFile").value = "";
    document.getElementById("imgPreviewProduto").src = "";
    document.getElementById("dropZonePrompt").style.display = "flex";
    document.getElementById("dropZonePreview").style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
    identificarPerfilEAtualizarInterface();
    atualizarBadgeCarrinho();
    renderizarCarrinho();


    const btnCategoriaAtual = document.getElementById("btnCategoriaAtual");
    const listaCategoriasVisual = document.getElementById("listaCategoriasVisual");

    if (btnCategoriaAtual && listaCategoriasVisual) {
        btnCategoriaAtual.addEventListener("click", (e) => {
            e.stopPropagation();
            listaCategoriasVisual.classList.toggle("aberto");
        });

        document.addEventListener("click", (e) => {
            if (!listaCategoriasVisual.contains(e.target) && e.target !== btnCategoriaAtual) {
                listaCategoriasVisual.classList.remove("aberto");
            }
        });
    }

    // Verifica se o usuário acabou de se cadastrar para o Boy Galáctico agradecer
    const boasVindasPendente = localStorage.getItem("boy_boas_vindas");
    if (boasVindasPendente) {
        mostrarBoyGalactico(boasVindasPendente, 9000);
        localStorage.removeItem("boy_boas_vindas");
    }

    // -------------------------------------------------------------
    // 1. MENU DO AVATAR (Sem alertas desnecessários)
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
            };
            reader.readAsDataURL(file);
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            localStorage.removeItem("usuario_bsbusiness");
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
            carrinho = [];
            salvarERenderizarCarrinho();
        });
    }

    if (btnFinalizarCompra) {
        btnFinalizarCompra.addEventListener("click", () => {
            if (carrinho.length === 0) return;
            fecharAbaCarrinho();
            iniciarCheckout(carrinho, true);
        });
    }

    // -------------------------------------------------------------
    // 3. FILTROS DE CATEGORIA E BUSCA
    // -------------------------------------------------------------
    const selectCategoria = document.getElementById("selectCategoria");
    const inputBusca = document.getElementById("inputBusca");

    if (selectCategoria) {
        selectCategoria.addEventListener("change", () => {
            if (selectCategoria.value) registrarInteresseCategoria(selectCategoria.value);
            aplicarFiltrosCatalogo();
        });
    }
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
            resetarDropZoneImagem();
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

            const url = idEdicao ? `/api/produtos/${idEdicao}` : '/api/produtos';
            const method = idEdicao ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    fecharModalCadastroProduto();
                    formCadastroProduto.reset();
                    carregarProdutos();
                    mostrarBoyGalactico(idEdicao ? "Anúncio atualizado com sucesso!" : "Seu produto já está no ar para todo o Brasil!");
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
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identificador, senha, tipo })
                });
                const data = await response.json();
                if (!response.ok) {
                    alert(data.error || "Credenciais inválidas.");
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

            let url = '/api/clientes';
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
                url = '/api/vendedores';
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
                const boxErro = document.getElementById("mensagemErroCadastro");
                if (boxErro) {
                    boxErro.innerText = data.error || "Erro ao realizar cadastro.";
                    boxErro.style.display = "block";
                    }
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

                // Prepara agradecimento do Boy Galáctico na página inicial
                if (tipoConta === 'vendedor' && data.chave_acesso) {
                    localStorage.setItem(
                        "boy_boas_vindas",
                        `Bem-vindo a bordo, ${data.usuario.nome}! Sua Chave de Vendedor é ${data.chave_acesso}. Boas vendas!`
                    );
                } else {
                    localStorage.setItem(
                        "boy_boas_vindas",
                        `Obrigado por se cadastrar, ${data.usuario.nome}! Eu sou o Boy Galáctico e vou acompanhar suas compras!`
                    );
                }

                window.location.href = "index.html";
            } catch (error) {
                alert("Erro ao conectar com o servidor.");
            }
        });
    }

    // -------------------------------------------------------------
    // 6. SCROLL GRADUAL E PROPAGANDA DINÂMICA
    // -------------------------------------------------------------
    if (document.getElementById('catalogo')) {
        carregarProdutos();
        configurarObservadorScroll();
    }

    // Seletor de estrelas no Modal de Avaliação Pós-Entrega
    const estrelasSeletor = document.getElementById("estrelasSeletor");
    if (estrelasSeletor) {
        const spans = estrelasSeletor.querySelectorAll("span");
        spans.forEach(span => {
            span.addEventListener("click", () => {
                const nota = parseInt(span.getAttribute("data-nota"));
                document.getElementById("notaAvaliacaoEscolhida").value = nota;
                spans.forEach(s => {
                    s.classList.toggle("ativa", parseInt(s.getAttribute("data-nota")) <= nota);
                });
            });
        });
    }

    const formAvaliar = document.getElementById("formAvaliarProduto");
    if (formAvaliar) {
        formAvaliar.addEventListener("submit", (e) => {
            e.preventDefault();
            const nota = document.getElementById("notaAvaliacaoEscolhida").value;
            const comentario = document.getElementById("comentarioAvaliacao").value;
            const nomeProd = document.getElementById("nomeProdAvaliar").innerText;
            const usuario = obterSessaoUsuario();

            // Salva avaliação no localStorage para aparecer nos detalhes do produto
            const avaliacoesSalvas = JSON.parse(localStorage.getItem("avaliacoes_bsbusiness")) || {};
            if (!avaliacoesSalvas[nomeProd]) avaliacoesSalvas[nomeProd] = [];
            avaliacoesSalvas[nomeProd].unshift({
                autor: usuario.nome || "Cliente Verificado",
                estrelas: "★".repeat(nota) + "☆".repeat(5 - nota),
                texto: comentario
            });
            localStorage.setItem("avaliacoes_bsbusiness", JSON.stringify(avaliacoesSalvas));

            fecharModalAvaliacao();
            formAvaliar.reset();
            mostrarBoyGalactico("Avaliação registrada! Obrigado por ajudar outros compradores da B.S.BUSINESS!", 7000);
        });
    }

    // Drag & Drop de imagem
    const dropZone = document.getElementById("dropZoneImagem");
    const inputFileImg = document.getElementById("prodImgFile");
    const inputHiddenImg = document.getElementById("prodImg");
    const promptDrop = document.getElementById("dropZonePrompt");
    const previewDrop = document.getElementById("dropZonePreview");
    const imgPreview = document.getElementById("imgPreviewProduto");
    const btnRemoverPreview = document.getElementById("btnRemoverImgPreview");

    function processarArquivoImagem(file) {
        if (!file || !file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            inputHiddenImg.value = e.target.result;
            imgPreview.src = e.target.result;
            promptDrop.style.display = "none";
            previewDrop.style.display = "flex";
        };
        reader.readAsDataURL(file);
    }

    if (dropZone && inputFileImg) {
        dropZone.addEventListener("click", (e) => {
            if (e.target !== btnRemoverPreview) inputFileImg.click();
        });
        inputFileImg.addEventListener("change", (e) => {
            if (e.target.files.length > 0) processarArquivoImagem(e.target.files[0]);
        });
        dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropZone.classList.add("drag-over");
        });
        dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.classList.remove("drag-over");
            if (e.dataTransfer.files.length > 0) processarArquivoImagem(e.dataTransfer.files[0]);
        });
        if (btnRemoverPreview) {
            btnRemoverPreview.addEventListener("click", (e) => {
                e.stopPropagation();
                resetarDropZoneImagem();
            });
        }
    }
});

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
// CATÁLOGO COM CARREGAMENTO GRADUAL (SCROLL)
// ==========================================
async function carregarProdutos() {
    try {
        const response = await fetch('/api/produtos');
        todosOsProdutos = await response.json();
        produtosFiltradosAtuais = [...todosOsProdutos];
        iniciarRenderizacaoGradual();
        iniciarPropagandaDinamica();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

function iniciarRenderizacaoGradual() {
    const container = document.getElementById('catalogo');
    if (!container) return;
    container.innerHTML = '';
    quantidadeExibida = 0;

    if (produtosFiltradosAtuais.length === 0) {
        container.innerHTML = '<p class="sem-produtos">Nenhum produto encontrado para este filtro.</p>';
        document.getElementById("textoCarregandoScroll").innerText = "";
        return;
    }

    carregarProximoLoteProdutos();
}

function carregarProximoLoteProdutos() {
    const container = document.getElementById('catalogo');
    const textoScroll = document.getElementById("textoCarregandoScroll");
    if (!container) return;

    if (quantidadeExibida >= produtosFiltradosAtuais.length) {
        if (textoScroll) textoScroll.innerText = "Você visualizou todas as ofertas disponíveis.";
        return;
    }

    const proximoLote = produtosFiltradosAtuais.slice(quantidadeExibida, quantidadeExibida + LOTE_PRODUTOS_SCROLL);

    proximoLote.forEach(prod => {
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

    quantidadeExibida += proximoLote.length;

    if (textoScroll) {
        textoScroll.innerText = quantidadeExibida < produtosFiltradosAtuais.length
            ? "Role para baixo para expandir mais produtos..."
            : "Todos os produtos carregados!";
    }
}

function configurarObservadorScroll() {
    const sentinela = document.getElementById("sentinelaScroll");
    if (!sentinela) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            carregarProximoLoteProdutos();
        }
    }, { rootMargin: "120px" });

    observer.observe(sentinela);
}

// ==========================================
// PROPAGANDA DINÂMICA (A CADA 9.5 SEGUNDOS)
// ==========================================
function iniciarPropagandaDinamica() {
    if (todosOsProdutos.length === 0) return;
    if (intervaloPropaganda) clearInterval(intervaloPropaganda);

    let indiceAtual = 0;

    function atualizarCardRecomendacao() {
        const catFav = obterCategoriaFavorita();
        let poolRecomendados = todosOsProdutos;

        if (catFav) {
            const filtradosFav = todosOsProdutos.filter(p => p.categoria && p.categoria.toLowerCase() === catFav);
            if (filtradosFav.length > 0) poolRecomendados = filtradosFav;
        }

        const prod = poolRecomendados[indiceAtual % poolRecomendados.length];
        indiceAtual++;

        const imgEl = document.getElementById("adDinamicoImg");
        const catEl = document.getElementById("adDinamicoCat");
        const nomeEl = document.getElementById("adDinamicoNome");
        const precoEl = document.getElementById("adDinamicoPreco");
        const btnEl = document.getElementById("btnAdDinamicoVer");
        const barra = document.getElementById("barraTimerAd");

        if (imgEl && prod) {
            imgEl.src = prod.imagem_url || 'https://via.placeholder.com/200';
            catEl.innerText = catFav ? `Baseado no seu interesse: ${prod.categoria}` : `Destaque: ${prod.categoria || 'Geral'}`;
            nomeEl.innerText = prod.nome;
            precoEl.innerText = `R$ ${parseFloat(prod.preco).toFixed(2).replace('.', ',')}`;
            btnEl.onclick = () => abrirModalProduto(prod.id);

            // Reinicia a animação da barra de 9.5s
            if (barra) {
                barra.classList.remove("animar-timer-ad");
                void barra.offsetWidth;
                barra.classList.add("animar-timer-ad");
            }
        }
    }

    atualizarCardRecomendacao();
    intervaloPropaganda = setInterval(atualizarCardRecomendacao, 9500);
}

function aplicarFiltrosCatalogo() {
    const cat = document.getElementById("selectCategoria")?.value || "";
    const termo = (document.getElementById("inputBusca")?.value || "").toLowerCase();

    produtosFiltradosAtuais = todosOsProdutos.filter(p => {
        const bateCat = !cat || (p.categoria && p.categoria.toLowerCase() === cat.toLowerCase());
        const bateNome = !termo || p.nome.toLowerCase().includes(termo) || (p.descricao && p.descricao.toLowerCase().includes(termo));
        return bateCat && bateNome;
    });

    iniciarRenderizacaoGradual();
}

const MAPA_CATEGORIAS_VISUAIS = {
    '': { nome: 'Todas as Categorias', img: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=80' },
    'geral': { nome: 'Geral', img: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=80' },
    'eletronicos': { nome: 'Eletrônicos e Tech', img: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=80' },
    'moda': { nome: 'Moda e Estilo', img: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=80' },
    'higiene': { nome: 'Higiene e Beleza', img: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=80' },
    'casa': { nome: 'Casa e Decoração', img: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=80' },
    'esporte': { nome: 'Esporte e Lazer', img: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=80' },
    'alimentos': { nome: 'Alimentos e Bebidas', img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=80' }
};

function selecionarCategoriaVisual(valor, nome, imgUrl) {
    const inputHidden = document.getElementById("selectCategoria");
    const textoAtual = document.getElementById("textoCategoriaAtual");
    const imgAtual = document.getElementById("imgCategoriaAtual");
    const menu = document.getElementById("listaCategoriasVisual");

    if (inputHidden) inputHidden.value = valor;
    if (textoAtual) textoAtual.innerText = nome;
    if (imgAtual) imgAtual.src = imgUrl;
    if (menu) menu.classList.remove("aberto");

    document.querySelectorAll(".opcao-cat-img").forEach(btn => {
        btn.classList.toggle("ativa", btn.innerText.trim() === nome);
    });

    if (valor) registrarInteresseCategoria(valor);
    aplicarFiltrosCatalogo();
}

function filtrarPorCategoria(cat) {
    const dados = MAPA_CATEGORIAS_VISUAIS[cat] || MAPA_CATEGORIAS_VISUAIS[''];
    selecionarCategoriaVisual(cat, dados.nome, dados.img);
}

function abrirModalProduto(idProduto) {
    const prod = todosOsProdutos.find(p => p.id === idProduto);
    if (!prod) return;

    registrarInteresseCategoria(prod.categoria);

    const usuario = obterSessaoUsuario();
    const vendas = prod.vendas || 0;

    document.getElementById("modalImg").src = prod.imagem_url || 'https://via.placeholder.com/300';
    document.getElementById("modalEstado").innerText = prod.estado_conservacao || 'Novo';
    document.getElementById("modalVendas").innerText = `${vendas} vendas realizadas`;
    document.getElementById("modalNome").innerText = prod.nome;
    document.getElementById("modalPreco").innerText = `R$ ${parseFloat(prod.preco).toFixed(2).replace('.', ',')}`;
    document.getElementById("modalEstoque").innerText = `Quantidade em estoque: ${prod.quantidade_em_estoque} unidades`;
    document.getElementById("modalDescricao").innerText = prod.descricao || 'Sem descrição detalhada.';

    document.getElementById("btnModalComprarDireto").onclick = () => {
        fecharModalProduto();
        comprarProdutoDireto(prod.id);
    };

    document.getElementById("btnModalAdicionarCarrinho").onclick = () => {
        adicionarAoCarrinho(prod.id);
        fecharModalProduto();
    };

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

    // Carrega avaliações padrão + avaliações feitas pelo usuário após entrega
    const avaliacoesSalvas = JSON.parse(localStorage.getItem("avaliacoes_bsbusiness")) || {};
    const extras = avaliacoesSalvas[prod.nome] || [];

    const listaAvaliacoes = document.getElementById("listaAvaliacoesProduto");
    listaAvaliacoes.innerHTML = extras.map(av => `
        <div class="avaliacao-item">
            <div class="avaliacao-topo"><strong>${av.autor}</strong> <span>${av.estrelas}</span></div>
            <p>${av.texto}</p>
        </div>
    `).join('') + `
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

    if (prod.imagem_url) {
        document.getElementById("imgPreviewProduto").src = prod.imagem_url;
        document.getElementById("dropZonePrompt").style.display = "none";
        document.getElementById("dropZonePreview").style.display = "flex";
    } else {
        resetarDropZoneImagem();
    }

    document.getElementById("modalCadastroProduto").style.display = "flex";
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

    registrarInteresseCategoria(prod.categoria);

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

    registrarInteresseCategoria(produto.categoria);

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
// CHECKOUT COM TRANSPORTADORAS E ENTREGA EM 15s
// ==========================================
function iniciarCheckout(listaItens, veioDoCarrinho) {
    const usuario = obterSessaoUsuario();
    if (!usuario.autenticado) {
        window.location.href = "login.html";
        return;
    }

    itensParaCheckout = listaItens;
    vindoDoCarrinho = veioDoCarrinho;

    atualizarTotalComFrete();

    const chavePix = Array.from({ length: 32 }, () => Math.floor(Math.random() * 10)).join('');
    document.getElementById("chavePixAleatoria").value = chavePix;

    const linhaBoleto = `34191.79001 01043.510047 91020.150008 8 ${Math.floor(10000000000000 + Math.random() * 90000000000000)}`;
    document.getElementById("codigoBoleto").value = linhaBoleto;

    document.getElementById("modalPagamento").style.display = "flex";
}

function atualizarTotalComFrete() {
    const subtotal = itensParaCheckout.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
    const transpSelecionada = document.querySelector('input[name="transportadora"]:checked');
    const frete = transpSelecionada ? parseFloat(transpSelecionada.getAttribute("data-frete")) : 0;
    const totalFinal = subtotal + frete;

    document.getElementById("pagamentoValorTotal").innerText = `R$ ${totalFinal.toFixed(2).replace('.', ',')}`;
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
}

async function confirmarPagamentoPedido(metodoEscolhido) {
    const transpSelecionada = document.querySelector('input[name="transportadora"]:checked');
    const nomeTransportadora = transpSelecionada ? transpSelecionada.value : "AstroLog Express";
    const produtoCompradoNome = itensParaCheckout[0]?.nome || "Produto B.S.BUSINESS";

    try {
        await fetch('/api/comprar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itens: itensParaCheckout })
        });
    } catch (e) {
        console.error(e);
    }

    if (vindoDoCarrinho) {
        carrinho = [];
        salvarERenderizarCarrinho();
    }

    fecharModalPagamento();
    carregarProdutos();

    // Boy Galáctico agradece a compra imediatamente
    mostrarBoyGalactico(
        `Obrigado pela compra via ${metodoEscolhido}! A ${nomeTransportadora} já está preparando a entrega do seu pedido!`,
        14000
    );

    // Simulação para apresentação: após 15 segundos, o produto é marcado como entregue e abre a avaliação
    setTimeout(() => {
        fecharBoyGalactico();
        document.getElementById("nomeTranspEntregue").innerText = nomeTransportadora;
        document.getElementById("nomeProdAvaliar").innerText = produtoCompradoNome;
        document.getElementById("modalAvaliacaoEntrega").style.display = "flex";
    }, 15000);
}

function fecharModalAvaliacao() {
    document.getElementById("modalAvaliacaoEntrega").style.display = "none";
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