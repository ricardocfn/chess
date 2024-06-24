// models/ChessGame.js

import { Chess } from 'chess.js'; // Importar biblioteca de xadrez

class ChessGame {
  constructor() {
    this.game = new Chess();
  }

  move(from, to, promotion) {
    return this.game.move({ from, to, promotion });
  }

  getGameState() {
    return {
      fen: this.game.fen(),
      history: this.game.history(),
      turn: this.game.turn(),
      inCheck: this.game.in_check(),
      checkmate: this.game.in_checkmate(),
      stalemate: this.game.in_stalemate(),
      gameOver: this.game.game_over(),
      result: this.game.in_draw() ? 'draw' : this.game.turn() === 'w' ? 'white' : 'black',
    };
  }

  static fromFEN(fen) {
    const game = new Chess();
    game.load(fen);
    const chessGame = new ChessGame();
    chessGame.game = game;
    return chessGame;
  }
}

export default ChessGame;
