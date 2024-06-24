import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import http from 'http';
import { authenticateToken } from './middlewares/auth.js'; // Atualizado
import userRoutes from './routes/userRoutes.js';
import challengeRoutes from './routes/challengeRoutes.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Middleware para disponibilizar o Prisma Client para as rotas
app.use(async (req, res, next) => {
  req.prisma = prisma;
  next();
});

// Configuração das rotas antes de inicializar o servidor
app.use('/api', userRoutes);
app.use('/api/challenges', authenticateToken, challengeRoutes);

// Rota de exemplo
app.get('/', (req, res) => {
  res.send('Bem-vindo ao XadrezRaiz!');
});

// Crie o servidor HTTP usando http.createServer
const server = http.createServer(app);

// Configuração do Socket.IO
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log(`Usuário conectado: ${socket.id}`);
  // Adicione lógica para gerenciar usuários conectados
});

// Inicie o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
