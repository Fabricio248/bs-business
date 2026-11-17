const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const pool = require('./db');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();


const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));
const path = require('path');

// Serve as pastas do seu projeto diretamente
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'index')));

// Redireciona a raiz "/" para o index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index', 'index.html'));
});

// Configuração de E-mail (Configure EMAIL_USER e EMAIL_PASS no seu .env para envio real)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
});

// Gera chave de 12 caracteres: 4 primeiros = ano atual + 8 números aleatórios
function gerarChaveVendedor() {
  const ano = new Date().getFullYear().toString(); // Ex: "2026"
  let restante = '';
  for (let i = 0; i < 8; i++) {
    restante += Math.floor(Math.random() * 10);
  }
  return ano + restante; // Total: 12 caracteres
}

// ==========================================
// ROTA 1: Listar Produtos (com filtro opcional)
// ==========================================
app.get('/api/produtos', async (req, res) => {
  try {
    const query = `
      SELECT p.*, v.nome_empresa AS nome_vendedor 
      FROM produto p
      JOIN vendedor v ON p.id_vendedor = v.id
      WHERE p.quantidade_em_estoque > 0
      ORDER BY p.id DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

// ==========================================
// ROTA 2: Cadastrar Produto (Área do vendedor)
// ==========================================
app.post('/api/produtos', async (req, res) => {
  const { nome, preco, descricao, quantidade_em_estoque, estado_conservacao, imagem_url, id_vendedor, categoria } = req.body;

  try {
    const query = `
      INSERT INTO produto (nome, preco, descricao, quantidade_em_estoque, estado_conservacao, imagem_url, id_vendedor, categoria)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [nome, preco, descricao, quantidade_em_estoque, estado_conservacao || 'Novo', imagem_url, id_vendedor, categoria || 'geral'];
    
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao cadastrar produto' });
  }
});


// ROTA: Editar Produto / Estoque (Vendedor)
app.put('/api/produtos/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, preco, descricao, quantidade_em_estoque, estado_conservacao, imagem_url, categoria } = req.body;

  try {
    const query = `
      UPDATE produto 
      SET nome = $1, preco = $2, descricao = $3, quantidade_em_estoque = $4, 
          estado_conservacao = $5, imagem_url = $6, categoria = $7
      WHERE id = $8
      RETURNING *
    `;
    const values = [nome, preco, descricao, quantidade_em_estoque, estado_conservacao, imagem_url, categoria, id];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao editar produto:', err);
    res.status(500).json({ error: 'Erro ao atualizar produto.' });
  }
});

