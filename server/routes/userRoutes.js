import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Função para gerar o token JWT
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

// Rota para criar um novo usuário (POST /signup)
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criação do usuário
    const user = await req.prisma.user.create({ // Use req.prisma
      data: {
        username,
        email,
        password: hashedPassword,
        
      },
    });

    // Geração do token JWT
    const token = generateToken(user.id);

    // Exclui o campo 'password' do objeto user
    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;

    res.status(201).json({ user: userWithoutPassword, token });
  } catch (error) {
    if (error.code === 'P2002') { // Erro de email ou usuário duplicado
      res.status(409).json({ error: 'Email ou nome de usuário já cadastrado' });
    } else {
      console.error(error); // Log do erro no console para depuração
      res.status(500).json({ error: 'Erro ao criar usuário' });
    }
  }
});

// Rota para login (POST /login)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await req.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = generateToken(user.id);

    // Exclui o campo 'password' do objeto user
    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;

    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Rota para atualizar informações do usuário (PUT /users/:id) - Precisa de autenticação JWT
router.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    console.log("ID do usuário no token:", req.user.userId);

    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'Você não tem permissão para editar este usuário' });
    }

    // Exclui o campo 'password' do corpo da requisição, se existir
    if (req.body.password) {
      delete req.body.password; 
    }

    const updatedUser = await req.prisma.user.update({
      where: { id: userId },
      data: req.body, // Dados a serem atualizados
    });
    
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Rota para deletar um usuário (DELETE /users/:id) - Precisa de autenticação JWT
router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'Você não tem permissão para deletar este usuário' });
    }

    await req.prisma.user.delete({
      where: { id: userId },
    });

    res.json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar usuário' });
  }
});

// Middleware de autenticação (para rotas que exigem login)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.sendStatus(401); // Unauthorized
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403); // Forbidden
    }
    req.user = user;
    next();
  });
}

export default router;
