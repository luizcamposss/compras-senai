# Contexto completo do projeto Compras SENAI

## 1. Resumo executivo

O Compras SENAI é um MVP web para centralizar solicitações de compra de materiais. Ele substitui um fluxo disperso por um processo simples entre dois perfis:

- professor: consulta o catálogo, solicita itens existentes ou sugere itens novos e acompanha os retornos;
- coordenação: importa o catálogo institucional, consulta a fila e aprova, recusa ou solicita ajustes.

O sistema roda localmente e tambem esta preparado para deploy no Render. O navegador acessa um frontend React, que chama uma API Node.js. A API persiste os dados em PostgreSQL.

```text
Navegador
   │ HTTP/JSON + JWT
   ▼
Frontend React/Vite :5173
   │ /api
   ▼
Backend Express :3333 ───── uploads locais
   │ pg + DATABASE_URL
   ▼
PostgreSQL / Render Postgres
   └── banco compras_senai
```

## 2. Estado atual

O projeto esta funcional como MVP. A configuracao antiga de SQL Server foi substituida por PostgreSQL para permitir deploy no Render com Render Postgres.

Configuração esperada:

- banco: `compras_senai`;
- conexao: `DATABASE_URL` ou variaveis `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`;
- deploy: `render.yaml` com API, frontend estatico e Postgres;
- frontend: `http://localhost:5173`;
- backend: `http://localhost:3333`.

A compilação do frontend e do backend, a inicialização do banco, o login do professor e a consulta dos centros de custo foram validados.

## 3. Tecnologias

### Frontend

- React 19;
- TypeScript;
- Vite 8;
- Lucide React para ícones;
- fonte Manrope;
- CSS próprio e responsivo;
- `localStorage` para guardar token e usuário da sessão.

### Backend

- Node.js com TypeScript e módulos ES;
- Express 5;
- JWT para autenticação;
- bcrypt para hash de senhas;
- Multer para uploads;
- ExcelJS para arquivos XLSX e CSV;
- `pg` para PostgreSQL.

### Banco e infraestrutura

- PostgreSQL local ou Render Postgres;
- criação automática do banco e das tabelas;
- deploy no Render por Blueprint (`render.yaml`);
- arquivos anexados armazenados em `backend/uploads`;
- frontend e backend iniciados juntos pelo pacote `concurrently`.

## 4. Estrutura do repositório

```text
compras-senai/
├── package.json                 comandos gerais do projeto
├── README.md                    instruções rápidas de instalação e execução
├── CONTEXTO_PROJETO.md          este documento
├── backend/
│   ├── .env.example             exemplo de configuração
│   ├── package.json             dependências e scripts da API
│   ├── tsconfig.json
│   ├── uploads/                 anexos enviados pelos professores
│   └── src/
│       ├── server.ts            rotas, regras e inicialização da API
│       ├── db.ts                conexão, esquema e dados iniciais
│       ├── auth.ts              JWT e autorização por perfil
│       └── validators.ts        validações de campos e fornecedores
└── frontend/
    ├── .env.example             URL opcional da API
    ├── package.json
    ├── vite.config.ts
    ├── public/                  logos, favicon e outros arquivos públicos
    └── src/
        ├── main.tsx             entrada da aplicação React
        ├── App.tsx              telas, componentes, estado e integração com API
        ├── App.css              estilos dos componentes
        ├── index.css            estilos globais
        └── assets/              imagens usadas pela interface
```

## 5. Perfis e permissões

| Recurso | Professor | Coordenação |
|---|---:|---:|
| Entrar no sistema | Sim | Sim |
| Ver centros de custo | Sim | Sim |
| Consultar catálogo | Sim | Sim, por meio da gestão/importação |
| Criar solicitação | Sim | Não |
| Ver solicitações | Somente as próprias | Todas |
| Importar catálogo | Não | Sim |
| Aprovar, recusar ou pedir ajuste | Não | Sim |
| Ler notificações | Sim | Sim |

O backend aplica as permissões com os middlewares `requireAuth` e `requireRole`; portanto, a proteção não depende apenas de esconder botões no frontend.

## 6. Fluxos funcionais

### 6.1 Login

