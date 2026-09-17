# Confirmação de Formação

Aplicação web para envio de convites de confirmação de participações em formação.

## Funcionalidades

- Interface para criar formações e adicionar participantes
- Envio automático de emails de confirmação
- Participantes podem confirmar ou recusar presença via link no email
- Registo de todas as confirmações

## Configuração

1. Copie o ficheiro `.env.example` para `.env`
2. Preencha as credenciais SMTP:
   - `SMTP_USER`: O seu email (ex: vladimiro.viana@monte.pt)
   - `SMTP_PASS`: A sua password de email
3. O servidor SMTP já está configurado para Microsoft 365

## Como Usar

```bash
# Instalar dependências
npm install

# Iniciar o servidor
npm start
```

Aceda a http://localhost:3000 no navegador.

## Estrutura

```
formacao-app/
├── server.js           # Backend Node.js
├── public/
│   └── index.html      # Interface web
├── .env.example        # Exemplo de configuração
├── .env                # Configuração real (não partilhar)
└── package.json
```
