# Compras SENAI

MVP em TypeScript para solicitacao de compras com dois perfis: professor e coordenacao.

## Requisitos

- Node.js
- Docker Desktop

## Como rodar

1. Suba o MySQL:

```bash
docker compose up -d
```

2. Crie o arquivo `backend/.env` com base em `backend/.env.example`.

Se abrir o frontend por IP da rede, adicione a origem em `CORS_ORIGINS`, separada por virgula. Exemplo:

```bash
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://192.168.0.10:5173
```

O frontend usa `http://<host-atual>:3333/api` automaticamente quando `VITE_API_URL` nao estiver definido. Para fixar a API manualmente, crie `frontend/.env` com base em `frontend/.env.example`.

3. Rode frontend e backend:

```bash
npm run dev
```

Frontend: http://localhost:5173

API: http://localhost:3333

## Usuarios demo

- Professor: `professor@senai.local` / `professor123`
- Coordenacao: `coordenacao@senai.local` / `coordenacao123`

## Planilha de catalogo

A coordenacao pode importar `.xlsx` ou `.csv`. A primeira aba deve ter colunas com nomes equivalentes a:

- `codigo`
- `descricao`

Cada importacao substitui o catalogo anterior.
