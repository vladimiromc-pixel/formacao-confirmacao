require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const confirmacoes = {};
const CONFIRMACOES_FILE = path.join(__dirname, 'confirmacoes.json');

function loadConfirmacoes() {
  if (fs.existsSync(CONFIRMACOES_FILE)) {
    const data = fs.readFileSync(CONFIRMACOES_FILE, 'utf8');
    Object.assign(confirmacoes, JSON.parse(data));
  }
}

function saveConfirmacoes() {
  fs.writeFileSync(CONFIRMACOES_FILE, JSON.stringify(confirmacoes, null, 2));
}

loadConfirmacoes();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: { rejectUnauthorized: false }
});

app.get('/api/config-check', (req, res) => {
  res.json({
    configured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
    smtpHost: process.env.SMTP_HOST || 'smtp.office365.com',
    smtpUser: process.env.SMTP_USER ? '***configurado***' : 'nao configurado'
  });
});

app.post('/api/enviar-confirmacoes', async (req, res) => {
  try {
    const { formacao, data, horas, participantes } = req.body;

    if (!formacao || !data || !horas || !participantes || participantes.length === 0) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const resultados = [];

    for (const participante of participantes) {
      const id = uuidv4();
      confirmacoes[id] = {
        formacao,
        data,
        horas,
        nome: participante.nome,
        email: participante.email,
        status: 'pendente',
        criadoEm: new Date().toISOString()
      };
      saveConfirmacoes();

      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const linkConfirmacao = `${baseUrl}/confirmar?id=${id}`;
      const linkRecusa = `${baseUrl}/recusar?id=${id}`;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c5282;">Confirmação de Participação em Formação</h2>
          <p>Olá <strong>${participante.nome}</strong>,</p>
          <p>Por favor, confirme se participou na seguinte formação:</p>
          <div style="background-color: #f7fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Formação:</strong> ${formacao}</p>
            <p style="margin: 5px 0;"><strong>Data:</strong> ${data}</p>
            <p style="margin: 5px 0;"><strong>Duração:</strong> ${horas} horas</p>
          </div>
          <p>Responda indicando se participou ou não:</p>
          <div style="margin: 20px 0;">
            <a href="${linkConfirmacao}" style="background-color: #38a169; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Participei</a>
            <a href="${linkRecusa}" style="background-color: #e53e3e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Não Participei</a>
          </div>
          <p style="color: #718096; font-size: 12px;">Este é um email automático. Por favor, não responda diretamente a este email.</p>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: participante.email,
          subject: `Confirmação: ${formacao} - ${data}`,
          html: htmlContent
        });
        resultados.push({ nome: participante.nome, email: participante.email, status: 'enviado' });
      } catch (emailError) {
        resultados.push({ nome: participante.nome, email: participante.email, status: 'erro', erro: emailError.message });
      }
    }

    res.json({ sucesso: true, resultados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/confirmar', (req, res) => {
  const { id } = req.query;
  if (!id || !confirmacoes[id]) {
    return res.status(404).send('Pedido não encontrado');
  }

  confirmacoes[id].status = 'confirmado';
  confirmacoes[id].confirmadoEm = new Date().toISOString();
  saveConfirmacoes();

  res.send(`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
      <h1 style="color: #38a169;">Participação Confirmada!</h1>
      <p>A sua participação na formação <strong>${confirmacoes[id].formacao}</strong> foi registada com sucesso.</p>
      <p><strong>Data:</strong> ${confirmacoes[id].data}</p>
      <p>Obrigado pela sua resposta!</p>
    </div>
  `);
});

app.get('/recusar', (req, res) => {
  const { id } = req.query;
  if (!id || !confirmacoes[id]) {
    return res.status(404).send('Pedido não encontrado');
  }

  confirmacoes[id].status = 'nao_confirmado';
  confirmacoes[id].recusadoEm = new Date().toISOString();
  saveConfirmacoes();

  res.send(`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
      <h1 style="color: #e53e3e;">Participação Não Confirmada</h1>
      <p>A sua resposta na formação <strong>${confirmacoes[id].formacao}</strong> foi registada.</p>
      <p>Se precisar de esclarecimentos, contacte o organizador.</p>
    </div>
  `);
});

app.get('/api/confirmacoes', (req, res) => {
  const { formacao } = req.query;
  let resultado = Object.values(confirmacoes);

  if (formacao) {
    resultado = resultado.filter(c => c.formacao === formacao);
  }

  res.json(resultado);
});

app.get('/api/exportar-excel', (req, res) => {
  const { formacao } = req.query;
  let dados = Object.values(confirmacoes);

  if (formacao) {
    dados = dados.filter(c => c.formacao === formacao);
  }

  const worksheetData = dados.map(c => ({
    'Formação': c.formacao,
    'Data': c.data,
    'Horas': c.horas,
    'Nome': c.nome,
    'Email': c.email,
    'Estado': c.status === 'confirmado' ? 'Confirmou participação' : c.status === 'nao_confirmado' ? 'Não confirmou participação' : 'Pendente',
    'Data Resposta': c.confirmadoEm || c.recusadoEm || '',
    'Data Pedido': c.criadoEm
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Confirmações');

  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=confirmacoes_formacao.xlsx');
  res.send(excelBuffer);
});

app.get('/api/formacoes', (req, res) => {
  const formacoes = [...new Set(Object.values(confirmacoes).map(c => c.formacao))];
  res.json(formacoes);
});

app.listen(PORT, () => {
  console.log(`Servidor a correr em http://localhost:${PORT}`);
  console.log(`Configuração SMTP: ${process.env.SMTP_USER ? 'Configurado' : 'NÃO CONFIGURADO - ver ficheiro .env'}`);
});
