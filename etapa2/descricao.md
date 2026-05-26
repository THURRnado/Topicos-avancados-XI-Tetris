# Etapa 2 — Velocidade por nível e placar de recordes

## O que é

Continuação direta da Etapa 1. O jogo mantém toda a base funcional do Tetris clássico e acrescenta duas mecânicas novas: aceleração progressiva mais agressiva conforme o nível sobe, e persistência do maior score já obtido entre sessões.

---

## Estrutura de arquivos

```
etapa2/
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

| Tecla      | Ação                       |
|------------|----------------------------|
| ← →        | Mover peça                 |
| ↑          | Rotacionar                 |
| ↓          | Descer mais rápido (+1 pt) |
| Espaço     | Queda instantânea (hard drop) |
| P          | Pausar / continuar         |
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
| Persistência do recorde | `loadHighScore` / `saveHighScore` via `localStorage` |

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

---

## Velocidade por nível

| Nível | Intervalo de queda |
|-------|--------------------|
| 1     | 800 ms             |
| 2     | 680 ms             |
| 3     | 560 ms             |
| 4     | 450 ms             |
| 5     | 350 ms             |
| 6     | 260 ms             |
| 7     | 190 ms             |
| 8     | 130 ms             |
| 9     | 90 ms              |
| 10    | 65 ms              |
| 11    | 50 ms              |
| 12    | 40 ms              |
| 13+   | 30 ms              |

A tabela foi estendida de 10 para 13 entradas e a curva de desaceleração foi tornada mais agressiva, de forma que a diferença de velocidade entre níveis adjacentes seja perceptível desde o nível 1.

---

## Modificações em relação à Etapa 1

### Adicionado

- **Recorde persistente** (`highScore` no estado + `localStorage`): o maior score obtido em qualquer sessão é salvo no navegador e exibido em dourado no painel esquerdo, acima da pontuação atual. Ao reiniciar, o recorde é mantido.
- **Banner "NÍVEL UP!"** (`drawLevelUpBanner`): quando o nível sobe, um texto em dourado aparece sobre o canvas do tabuleiro e desvanece em 1,4 s.
- **Flash do contador de nível** (animação CSS `levelFlash`): o número do nível pulsa em dourado e aumenta brevemente de tamanho ao subir, reforçando o feedback visual sem depender do canvas.
- **Indicador de novo recorde no overlay**: ao terminar a partida, o overlay exibe "★ NOVO RECORDE: N ★" (em dourado) se o jogador superou o maior score, ou "Recorde: N" caso contrário.
- **Funções `loadHighScore` e `saveHighScore`**: encapsulam o acesso ao `localStorage`, mantendo a lógica de persistência isolada do restante do código.
- **`triggerLevelFlash`**: dispara a animação CSS no elemento `#level` forçando refluxo para reiniciar a animação corretamente a cada subida de nível.

### Modificado

- **`LEVEL_SPEEDS`**: tabela ampliada de 10 para 13 entradas (nível 13+ = 30 ms), com curva de desaceleração mais agressiva para tornar a progressão de velocidade claramente perceptível desde o início.
- **`lockCurrent`**: passa a detectar mudança de nível (`oldLevel` vs. `s.level`) para acionar o banner e o flash, e atualiza o recorde ao vivo sempre que a pontuação corrente o supera.
- **`gameLoop`**: decrementa `state.levelUpTimer` a cada frame e chama `showGameOver` em vez de `showOverlay` diretamente.
- **`showOverlay`**: recebe agora um terceiro parâmetro opcional (`record`) e exibe/oculta o elemento `#overlay-record` conforme necessário.
- **`restartGame`**: preserva o maior recorde entre `state.highScore` e o valor em `localStorage` antes de resetar o estado.
- **`render`**: atualiza também o elemento `#high-score` e chama `drawLevelUpBanner`.

### Removido

- Nenhum comportamento ou funcionalidade da Etapa 1 foi removido.