// ROTA: Registrar Compra (Baixa estoque e soma número de vendas)
app.post('/api/comprar', async (req, res) => {
  const { itens } = req.body; // [{ id, qtd }]
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    for (const item of itens) {
      await client.query(
        `UPDATE produto 
         SET quantidade_em_estoque = GREATEST(quantidade_em_estoque - $1, 0),
             vendas = COALESCE(vendas, 0) + $1
         WHERE id = $2`,
        [item.qtd, item.id]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Compra registrada e estoque atualizado!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao registrar compra:', err);
    res.status(500).json({ error: 'Erro ao processar compra.' });
  } finally {
    client.release();
  }
});

// ==========================================
// ROTA 3: Cadastrar Cliente (Retorna dados para login automático)
// ==========================================
app.post('/api/clientes', async (req, res) => {
  const { nome, sobrenome, email, senha, endereco } = req.body;

  if (!nome || !sobrenome || !email || !senha || !endereco) {
    return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const emailExistente = await client.query('SELECT id FROM cliente WHERE email = $1', [email]);
    if (emailExistente.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este e-mail já está cadastrado!' });
    }

    const senhaHash = await bcrypt.hash(String(senha), 10);

    const enderecoQuery = `
      INSERT INTO endereco (estado, cidade, bairro, rua, numero, lote_complemento, cep)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `;
    const enderecoValues = [
      endereco.estado, endereco.cidade, endereco.bairro,
      endereco.rua, endereco.numero || null, endereco.lote_complemento || null, endereco.cep
    ];
    const resEndereco = await client.query(enderecoQuery, enderecoValues);
    const idEndereco = resEndereco.rows[0].id;

    const clienteQuery = `
      INSERT INTO cliente (nome, sobrenome, email, senha, id_endereco)
      VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, sobrenome, email
    `;
    const resCliente = await client.query(clienteQuery, [nome, sobrenome, email, senhaHash, idEndereco]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Cliente cadastrado com sucesso!',
      usuario: {
        id: resCliente.rows[0].id,
        nome: resCliente.rows[0].nome,
        email: resCliente.rows[0].email,
        tipo: 'cliente'
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao cadastrar cliente:', err);
    res.status(500).json({ error: 'Erro interno ao cadastrar cliente.' });
  } finally {
    client.release();
  }
});

// ==========================================
// ROTA 4: Cadastrar Vendedor (Gera Chave 12 dígitos + Envia E-mail)
// ==========================================
app.post('/api/vendedores', async (req, res) => {
  const { nome_empresa, cnpj, email, senha, endereco } = req.body;

  if (!nome_empresa || !cnpj || !email || !senha || !endereco) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios da empresa.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const cnpjExistente = await client.query('SELECT id FROM vendedor WHERE cnpj = $1 OR email = $2', [cnpj, email]);
    if (cnpjExistente.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'CNPJ ou E-mail já cadastrado no sistema.' });
    }

    const senhaHash = await bcrypt.hash(String(senha), 10);
    const chaveAcesso = gerarChaveVendedor(); // Ex: 202684920194

    const enderecoQuery = `
      INSERT INTO endereco (estado, cidade, bairro, rua, numero, lote_complemento, cep)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `;
    const enderecoValues = [
      endereco.estado, endereco.cidade, endereco.bairro,
      endereco.rua, endereco.numero || null, endereco.lote_complemento || null, endereco.cep
    ];
    const resEndereco = await client.query(enderecoQuery, enderecoValues);
    const idEnderecoEmpresa = resEndereco.rows[0].id;

    const vendedorQuery = `
      INSERT INTO vendedor (nome_empresa, cnpj, email, senha, chave_acesso, autorizado, id_endereco_empresa)
      VALUES ($1, $2, $3, $4, $5, true, $6)
      RETURNING id, nome_empresa, cnpj, email, chave_acesso
    `;
    const resVendedor = await client.query(vendedorQuery, [
      nome_empresa, cnpj, email, senhaHash, chaveAcesso, idEnderecoEmpresa
    ]);

    await client.query('COMMIT');


    //versão original
    // const linkAutorizacao = `http://localhost:${process.env.PORT || 3000}/api/autorizar-vendedor/${chaveAcesso}`;


    //versão nova
    const linkAutorizacao = `${req.protocol}://${req.get('host')}${process.env.PORT || 3000}/api/autorizar-vendedor/${chaveAcesso}`;

    // Envio do E-mail com a Chave de 12 dígitos e o Botão de Autorização
    const mailOptions = {
      from: '"B.S.BUSINESS" <noreply@bsbusiness.com>',
      to: email,
      subject: 'Autorização de Cadastro e Chave de Acesso - B.S.BUSINESS',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
          <div style="background-color: #020c24; color: #ffffff; padding: 24px; text-align: center;">
            <h1 style="margin: 0; letter-spacing: 2px;">B.S.BUSINESS</h1>
            <p style="margin: 5px 0 0; color: #93c5fd; font-size: 12px;">BUY . SELL . NEGÓCIOS</p>
          </div>
          <div style="padding: 30px; background-color: #ffffff; color: #0f172a;">
            <h2>Olá, ${nome_empresa}!</h2>
            <p>Seu cadastro como vendedor foi iniciado. Para realizar seus futuros logins na plataforma, utilize a sua senha cadastrada e a sua <strong>Chave de Identificação Exclusiva de 12 dígitos</strong> abaixo:</p>
            <div style="background-color: #eff6ff; border: 2px dashed #1d4ed8; padding: 16px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #031b4e; margin: 20px 0;">
              ${chaveAcesso}
            </div>
            <p>Clique no botão abaixo para confirmar e autorizar definitivamente o seu cadastro:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${linkAutorizacao}" style="background-color: #031b4e; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                AUTORIZAR MEU CADASTRO
              </a>
            </div>
          </div>
        </div>
      `
    };

    console.log(`\n========================================`);
    console.log(`🔑 CHAVE DO VENDEDOR (${nome_empresa}): ${chaveAcesso}`);
    console.log(`🔗 LINK DE AUTORIZAÇÃO: ${linkAutorizacao}`);
    console.log(`========================================\n`);

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      transporter.sendMail(mailOptions).catch(err => console.error('Erro ao enviar e-mail:', err));
    }

    res.status(201).json({
      message: 'Vendedor cadastrado com sucesso!',
      chave_acesso: chaveAcesso,
      link_autorizacao: linkAutorizacao,
      usuario: {
        id: resVendedor.rows[0].id,
        nome: resVendedor.rows[0].nome_empresa,
        email: resVendedor.rows[0].email,
        chave_acesso: chaveAcesso,
        tipo: 'vendedor'
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao cadastrar vendedor:', err);
    res.status(500).json({ error: `Erro no servidor: ${err.message}` });
  } finally {
    client.release();
  }
});

// Rota acionada pelo botão do e-mail de autorização
app.get('/api/autorizar-vendedor/:chave', async (req, res) => {
  const { chave } = req.params;
  try {
    const result = await pool.query(
      'UPDATE vendedor SET autorizado = true WHERE chave_acesso = $1 RETURNING nome_empresa',
      [chave]
    );
    if (result.rows.length === 0) {
      return res.status(404).send('<h2>Chave de autorização inválida.</h2>');
    }
    res.send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px; background: #020c24; color: white; min-height: 100vh;">
        <h1 style="color: #60a5fa;">Cadastro Autorizado com Sucesso!</h1>
        <p>A empresa <strong>${result.rows[0].nome_empresa}</strong> está oficialmente verificada na B.S.BUSINESS.</p>
        <p>Sua chave de login é: <strong>${chave}</strong></p>
      </div>
    `);
  } catch (err) {
    res.status(500).send('Erro ao autorizar vendedor.');
  }
});

