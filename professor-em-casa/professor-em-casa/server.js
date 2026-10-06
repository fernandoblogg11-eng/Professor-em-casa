require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // Vercel
app.use(helmet());
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => res.json({ status: 'OK' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos.' } }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/children', require('./routes/children'));
app.use('/api/tutor', require('./routes/tutor'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  if (err.code === '22P02') return res.status(404).json({ error: 'Não encontrado.' }); // uuid inválido
  console.error(err);
  res.status(500).json({ error: 'Erro interno. Tente novamente.' });
});

if (require.main === module) app.listen(process.env.PORT || 3000, () => console.log('Rodando em http://localhost:' + (process.env.PORT || 3000)));
module.exports = app;
