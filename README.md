# Compras SENAI

MVP em TypeScript para solicitacoes de compras, com perfis de professor e coordenacao.

Para arquitetura, regras de negocio, modelo de dados, endpoints e limitacoes conhecidas, consulte [CONTEXTO_PROJETO.md](CONTEXTO_PROJETO.md).

O sistema tem tres partes:

- `frontend`: app React/Vite aberto no navegador;
- `backend`: API Node.js/Express;
- PostgreSQL: armazena usuarios, catalogo, solicitacoes e notificacoes.

## Como rodar localmente

Abra o PowerShell na pasta do projeto:

```powershell
cd C:\Users\159347624\Documents\compras-senai
```

Na primeira vez, instale as dependencias:

```powershell
npm install
npm install --prefix backend
npm install --prefix frontend
```

Crie um banco PostgreSQL local chamado `compras_senai`. Se quiser sobrescrever usuario, senha ou host, copie o exemplo:

```powershell
Copy-Item backend\.env.example backend\.env
```

Depois edite `backend\.env`. O backend tambem aceita uma URL unica:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/compras_senai
```

Inicie o sistema inteiro:

```powershell
npm run dev
```

Quando aparecerem as mensagens do Vite e `API pronta em http://localhost:3333`, abra:

- Sistema: http://localhost:5173
- Teste da API: http://localhost:3333/api/health

## Usuarios de demonstracao

- Professor: `professor@senai.local` / `professor123`
- Coordenacao: `coordenacao@senai.local` / `coordenacao123`

Na primeira execucao, o backend cria automaticamente as tabelas, os centros de custo e esses usuarios.

## Deploy no Render

Este repositorio inclui um `render.yaml` para criar:

- `compras-senai-api`: Web Service Node.js do backend;
- `compras-senai`: Static Site do frontend;
- `compras-senai-db`: Render Postgres gratuito.

Passos:

1. Envie o repositorio para GitHub/GitLab/Bitbucket.
2. No Render, escolha **New > Blueprint**.
3. Selecione este repositorio e confirme o arquivo `render.yaml`.
4. Aguarde o Render criar o banco, a API e o frontend.

O Blueprint injeta `DATABASE_URL` automaticamente na API usando a URL interna do Postgres. Ele tambem gera `JWT_SECRET` sem gravar segredo no repositorio.

As URLs configuradas sao:

```text
Frontend: https://compras-senai.onrender.com
API:      https://compras-senai-api.onrender.com/api
```

Se o Render alterar o nome/slug de algum servico por conflito, ajuste estes valores nas variaveis de ambiente:

- `VITE_API_URL` no static site;
- `FRONTEND_URL` ou `CORS_ORIGINS` na API.

## Observacao sobre o plano gratuito

O Render Postgres gratuito existe, tem 1 GB, mas expira depois de 30 dias e nao tem backups. Serve bem para demonstracao e teste. Para uso real, atualize para um plano pago antes do prazo para nao perder dados.

## Planilha de catalogo

A coordenacao pode importar arquivos `.xlsx` ou `.csv`. A primeira aba deve ter colunas com nomes equivalentes a `codigo` e `descricao`. Cada importacao substitui o catalogo anterior.

## Solucao de problemas

- `Falha ao iniciar banco/API`: confirme se `DATABASE_URL` aponta para um Postgres acessivel.
- Erro de CORS no Render: confira se `FRONTEND_URL` ou `CORS_ORIGINS` contem a URL publica do frontend.
- Tela abre, mas nao carrega dados: acesse `/api/health` na URL da API; a resposta esperada e `{"ok":true}`.
- Banco gratuito expirado: crie outro banco para testes ou atualize o banco no Render antes do fim da janela de graca.