// ==========================================
// ROTA 5: Login (Cliente por E-mail | Vendedor por Chave 12 dígitos)
// ==========================================
app.post('/api/login', async (req, res) => {
  const { identificador, senha, tipo } = req.body;
  const erroGenerico = 'Credenciais inválidas. Verifique seus dados e tente novamente.';

  if (!identificador || !senha) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }

  try {
    // Login de Vendedor (usa Chave de 12 caracteres + Senha)
    if (tipo === 'vendedor' || /^\d{12}$/.test(identificador.trim())) {
      const vendedorRes = await pool.query('SELECT * FROM vendedor WHERE chave_acesso = $1', [identificador.trim()]);
      
      if (vendedorRes.rows.length === 0) {
        return res.status(401).json({ error: 'Chave de vendedor não encontrada.' });
      }

      const vendedor = vendedorRes.rows[0];
      const senhaValida = await bcrypt.compare(String(senha), vendedor.senha.trim());

      if (!senhaValida) {
        return res.status(401).json({ error: erroGenerico });
      }

      return res.json({
        usuario: {
          id: vendedor.id,
          nome: vendedor.nome_empresa,
          chave_acesso: vendedor.chave_acesso,
          tipo: 'vendedor'
        }
      });
    }

    // Login de Cliente (usa E-mail + Senha)
    const clienteRes = await pool.query('SELECT * FROM cliente WHERE email = $1', [identificador.trim()]);
    if (clienteRes.rows.length > 0) {
      const cliente = clienteRes.rows[0];
      const senhaValida = await bcrypt.compare(String(senha), cliente.senha.trim());

      if (!senhaValida) {
        return res.status(401).json({ error: erroGenerico });
      }

      return res.json({
        usuario: {
          id: cliente.id,
          nome: cliente.nome,
          email: cliente.email,
          tipo: 'cliente'
        }
      });
    }

    return res.status(401).json({ error: erroGenerico });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// ==========================================
// ROTA 6: Popular Banco (5 Clientes, 5 Vendedores, 20 Produtos)
// ==========================================
app.get('/api/seed', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const senhaPadraoHash = await bcrypt.hash('123456', 10);

    // 1. Criar 5 Clientes
    const clientesDados = [
      ['Lucas', 'Silva', 'lucas.silva@email.com'],
      ['Mariana', 'Costa', 'mariana.costa@email.com'],
      ['Rafael', 'Oliveira', 'rafael.oliveira@email.com'],
      ['Beatriz', 'Santos', 'beatriz.santos@email.com'],
      ['Gabriel', 'Pereira', 'gabriel.pereira@email.com']
    ];

    for (let i = 0; i < clientesDados.length; i++) {
      const end = await client.query(
        `INSERT INTO endereco (estado, cidade, bairro, rua, numero, cep) VALUES ('SP', 'São Paulo', 'Centro', 'Rua Augusta', '${100 + i}', '01305-000') RETURNING id`
      );
      await client.query(
        `INSERT INTO cliente (nome, sobrenome, email, senha, id_endereco) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING`,
        [clientesDados[i][0], clientesDados[i][1], clientesDados[i][2], senhaPadraoHash, end.rows[0].id]
      );
    }

    // 2. Criar 5 Vendedores
    const vendedoresDados = [
      ['TechNova Eletrônicos', '11222333000101', 'contato@technova.com', '202610000001'],
      ['UrbanStyle Moda', '22333444000102', 'vendas@urbanstyle.com', '202610000002'],
      ['Casa & Conforto Decor', '33444555000103', 'sac@casaconforto.com', '202610000003'],
      ['Atleta Pro Esportes', '44555666000104', 'loja@atletapro.com', '202610000004'],
      ['Essência Pura & Sabores', '55666777000105', 'contato@essenciapura.com', '202610000005']
    ];

    const idsVendedores = [];
    for (let i = 0; i < vendedoresDados.length; i++) {
      const end = await client.query(
        `INSERT INTO endereco (estado, cidade, bairro, rua, numero, cep) VALUES ('DF', 'Brasília', 'Asa Norte', 'SQN 202', '${10 + i}', '70832-000') RETURNING id`
      );
      const vend = await client.query(
        `INSERT INTO vendedor (nome_empresa, cnpj, email, senha, chave_acesso, autorizado, id_endereco_empresa) 
         VALUES ($1, $2, $3, $4, $5, true, $6) 
         ON CONFLICT (cnpj) DO UPDATE SET nome_empresa = EXCLUDED.nome_empresa RETURNING id`,
        [vendedoresDados[i][0], vendedoresDados[i][1], vendedoresDados[i][2], senhaPadraoHash, vendedoresDados[i][3], end.rows[0].id]
      );
      idsVendedores.push(vend.rows[0].id);
    }

    // 3. Criar 20 Produtos Aleatórios
    const produtosDados = [
      ['Notebook UltraSlim i7 16GB', 4299.90, 'Notebook leve com SSD 512GB e tela Full HD.', 15, 'Novo', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500', idsVendedores[0], 'eletronicos'],
      ['Smartphone Galaxy Pro 256GB', 3199.00, 'Câmera tripla de 108MP e bateria de longa duração.', 25, 'Novo', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500', idsVendedores[0], 'eletronicos'],
      ['Fone Bluetooth Noise Cancelling', 549.90, 'Cancelamento ativo de ruído e 30h de bateria.', 40, 'Novo', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500', idsVendedores[0], 'eletronicos'],
      ['Monitor Gamer 27" 165Hz', 1490.00, 'Tempo de resposta de 1ms e painel IPS.', 12, 'Novo', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500', idsVendedores[0], 'eletronicos'],
      ['Jaqueta Corta-Vento Impermeável', 229.90, 'Ideal para dias chuvosos e atividades ao ar livre.', 30, 'Novo', 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500', idsVendedores[1], 'moda'],
      ['Tênis Casual Couro Legítimo', 319.00, 'Conforto extremo para o dia a dia urbano.', 20, 'Novo', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500', idsVendedores[1], 'moda'],
      ['Relógio Cronógrafo Aço Escovado', 680.00, 'Resistente à água até 50m com vidro de safira.', 10, 'Novo', 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=500', idsVendedores[1], 'moda'],
      ['Mochila Executiva Anti-Furto', 189.90, 'Compartimento acolchoado para notebook até 17".', 35, 'Novo', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500', idsVendedores[1], 'moda'],
      ['Cafeteira Expresso Automática', 899.00, 'Prepara espresso, cappuccino e latte com um toque.', 18, 'Novo', 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=500', idsVendedores[2], 'casa'],
      ['Luminária de Mesa Minimalista LED', 145.00, '3 níveis de intensidade de luz quente e fria.', 50, 'Novo', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500', idsVendedores[2], 'casa'],
      ['Jogo de Panelas Antiaderente 5 Peças', 459.90, 'Revestimento cerâmico livre de PFOA.', 22, 'Novo', 'https://images.unsplash.com/photo-1584990347449-a2d4c2c044c9?w=500', idsVendedores[2], 'casa'],
      ['Poltrona Decorativa Veludo Azul', 1150.00, 'Estrutura em madeira maciça e acabamento premium.', 8, 'Novo', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=500', idsVendedores[2], 'casa'],
      ['Bicicleta Mountain Bike Aro 29', 1890.00, 'Câmbio Shimano 21 marchas e freio a disco.', 9, 'Novo', 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=500', idsVendedores[3], 'esporte'],
      ['Kit Halteres Emborrachados 20kg', 340.00, 'Anilhas ajustáveis para treino funcional em casa.', 25, 'Novo', 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=500', idsVendedores[3], 'esporte'],
      ['Tapete de Yoga Antiderrapante TPE', 119.90, 'Espessura de 6mm com alça para transporte.', 45, 'Novo', 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500', idsVendedores[3], 'esporte'],
      ['Smartwatch Esportivo GPS', 799.00, 'Monitoramento cardíaco, oxigênio e 50 modos de treino.', 19, 'Novo', 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=500', idsVendedores[3], 'esporte'],
      ['Kit Skincare Hidratação Profunda', 179.90, 'Sérum de vitamina C, ácido hialurônico e gel facial.', 30, 'Novo', 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=500', idsVendedores[4], 'higiene'],
      ['Perfume Masculino Amadeirado 100ml', 289.00, 'Notas de cedro, âmbar e especiarias finas.', 28, 'Novo', 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=500', idsVendedores[4], 'higiene'],
      ['Café Gourmet Torra Média Grãos 1kg', 74.90, 'Grãos 100% Arábica selecionados da Alta Mogiana.', 60, 'Novo', 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500', idsVendedores[4], 'alimentos'],
      ['Azeite Extra Virgem Chileno 500ml', 68.50, 'Acidez máxima de 0,2%, prensado a frio.', 40, 'Novo', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500', idsVendedores[4], 'alimentos']
    ];

    for (const p of produtosDados) {
      await client.query(
        `INSERT INTO produto (nome, preco, descricao, quantidade_em_estoque, estado_conservacao, imagem_url, id_vendedor, categoria)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        p
      );
    }

    await client.query('COMMIT');
    res.json({
      message: '5 Clientes, 5 Vendedores e 20 Produtos cadastrados com sucesso!',
      vendedores_criados: vendedoresDados.map(v => ({ empresa: v[0], chave_login: v[3], senha_padrao: '123456' })),
      clientes_criados: clientesDados.map(c => ({ nome: c[0], email: c[2], senha_padrao: '123456' }))
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao popular banco: ' + err.message });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor B.S.BUSINESS rodando na porta ${PORT}`);
  console.log(`Para cadastrar automaticamente os 5 clientes, 5 vendedores e 20 produtos, acesse: http://localhost:${PORT}/api/seed`);
});