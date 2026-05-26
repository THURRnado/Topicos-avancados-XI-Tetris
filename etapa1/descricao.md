# Etapa 1 — Tetris base em HTML/CSS/JavaScript

## O que é

Implementação funcional do jogo Tetris utilizando apenas tecnologias nativas do navegador: HTML5, CSS3 e JavaScript puro (sem frameworks ou bibliotecas externas). O objetivo desta etapa é estabelecer uma base sólida e bem organizada sobre a qual novas funcionalidades podem ser acrescentadas nas etapas seguintes.

---

## Estrutura de arquivos

```
etapa1/
├── index.html   — marcação da página: canvas do tabuleiro, canvas da próxima peça e HUD
├── style.css    — visual escuro inspirado nos arcades clássicos
├── tetris.js    — toda a lógica do jogo
└── descricao.md — este arquivo
```

---

## Como executar

Abra `index.html` diretamente em qualquer navegador moderno. Não é necessário servidor web, instalação ou build.

---

## Controles

| Tecla      | Ação                     |
|------------|--------------------------|
| ← →        | Mover peça               |
| ↑          | Rotacionar               |
| ↓          | Descer mais rápido (+1 pt) |
| Espaço     | Queda instantânea (hard drop) |
| P          | Pausar / continuar       |
| Enter      | Reiniciar (após game over) |

---

## Como o código funciona

### Representação das peças (`PIECES`)

Cada uma das 7 peças do Tetris (I, O, T, S, Z, J, L) é descrita como uma matriz 2-D de 0s e 1s no estado inicial. A função `rotateMatrix` gira essa matriz 90° no sentido horário sempre que o jogador pressiona ↑.

### Tabuleiro (`board`)

O tabuleiro é um array `ROWS × COLS` (20 × 10). Células vazias guardam `null`; células preenchidas guardam a string de cor da peça que as bloqueou. Essa separação torna trivial saber a cor de cada célula no momento de renderizar.

### Verificação de posição (`isValidPosition`)

Antes de qualquer movimento ou rotação, a função percorre a matriz da peça ativa e verifica se cada célula preenchida:
- está dentro dos limites horizontais do tabuleiro;
- não ultrapassou o fundo;
- não colide com uma célula já bloqueada no `board`.

### Bloqueio e limpeza de linhas (`lockPiece`)

Quando uma peça não consegue mais descer, ela é "cravada" no `board`. Em seguida, todas as linhas completamente preenchidas são removidas e novas linhas vazias são inseridas no topo. O número de linhas eliminadas de uma vez determina o bônus de pontuação (Tetris scoring clássico: 100 / 300 / 500 / 800 × nível).

### Ghost piece

A função `ghostRow` simula a descida máxima da peça ativa sem alterar o estado. O resultado é desenhado com 20 % de opacidade para guiar o jogador.

### Loop principal (`gameLoop`)

Usa `requestAnimationFrame` para rodar a ~60 fps. Um acumulador de tempo (`dropAccumulator`) controla quando a peça deve descer automaticamente; o intervalo diminui conforme o nível aumenta (definido em `LEVEL_SPEEDS`).

### Separação de responsabilidades

| Área | Onde fica |
|------|-----------|
| Constantes e dados das peças | Topo de `tetris.js` |
| Lógica do tabuleiro | Funções puras (`createBoard`, `lockPiece`, `isValidPosition`) |
| Lógica de peças e movimentos | Funções puras (`createPiece`, `tryMove`, `tryRotate`, `hardDrop`) |
| Renderização | Funções `draw*` que só lêem o estado |
| Estado mutável do jogo | Objeto `state` único |
| Loop e entradas | `gameLoop` + listener de `keydown` |

Essa separação facilita a adição de funcionalidades como: sons, efeitos de linha, ranking, múltiplos jogadores, temas visuais, modo sprint, etc.

---

## Pontuação

| Linhas eliminadas | Pontos (× nível) |
|-------------------|------------------|
| 1 (Single)        | 100              |
| 2 (Double)        | 300              |
| 3 (Triple)        | 500              |
| 4 (Tetris)        | 800              |
| Hard drop         | +2 por célula    |
| Soft drop (↓)     | +1 por célula    |

O nível sobe a cada 10 linhas eliminadas, aumentando a velocidade de queda.
