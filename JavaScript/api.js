async function finalizarCompra(carrinho, clienteId, vendedorId, enderecoId) {
  const dadosCheckout = {
    id_cliente: clienteId,
    id_vendedor: vendedorId,
    id_transportadora: null, // Opcional
    id_endereco_entrega: enderecoId,
    val_frete: 15.00,
    itens: carrinho.map(item => ({
      id_produto: item.id,
      quantidade: item.qtd,
      preco_unitario: item.preco
    }))
  };

  try {
    const response = await fetch('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosCheckout)
    });

    const resultado = await response.json();

    if (!response.ok) {
      alert(`Erro no checkout: ${resultado.error}`);
      return;
    }

    alert(`Pedido #${resultado.nota_fiscal_id} realizado com sucesso! Total: R$ ${resultado.val_total}`);
    // Limpar o carrinho local aqui...
  } catch (err) {
    console.error('Erro na requisição:', err);
  }
}

async function carregarProdutos() {
  try {
    const response = await fetch('http://localhost:3000/api/produtos');
    const produtos = await response.json();

    const container = document.getElementById('grid-produtos');

    if (!container) return;
    
    container.innerHTML = '';

    // Se o banco retornar uma lista vazia (sem estoque ou sem cadastro)
    if (produtos.length === 0) {
      container.innerHTML = '<p class="sem-produtos">Nenhum produto disponível no momento.</p>';
      return;
    }

    produtos.forEach(prod => {
      container.innerHTML += `
        <div class="card-produto">
          <img src="${prod.imagem_url || 'img/placeholder.png'}" alt="${prod.nome}">
          <h3>${prod.nome}</h3>
          <p class="preco">R$ ${parseFloat(prod.preco).toFixed(2)}</p>
          <span class="vendedor">Vendido por: ${prod.nome_vendedor}</span>
        </div>
      `;
    });
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
  }
}