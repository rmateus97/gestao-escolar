// --- DEPENDÊNCIAS ---
const PDFDocument = require('pdfkit');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// --- CONFIGURAÇÃO INICIAL ---
const app = express();
const PORT = 3000;
const JWT_SECRET = 'd4f0a5b8e9c3a2d1f6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9';

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// --- BANCO DE DADOS ---
const db = new sqlite3.Database('./escola.db', (err) => {
    if (err) return console.error('Erro ao conectar com o banco de dados:', err.message);
    console.log('Conectado ao banco de dados SQLite.');
    db.run('PRAGMA foreign_keys = ON;');
});

// --- CRIAÇÃO DAS TABELAS ---
db.serialize(() => {
    // Tabela para usuários do sistema com senhas seguras
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL
    )`);
    
    // Tabela de turmas
    db.run(`CREATE TABLE IF NOT EXISTS turmas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE,
        serie TEXT NOT NULL,
        professor TEXT,
        ano INTEGER NOT NULL,
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de professores
    db.run(`CREATE TABLE IF NOT EXISTS professores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome_completo TEXT NOT NULL,
        data_nascimento DATE NOT NULL,
        genero TEXT NOT NULL,
        cpf TEXT UNIQUE NOT NULL,
        rg TEXT NOT NULL,
        endereco_rua TEXT NOT NULL,
        endereco_numero TEXT NOT NULL,
        endereco_bairro TEXT NOT NULL,
        endereco_cidade TEXT NOT NULL,
        endereco_estado TEXT NOT NULL,
        endereco_cep TEXT NOT NULL,
        email_institucional TEXT UNIQUE NOT NULL,
        telefone TEXT NOT NULL,
        disciplinas TEXT NOT NULL,
        formacao_academica TEXT NOT NULL,
        data_admissao DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'Ativo',
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de alunos
    db.run(`CREATE TABLE IF NOT EXISTS alunos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome_completo TEXT NOT NULL,
        data_nascimento DATE NOT NULL,
        genero TEXT NOT NULL,
        cpf TEXT UNIQUE NOT NULL,
        rg TEXT,
        endereco_rua TEXT NOT NULL,
        endereco_numero TEXT NOT NULL,
        endereco_bairro TEXT NOT NULL,
        endereco_cidade TEXT NOT NULL,
        endereco_estado TEXT NOT NULL,
        endereco_cep TEXT NOT NULL,
        nome_responsavel TEXT NOT NULL,
        telefone_responsavel TEXT NOT NULL,
        email_responsavel TEXT NOT NULL,
        turma_id INTEGER,
        ano_ingresso INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'Ativo',
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (turma_id) REFERENCES turmas (id)
    )`);
});

// --- MIDDLEWARE DE AUTENTICAÇÃO (GUARDIÃO DA API) ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// === ROTAS DE AUTENTICAÇÃO (PÚBLICAS) ===

app.post('/api/registrar', async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    
    try {
        const senhaHash = await bcrypt.hash(senha, 10);
        db.run('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)', [nome, email, senhaHash], function(err) {
            if (err) return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
            res.status(201).json({ message: 'Usuário criado com sucesso!' });
        });
    } catch {
        res.status(500).json({ error: 'Erro interno ao criar usuário.' });
    }
});

app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    db.get('SELECT * FROM usuarios WHERE email = ?', [email], async (err, user) => {
        if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });
        
        const match = await bcrypt.compare(senha, user.senha);
        if (!match) return res.status(401).json({ error: 'Credenciais inválidas.' });
        
        const payload = { id: user.id, email: user.email, nome: user.nome };
        const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
        res.json({ accessToken, user: payload });
    });
});

// === ROTAS DE DADOS (PROTEGIDAS) ===

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

// ROTA PARA GERAR O PDF DA TURMA
app.get('/api/turmas/:id/pdf', authenticateToken, (req, res) => {
    const turmaId = req.params.id;
    
    // 1. Buscar os dados da turma e do professor
    const sqlTurma = `SELECT * FROM turmas WHERE id = ?`;
    db.get(sqlTurma, [turmaId], (err, turma) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar dados da turma." });
        if (!turma) return res.status(404).json({ error: "Turma não encontrada." });

        // 2. Buscar a lista de alunos daquela turma
        const sqlAlunos = `SELECT * FROM alunos WHERE turma_id = ? ORDER BY nome_completo`;
        db.all(sqlAlunos, [turmaId], (err, alunos) => {
            if (err) return res.status(500).json({ error: "Erro ao buscar lista de alunos." });

            // 3. Gerar o PDF com os dados encontrados
            try {
                const doc = new PDFDocument({ margin: 50 });

                // Configura o cabeçalho da resposta para indicar que é um arquivo PDF
                const filename = `Relatorio_Turma_${turma.nome.replace(/\s+/g, '_')}.pdf`;
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

                // Envia o PDF gerado diretamente para a resposta do navegador
                doc.pipe(res);

                // --- Conteúdo do PDF ---

                // Cabeçalho do Documento
                doc.fontSize(18).font('Helvetica-Bold').text('Relatório da Turma', { align: 'center' });
                doc.moveDown();

                // Informações da Turma
                doc.fontSize(14).font('Helvetica-Bold').text('Dados da Turma');
                doc.fontSize(12).font('Helvetica')
                   .text(`Nome: ${turma.nome}`)
                   .text(`Série: ${turma.serie}`)
                   .text(`Ano Letivo: ${turma.ano}`)
                   .text(`Professor(a): ${turma.professor || 'Não definido'}`);
                doc.moveDown(2);

                // Lista de Alunos
                doc.fontSize(14).font('Helvetica-Bold').text('Lista de Alunos');
                doc.lineCap('butt').moveTo(50, doc.y).lineTo(550, doc.y).stroke(); // Linha separadora
                doc.moveDown();
                
                if (alunos.length > 0) {
                    alunos.forEach((aluno, index) => {
                        doc.fontSize(11).font('Helvetica').text(`${index + 1}. ${aluno.nome_completo} | CPF: ${aluno.cpf} | Status: ${aluno.status}`);
                    });
                } else {
                    doc.fontSize(11).font('Helvetica-Oblique').text('Nenhum aluno cadastrado nesta turma.');
                }
                
                // Rodapé (opcional)
                doc.fontSize(8).text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 50, 720, { align: 'center', width: 500 });


                // Finaliza o PDF
                doc.end();

            } catch (pdfError) {
                console.error("Erro ao gerar o PDF:", pdfError);
                res.status(500).send({ error: 'Não foi possível gerar o PDF.' });
            }
        });
    });
});

// ROTAS PARA TURMAS
app.get('/api/turmas', authenticateToken, (req, res) => db.all('SELECT * FROM turmas ORDER BY serie, nome', (err, rows) => err ? res.status(500).json({ error: err.message }) : res.json(rows)));
app.get('/api/turmas/:id', authenticateToken, (req, res) => db.get('SELECT * FROM turmas WHERE id = ?', [req.params.id], (err, row) => err ? res.status(500).json({ error: err.message }) : (row ? res.json(row) : res.status(404).json({ error: 'Turma não encontrada' }))));
app.post('/api/turmas', authenticateToken, (req, res) => {
    const { nome, serie, ano, professor } = req.body;
    if (!nome || !serie || !ano) return res.status(400).json({ error: 'Nome, série e ano são obrigatórios' });
    db.run('INSERT INTO turmas (nome, serie, ano, professor) VALUES (?, ?, ?, ?)', [nome, serie, ano, professor], function(err) {
        if (err) return res.status(400).json({ error: 'Nome da turma já existe' });
        res.status(201).json({ id: this.lastID, message: 'Turma cadastrada com sucesso' });
    });
});
app.put('/api/turmas/:id', authenticateToken, (req, res) => {
    const { nome, serie, ano, professor } = req.body;
    if (!nome || !serie || !ano) return res.status(400).json({ error: 'Nome, série e ano são obrigatórios' });
    db.run('UPDATE turmas SET nome = ?, serie = ?, ano = ?, professor = ? WHERE id = ?', [nome, serie, ano, professor, req.params.id], function(err) {
        if (err) return res.status(400).json({ error: 'Nome da turma já existe' });
        this.changes === 0 ? res.status(404).json({ error: 'Turma não encontrada' }) : res.json({ message: 'Turma atualizada com sucesso' });
    });
});
app.delete('/api/turmas/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    db.get('SELECT COUNT(*) as count FROM alunos WHERE turma_id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row.count > 0) return res.status(400).json({ error: 'Não é possível excluir turma com alunos cadastrados' });
        db.run('DELETE FROM turmas WHERE id = ?', [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            this.changes === 0 ? res.status(404).json({ error: 'Turma não encontrada' }) : res.json({ message: 'Turma excluída com sucesso' });
        });
    });
});

// ROTAS PARA PROFESSORES
app.get('/api/professores', authenticateToken, (req, res) => db.all('SELECT * FROM professores ORDER BY nome_completo', (err, rows) => err ? res.status(500).json({ error: err.message }) : res.json(rows)));
app.get('/api/professores/buscar/:termo', authenticateToken, (req, res) => db.all('SELECT * FROM professores WHERE nome_completo LIKE ? ORDER BY nome_completo', [`%${req.params.termo}%`], (err, rows) => err ? res.status(500).json({ error: err.message }) : res.json(rows)));
app.get('/api/professores/:id', authenticateToken, (req, res) => db.get('SELECT * FROM professores WHERE id = ?', [req.params.id], (err, row) => err ? res.status(500).json({ error: err.message }) : (row ? res.json(row) : res.status(404).json({ error: 'Professor não encontrado' }))));
app.post('/api/professores', authenticateToken, (req, res) => {
    const { nome_completo, data_nascimento, genero, cpf, rg, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, email_institucional, telefone, disciplinas, formacao_academica, data_admissao, status } = req.body;
    if (!nome_completo || !data_nascimento || !genero || !cpf || !rg || !endereco_rua || !endereco_numero || !endereco_bairro || !endereco_cidade || !endereco_estado || !endereco_cep || !email_institucional || !telefone || !disciplinas || !formacao_academica || !data_admissao) {
        return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }
    const sql = `INSERT INTO professores (nome_completo, data_nascimento, genero, cpf, rg, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, email_institucional, telefone, disciplinas, formacao_academica, data_admissao, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [nome_completo, data_nascimento, genero, cpf, rg, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, email_institucional, telefone, disciplinas, formacao_academica, data_admissao, status || 'Ativo'];
    db.run(sql, params, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'CPF ou Email já cadastrado.' });
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, message: 'Professor cadastrado com sucesso' });
    });
});
app.put('/api/professores/:id', authenticateToken, (req, res) => {
    const { nome_completo, data_nascimento, genero, cpf, rg, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, email_institucional, telefone, disciplinas, formacao_academica, data_admissao, status } = req.body;
    if (!nome_completo || !data_nascimento || !genero || !cpf || !rg || !endereco_rua || !endereco_numero || !endereco_bairro || !endereco_cidade || !endereco_estado || !endereco_cep || !email_institucional || !telefone || !disciplinas || !formacao_academica || !data_admissao) {
        return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }
    const sql = `UPDATE professores SET nome_completo = ?, data_nascimento = ?, genero = ?, cpf = ?, rg = ?, endereco_rua = ?, endereco_numero = ?, endereco_bairro = ?, endereco_cidade = ?, endereco_estado = ?, endereco_cep = ?, email_institucional = ?, telefone = ?, disciplinas = ?, formacao_academica = ?, data_admissao = ?, status = ? WHERE id = ?`;
    const params = [nome_completo, data_nascimento, genero, cpf, rg, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, email_institucional, telefone, disciplinas, formacao_academica, data_admissao, status || 'Ativo', req.params.id];
    db.run(sql, params, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'CPF ou Email já cadastrado.' });
            return res.status(500).json({ error: err.message });
        }
        this.changes === 0 ? res.status(404).json({ error: 'Professor não encontrado' }) : res.json({ message: 'Professor atualizado com sucesso' });
    });
});
app.delete('/api/professores/:id', authenticateToken, (req, res) => db.run('DELETE FROM professores WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    this.changes === 0 ? res.status(404).json({ error: 'Professor não encontrado' }) : res.json({ message: 'Professor excluído com sucesso' });
}));