1. O usuário informa e-mail e senha.
2. A API localiza o usuário e compara a senha com o hash bcrypt.
3. Em caso de sucesso, a API emite um JWT válido por 8 horas.
4. O frontend guarda o token e os dados básicos do usuário no `localStorage`.
5. As chamadas seguintes enviam `Authorization: Bearer <token>`.

Contas iniciais:

- `professor@senai.local` / `professor123`;
- `coordenacao@senai.local` / `coordenacao123`.

### 6.2 Solicitação de item do catálogo

1. O professor pesquisa por código ou descrição.
2. A pesquisa aguarda 250 ms após a digitação e retorna até 40 itens.
3. O professor seleciona o item.
4. Informa quantidade, centro de custo e justificativa.
5. Revisa e envia.
6. A solicitação nasce com status `aguardando_coordenacao`.
7. A tela mostra um protocolo no formato `SOL-ANO-000001`.

### 6.3 Solicitação de item novo

1. O professor escolhe “Item novo”.
2. Informa nome, descrição e link de fornecedor.
3. Informa quantidade, centro de custo e justificativa.
4. Pode anexar ficha técnica e foto.
5. A solicitação nasce com status `novo_item_pendente`.

Links de Amazon, Shopee e Mercado Livre são bloqueados no frontend e novamente no backend. URLs inválidas também são recusadas.

### 6.4 Análise da coordenação

1. A coordenação abre a fila com todas as solicitações.
2. Digita obrigatoriamente uma resposta.
3. Escolhe uma decisão:
   - `aprovada`;
   - `recusada`;
   - `ajuste_solicitado`.
4. A API atualiza a solicitação e cria uma notificação para o professor.
5. Se um item novo for aprovado, a API cria automaticamente um registro no catálogo com código `NOVO-00001` e associa esse item à solicitação.

### 6.5 Importação do catálogo

1. A coordenação envia um arquivo `.xlsx` ou `.csv`.
2. A primeira linha é interpretada como cabeçalho.
3. São aceitos nomes equivalentes a código (`codigo`, `cod`, `code`, `item`) e descrição (`descricao`, `description`, `nome`).
4. Linhas sem código ou descrição são ignoradas.
5. A importação desvincula os itens antigos das solicitações, apaga o catálogo anterior e insere os novos itens dentro de uma transação.

Importante: cada importação substitui integralmente o catálogo existente.

### 6.6 Histórico e notificações

O histórico permite pesquisar por protocolo, item ou centro de custo e filtrar por status, tipo e período. Cada registro pode ser expandido para exibir quantidade, centro de custo, justificativa e resposta da coordenação.

Quando a coordenação analisa uma solicitação, o professor recebe uma notificação. É possível marcar uma notificação ou todas como lidas.

## 7. Estados da solicitação

| Status | Significado | Origem típica |
|---|---|---|
| `aguardando_coordenacao` | Item existente aguardando análise | Nova solicitação de catálogo |
| `novo_item_pendente` | Sugestão de produto aguardando análise | Nova solicitação de item novo |
| `aprovada` | Compra aceita pela coordenação | Decisão da coordenação |
| `recusada` | Compra negada | Decisão da coordenação |
| `ajuste_solicitado` | Professor deve ajustar ou esclarecer | Decisão da coordenação |

No estado atual não existe uma rota para o professor editar e reenviar uma solicitação marcada como `ajuste_solicitado`.

## 8. Modelo de dados

```mermaid
erDiagram
    users ||--o{ purchase_requests : cria
    users ||--o{ notifications : recebe
    cost_centers ||--o{ catalog_items : classifica
    cost_centers ||--o{ purchase_requests : financia
    catalog_items ||--o{ purchase_requests : referencia
    purchase_requests ||--o{ request_attachments : possui

    users {
      int id PK
      nvarchar name
      nvarchar email UK
      nvarchar password_hash
      varchar role
      datetime2 created_at
    }
    cost_centers {
      int id PK
      nvarchar code UK
      nvarchar name
    }
    catalog_items {
      int id PK
      nvarchar code UK
      nvarchar description
      int cost_center_id FK
      nvarchar source
      datetime2 created_at
    }
    purchase_requests {
      int id PK
      int professor_id FK
      int catalog_item_id FK
      int cost_center_id FK
      varchar item_type
      int quantity
      nvarchar justification
      nvarchar new_item_name
      nvarchar new_item_description
      nvarchar supplier_link
      varchar status
      nvarchar coordinator_response
      datetime2 created_at
      datetime2 updated_at
    }
    request_attachments {
      int id PK
      int request_id FK
      varchar kind
      nvarchar original_name
      nvarchar stored_path
      datetime2 created_at
    }
    notifications {
      int id PK
      int user_id FK
      nvarchar title
      nvarchar message
      datetime2 read_at
      datetime2 created_at
    }
```

