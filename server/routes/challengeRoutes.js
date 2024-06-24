import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { Chess } from 'chess.js'; // Importar biblioteca de xadrez

const prisma = new PrismaClient();
const router = express.Router();

// Simulação de armazenamento de socketIds (substituir por lógica real posteriormente)
const connectedUsers = {
  1: 'socket_id_usuario_1', // Substitua pelos IDs reais dos seus usuários
  2: 'socket_id_usuario_2',
};

// Armazenamento dos estados dos jogos
const games = {};

// Rota para criar um novo desafio (POST /challenges)
router.post('/', async (req, res) => {
  try {
    const { opponentId, stake } = req.body;
    const challengerId = req.user.userId; // Corrigido para userId

    // Verifique se o desafiante e o oponente são diferentes
    if (challengerId === opponentId) {
      return res.status(400).json({ error: 'Você não pode desafiar a si mesmo' });
    }

    // Verifique se a aposta é maior que zero
    if (stake <= 0) {
      return res.status(400).json({ error: 'A aposta deve ser maior que zero' });
    }

    // Verifique se o usuário tem saldo suficiente para a aposta
    const user = await prisma.user.findUnique({ where: { id: challengerId } });
    if (!user || user.balance < stake) {
      return res.status(400).json({ error: 'Saldo insuficiente ou usuário não encontrado' });
    }

    // Crie o desafio no banco de dados
    const challenge = await prisma.challenge.create({
      data: {
        challengerId,
        opponentId,
        stake,
      },
    });

    // Deduzir a aposta do saldo do desafiante e do oponente
    await prisma.user.update({
      where: { id: challengerId },
      data: {
        balance: {
          decrement: stake,
        },
      },
    });

    await prisma.user.update({
      where: { id: opponentId },
      data: {
        balance: {
          decrement: stake,
        },
      },
    });

    // Simulação de obtenção do socketId do oponente
    const opponentSocketId = connectedUsers[opponentId];

    if (opponentSocketId) {
      io.to(opponentSocketId).emit('new_challenge', challenge);
    } else {
      // Lógica para lidar com o caso em que o oponente não está online
      // Você pode armazenar o desafio em uma fila para ser enviado quando o oponente se conectar
    }

    res.status(201).json(challenge);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar desafio' });
  }
});

// Rota para aceitar um desafio (POST /challenges/:id/accept)
router.post('/:id/accept', async (req, res) => {
  try {
    const challengeId = parseInt(req.params.id);
    const userId = req.user.userId;

    // Verifique se o desafio existe
    let challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        challenger: true,
        opponent: true,
      },
    });

    if (!challenge) {
      return res.status(404).json({ error: 'Desafio não encontrado' });
    }

    // Verifique se o desafio está pendente
    if (challenge.status !== 'PENDING') {
      return res.status(403).json({ error: 'O desafio não está pendente para aceitação' });
    }

    // Verifique se o usuário é o oponente convidado
    if (challenge.opponentId !== userId) {
      return res.status(403).json({ error: 'Você não pode aceitar este desafio' });
    }

    // Verifique se o oponente tem saldo suficiente para aceitar o desafio
    const opponent = await prisma.user.findUnique({ where: { id: userId } });
    if (!opponent || opponent.balance < challenge.stake) {
      return res.status(400).json({ error: 'Saldo insuficiente para aceitar o desafio' });
    }

    // Atualize o status do desafio para 'ACCEPTED' e gere um gameId
    challenge = await prisma.challenge.update({
      where: { id: challengeId },
      data: { 
        status: 'ACCEPTED',
        gameId: uuidv4(),
      },
      include: {
        challenger: true,
        opponent: true,
      },
    });

    // Notificação via Socket.IO (lógica de simulação)
    const challengerSocketId = connectedUsers[challenge.challengerId];
    if (challengerSocketId) {
      io.to(challengerSocketId).emit('challenge_accepted', challenge);
    }

    res.json(challenge);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao aceitar desafio' });
  }
});

// Rota para iniciar uma partida (POST /challenges/:id/start)
router.post('/:id/start', async (req, res) => {
  try {
    const challengeId = parseInt(req.params.id);
    const userId = req.user.userId;

    // Verifique se o desafio existe e se o usuário é um dos participantes
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        challenger: true,
        opponent: true,
      },
    });

    if (!challenge || (challenge.challengerId !== userId && challenge.opponentId !== userId)) {
      return res.status(404).json({ error: 'Desafio não encontrado ou usuário não autorizado' });
    }

    // Verifique se o status do desafio é ACCEPTED
    if (challenge.status !== 'ACCEPTED') {
      return res.status(403).json({ error: 'O desafio não está aceito para iniciar' });
    }

    // Atualize o status do desafio para IN_PROGRESS
    await prisma.challenge.update({
      where: { id: challengeId },
      data: { status: 'IN_PROGRESS' },
    });

    // Criar uma nova instância do jogo de xadrez
    const game = new Chess();
    games[challenge.gameId] = game;

    res.json({ message: 'Partida iniciada', gameId: challenge.gameId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao iniciar partida' });
  }
});

export default router;