// ROTAS PARA ALUNOS
app.get('/api/alunos', authenticateToken, (req, res) => db.all(`SELECT a.*, t.nome as turma_nome, t.serie as turma_serie FROM alunos a LEFT JOIN turmas t ON a.turma_id = t.id ORDER BY a.nome_completo`, (err, rows) => err ? res.status(500).json({ error: err.message }) : res.json(rows)));
app.get('/api/alunos/turma/:turmaId', authenticateToken, (req, res) => db.all(`SELECT a.*, t.nome as turma_nome, t.serie as turma_serie FROM alunos a LEFT JOIN turmas t ON a.turma_id = t.id WHERE a.turma_id = ? ORDER BY a.nome_completo`, [req.params.turmaId], (err, rows) => err ? res.status(500).json({ error: err.message }) : res.json(rows)));
app.get('/api/alunos/buscar/:termo', authenticateToken, (req, res) => db.all(`SELECT a.*, t.nome as turma_nome, t.serie as turma_serie FROM alunos a LEFT JOIN turmas t ON a.turma_id = t.id WHERE a.nome_completo LIKE ? ORDER BY a.nome_completo`, [`%${req.params.termo}%`], (err, rows) => err ? res.status(500).json({ error: err.message }) : res.json(rows)));
app.get('/api/alunos/:id', authenticateToken, (req, res) => db.get(`SELECT a.*, t.nome as turma_nome, t.serie as turma_serie FROM alunos a LEFT JOIN turmas t ON a.turma_id = t.id WHERE a.id = ?`, [req.params.id], (err, row) => err ? res.status(500).json({ error: err.message }) : (row ? res.json(row) : res.status(404).json({ error: 'Aluno não encontrado' }))));
app.post('/api/alunos', authenticateToken, (req, res) => {
    const { nome_completo, data_nascimento, genero, cpf, rg, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, nome_responsavel, telefone_responsavel, email_responsavel, turma_id, ano_ingresso, status } = req.body;
    if (!nome_completo || !data_nascimento || !genero || !cpf || !endereco_rua || !endereco_numero || !endereco_bairro || !endereco_cidade || !endereco_estado || !endereco_cep || !nome_responsavel || !telefone_responsavel || !email_responsavel || !ano_ingresso) {
        return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }
    const sql = `INSERT INTO alunos (nome_completo, data_nascimento, genero, cpf, rg, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, nome_responsavel, telefone_responsavel, email_responsavel, turma_id, ano_ingresso, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [nome_completo, data_nascimento, genero, cpf, rg, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, nome_responsavel, telefone_responsavel, email_responsavel, turma_id, ano_ingresso, status || 'Ativo'];
    db.run(sql, params, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'CPF já cadastrado.' });
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, message: 'Aluno cadastrado com sucesso' });
    });
});
app.put('/api/alunos/:id', authenticateToken, (req, res) => {
    const { nome_completo, data_nascimento, genero, cpf, rg, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, nome_responsavel, telefone_responsavel, email_responsavel, turma_id, ano_ingresso, status } = req.body;
    if (!nome_completo || !data_nascimento || !genero || !cpf || !endereco_rua || !endereco_numero || !endereco_bairro || !endereco_cidade || !endereco_estado || !endereco_cep || !nome_responsavel || !telefone_responsavel || !email_responsavel || !ano_ingresso) {
        return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }
    const sql = `UPDATE alunos SET nome_completo = ?, data_nascimento = ?, genero = ?, cpf = ?, rg = ?, endereco_rua = ?, endereco_numero = ?, endereco_bairro = ?, endereco_cidade = ?, endereco_estado = ?, endereco_cep = ?, nome_responsavel = ?, telefone_responsavel = ?, email_responsavel = ?, turma_id = ?, ano_ingresso = ?, status = ? WHERE id = ?`;
    const params = [nome_completo, data_nascimento, genero, cpf, rg, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, nome_responsavel, telefone_responsavel, email_responsavel, turma_id, ano_ingresso, status || 'Ativo', req.params.id];
    db.run(sql, params, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'CPF já cadastrado.' });
            return res.status(500).json({ error: err.message });
        }
        this.changes === 0 ? res.status(404).json({ error: 'Aluno não encontrado' }) : res.json({ message: 'Aluno atualizado com sucesso' });
    });
});
app.delete('/api/alunos/:id', authenticateToken, (req, res) => db.run('DELETE FROM alunos WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    this.changes === 0 ? res.status(404).json({ error: 'Aluno não encontrado' }) : res.json({ message: 'Aluno excluído com sucesso' });
}));

// Iniciar Servidor
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor rodando em http://localhost:${PORT}`));
process.on('SIGINT', () => db.close(() => process.exit(0)));