Centros de custo iniciais:

- `CC-ADM` — Administrativo;
- `CC-LAB` — Laboratórios;
- `CC-DOC` — Docência.

## 9. API HTTP

Todas as rotas, exceto saúde e login, exigem JWT.

| Método | Rota | Perfil | Finalidade |
|---|---|---|---|
| GET | `/api/health` | Público | Verificar se a API está ativa |
| POST | `/api/auth/login` | Público | Autenticar e emitir JWT |
| GET | `/api/me` | Autenticado | Retornar o usuário do token |
| GET | `/api/cost-centers` | Autenticado | Listar centros de custo |
| GET | `/api/catalog?search=` | Autenticado | Pesquisar até 40 itens |
| POST | `/api/catalog/import` | Coordenação | Substituir catálogo via XLSX/CSV |
| GET | `/api/requests` | Autenticado | Listar próprias solicitações ou todas |
| POST | `/api/requests/catalog` | Professor | Solicitar item do catálogo |
| POST | `/api/requests/new-item` | Professor | Solicitar item novo com anexos |
| PATCH | `/api/requests/:id/review` | Coordenação | Registrar decisão e resposta |
| GET | `/api/notifications` | Autenticado | Listar notificações próprias |
| PATCH | `/api/notifications/read-all` | Autenticado | Marcar todas como lidas |
| PATCH | `/api/notifications/:id/read` | Autenticado | Marcar uma como lida |

## 10. Inicialização do banco

Ao iniciar, o backend:

1. conecta ao banco `master`;
2. cria `compras_senai` se ele não existir;
3. conecta ao novo banco;
4. cria as seis tabelas ausentes;
5. insere os dois usuários de demonstração se não houver usuários;
6. insere os três centros de custo se não houver centros cadastrados;
7. inicia a API somente depois que o banco estiver pronto.

Não existe ferramenta de migrations versionadas. O código atual somente cria estruturas ausentes; ele não altera automaticamente tabelas antigas quando o esquema muda.

## 11. Configuração

Valores padrão do backend:

```dotenv
PORT=3333
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/compras_senai
DB_SSL=false
JWT_SECRET=troque-este-segredo-em-producao
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

O arquivo `backend/.env` e opcional se o PostgreSQL local estiver nos padroes do codigo. Em producao, `JWT_SECRET` deve obrigatoriamente ser substituido por um segredo forte. No Render, o Blueprint gera esse segredo automaticamente.

O frontend usa `VITE_API_URL` quando definido. Sem essa variável, monta automaticamente `http://<hostname-do-navegador>:3333/api`.

Durante o desenvolvimento, o backend aceita origens localhost e endereços de redes privadas `10.x`, `172.16-31.x` e `192.168.x`. Em produção, somente as origens configuradas são aceitas.

## 12. Como executar

Na raiz do projeto:

```powershell
npm run dev
```

Esse comando inicia simultaneamente:

- `tsx watch src/server.ts` no backend;
- `vite` no frontend.

Na primeira instalação de uma cópia nova:

```powershell
npm install
npm install --prefix backend
npm install --prefix frontend
```

Outros comandos:

```powershell
npm run build
npm run lint --prefix frontend
npm start
```

`npm start` inicia apenas o backend ja compilado. No Render, o frontend e servido como Static Site separado, conforme `render.yaml`.

## 13. Decisões de implementação

