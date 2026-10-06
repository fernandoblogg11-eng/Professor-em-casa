# Professor em Casa (Etapa 1: estrutura funcional, sem IA)

Node.js + Express, PostgreSQL/Supabase, JWT. O front (`public/`) é servido pelo próprio Express.

## Rodar
1. Crie um projeto no Supabase e execute `schema.sql` no SQL Editor.
2. `cp .env.example .env` e preencha `DATABASE_URL` (Settings > Database) e `JWT_SECRET` (32+ caracteres aleatórios).
3. `npm install && npm start` e abra http://localhost:3000

## API
| Método | Rota | Função |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | cadastro e login |
| GET/PUT | /api/auth/me | perfil da família |
| GET/POST/PUT/DELETE | /api/children(/:id) | crianças + perfil pedagógico |
| GET | /api/tutor/sessions | sessões da família |
| POST | /api/tutor/session | criar sessão |
| POST | /api/tutor/message | enviar mensagem |
| GET | /api/tutor/session/:id | consultar sessão e mensagens |
| PUT | /api/tutor/session/:id/end | encerrar sessão |
| GET | /api/tutor/progress | sessões e minutos por matéria/assunto |
| PUT | /api/auth/password | alterar senha |

## Segurança por família
- O `family_id` vem do JWT assinado, nunca do cliente.
- Toda consulta filtra por `family_id`; ids de outra família retornam 404.
- No banco, chaves compostas `(id, family_id)` impedem sessão/mensagem ligada a criança de outra família.
- Senhas com bcrypt; limite de tentativas em `/api/auth`; RLS ligado nas tabelas (bloqueia a API pública do Supabase).

## IA
- `services/socraticTutor.js`: regras pedagógicas e prompt (só no backend).
- `services/aiTutor.js`: chamada ao modelo. Configure `AI_PROVIDER` (`anthropic` ou `openai`, este último serve para APIs compatíveis), `AI_API_KEY` e `AI_MODEL` no `.env` / variáveis da Vercel.
- Se a IA falhar ou não estiver configurada, a mensagem da criança continua salva, o erro vai para o log do servidor e a criança vê um aviso amigável.
- `GET /health` retorna `{"status":"OK"}`.

## Publicar de graça (GitHub + Supabase + Vercel)
1. **Supabase:** crie o projeto, rode `schema.sql`. Em *Connect > Transaction pooler* copie a string (porta 6543) para `DATABASE_URL`.
2. **GitHub:** crie um repositório e envie a pasta (o `.env` já está no `.gitignore`).
3. **Vercel:** *Add New > Project*, importe o repositório e, em *Environment Variables*, defina `DATABASE_URL` e `JWT_SECRET`. Clique em Deploy.
