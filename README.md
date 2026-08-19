# Compras SENAI

MVP em TypeScript para solicitacoes de compras, com os perfis de professor e coordenacao.

Para arquitetura, regras de negocio, modelo de dados, endpoints e limitacoes conhecidas, consulte [CONTEXTO_PROJETO.md](CONTEXTO_PROJETO.md).

O sistema tem tres partes:

- `frontend`: tela React aberta no navegador;
- `backend`: API Node.js na porta 3333;
- SQL Server: armazena usuarios, catalogo, solicitacoes e notificacoes.

## Configuracao deste PC

O projeto esta preparado para a instancia local `localhost\SQLEXPRESS`, com autenticacao do Windows. O Docker e o MySQL nao sao mais necessarios.

Na primeira execucao, o backend cria automaticamente o banco `compras_senai`, as tabelas, os centros de custo e os usuarios de demonstracao. O usuario do Windows que inicia o sistema precisa ter acesso ao SQL Server e permissao para criar o banco na primeira vez.

## Como rodar

Abra o PowerShell na pasta do projeto:

```powershell
cd C:\Users\486973624\Documents\compras-senai
```

Na primeira vez, instale as dependencias das tres pastas:

```powershell
npm install
npm install --prefix backend
npm install --prefix frontend
```

Depois, inicie o sistema inteiro com um unico comando:

```powershell
npm run dev
```

Mantenha essa janela aberta enquanto estiver usando o sistema. Quando aparecerem as mensagens do Vite e `API pronta em http://localhost:3333`, abra:

- Sistema: http://localhost:5173
- Teste da API: http://localhost:3333/api/health

Para encerrar, volte ao PowerShell e pressione `Ctrl+C`.

Nas proximas vezes, basta entrar na pasta do projeto e executar `npm run dev`.

## Usuarios de demonstracao

- Professor: `professor@senai.local` / `professor123`
- Coordenacao: `coordenacao@senai.local` / `coordenacao123`

## Configuracao do banco

Os valores padrao ja correspondem a este PC, entao o arquivo `.env` e opcional. Para usar outra instancia, copie o exemplo:

```powershell
Copy-Item backend\.env.example backend\.env
```

Depois altere `backend\.env`. As principais opcoes sao:

```dotenv
DB_SERVER=localhost
DB_INSTANCE=SQLEXPRESS
DB_NAME=compras_senai
DB_TRUSTED_CONNECTION=true
DB_DRIVER=ODBC Driver 17 for SQL Server
```

Com `DB_TRUSTED_CONNECTION=true`, nao se informa usuario ou senha: o SQL Server reconhece a conta do Windows que executou `npm run dev`.

## Acesso por outro computador da rede

O frontend escolhe automaticamente `http://<endereco-deste-pc>:3333/api`. Caso o navegador seja aberto por outro endereco, adicione a origem permitida no `backend\.env`, separando os enderecos por virgula:

```dotenv
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://192.168.0.10:5173
```

Para fixar manualmente o endereco da API, copie `frontend\.env.example` para `frontend\.env` e edite `VITE_API_URL`.

## Planilha de catalogo

A coordenacao pode importar arquivos `.xlsx` ou `.csv`. A primeira aba deve ter colunas com nomes equivalentes a `codigo` e `descricao`. Cada importacao substitui o catalogo anterior.

## Solucao de problemas

- `Falha ao iniciar banco/API`: confirme no Servicos do Windows se `SQL Server (SQLEXPRESS)` esta em execucao.
- `Login failed` ou erro de permissao: abra o PowerShell com uma conta do Windows autorizada no SQL Server.
- Porta em uso: feche outra execucao do sistema antes de rodar `npm run dev` novamente.
- Tela abre, mas nao carrega dados: acesse http://localhost:3333/api/health; a resposta esperada e `{"ok":true}`.