- SQL parametrizado é usado nas operações com dados para evitar injeção de SQL.
- Importação de catálogo e revisão de solicitação usam transações.
- Papeis e estados sao limitados por `CHECK constraints` no PostgreSQL.
- Exclusão de uma solicitação apagaria seus anexos no banco por `ON DELETE CASCADE`, embora atualmente não exista rota de exclusão.
- O frontend é uma SPA sem biblioteca de rotas; a navegação ocorre por estado interno (`activeView`).
- A maior parte da interface está concentrada em `frontend/src/App.tsx`.
- A API está concentrada em `backend/src/server.ts`; não há camadas separadas de controller, service e repository.

## 14. Limitações e riscos conhecidos

### Segurança e operação

- O segredo JWT padrão é apenas para desenvolvimento.
- As contas demonstrativas têm senhas conhecidas e não devem ser usadas em produção.
- Não há recuperação de senha, criação de usuários ou integração com identidade corporativa.
- Não há limitação de tentativas de login, auditoria ou registro estruturado de eventos.
- Os uploads não têm limite explícito de tamanho nem validação forte de conteúdo/MIME.

### Funcionalidade

- Não há edição ou reenvio após `ajuste_solicitado`.
- Não há exclusão/cancelamento de solicitação.
- Não há tela ou endpoint para baixar os anexos relacionados à solicitação, apesar de os arquivos serem armazenados.
- A coordenação vê pedidos já analisados junto com os pendentes; a fila não possui filtro próprio.
- As notificações são carregadas ao abrir a sessão, sem atualização automática por polling ou tempo real.
- O catálogo não tem CRUD individual; somente importação que substitui todos os itens.
- Não há paginação nas solicitações nem nas notificações.
- O protocolo é derivado no frontend e não é um campo persistido no banco.

### Engenharia

- Não há testes automatizados.
- Não há migrations versionadas.
- Não há documentação OpenAPI/Swagger.
- Não há pipeline de CI/CD.
- Frontend e backend têm arquivos centrais grandes, o que dificultará manutenção conforme o produto crescer.
- Arquivos temporários da importação permanecem em `backend/uploads`.
- O salvamento dos anexos ocorre depois da criação da solicitação e fora de uma transação única.
- A documentação e a interface devem ser revisadas quanto à codificação UTF-8 caso caracteres acentuados apareçam corrompidos no navegador ou terminal.

## 15. Próximas evoluções recomendadas

Ordem sugerida para transformar o MVP em uma aplicação institucional:

1. trocar contas demo por gestão de usuários ou autenticação corporativa;
2. configurar um `JWT_SECRET` seguro e políticas de segurança para upload/login;
3. criar migrations e testes automatizados dos fluxos críticos;
4. implementar edição/reenvio de pedidos com ajuste solicitado;
5. expor anexos com autorização e permitir download pela coordenação;
6. adicionar filtros e paginação à fila da coordenação;
7. separar frontend em páginas/componentes e backend em rotas/serviços/repositórios;
8. adicionar logs de auditoria e histórico de mudanças de status;
9. definir estrategia de backup do PostgreSQL e dos arquivos de upload;
10. acompanhar o deploy no Render e ajustar URLs publicas caso os slugs mudem.

## 16. Critérios básicos de aceite do MVP

- PostgreSQL esta ativo e acessivel pela `DATABASE_URL`.
- `GET /api/health` responde `{ "ok": true }`.
- As duas contas de demonstração conseguem entrar.
- Professor consegue consultar catálogo e enviar os dois tipos de solicitação.
- Coordenação consegue importar uma planilha e analisar solicitações.
- Professor consegue visualizar o resultado e marcar notificações como lidas.
- `npm run build` e o lint do frontend terminam sem erros.

## 17. Referências rápidas para manutenção

- Alterar telas ou comportamento visual: `frontend/src/App.tsx` e `frontend/src/App.css`.
- Alterar endpoints ou regras do fluxo: `backend/src/server.ts`.
- Alterar banco, tabelas ou dados iniciais: `backend/src/db.ts`.
- Alterar autenticação e perfis: `backend/src/auth.ts`.
- Alterar validações de formulário/fornecedor: `backend/src/validators.ts`.
- Alterar conexão local: `backend/.env` com base em `backend/.env.example`.
- Consultar instruções de uso: `README.md`.
