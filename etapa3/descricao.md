# Etapa 3 — Tela de abertura e modo demonstração (attract mode)

## O que é

Continuação direta da Etapa 2. O jogo mantém toda a base funcional do Tetris clássico com velocidade por nível e placar de recordes, e acrescenta uma tela de abertura que antecede a partida. Se o jogador ficar inativo por 10 segundos nessa tela, o jogo entra no **modo demonstração** (attract mode): uma partida controlada por IA é executada automaticamente como vitrine. Qualquer interação do usuário encerra o modo demonstração e retorna à tela de abertura.

---

## Estrutura de arquivos

```
etapa3/
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

| Tecla          | Ação                          |
|----------------|-------------------------------|
| Qualquer tecla | Iniciar / sair do attract mode |
| ← →            | Mover peça                    |
| ↑              | Rotacionar                    |
| ↓              | Descer mais rápido (+1 pt)    |
| Espaço         | Queda instantânea (hard drop) |
| P              | Pausar / continuar            |
| Enter          | Reiniciar (após game over)    |

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

Usa `requestAnimationFrame` para rodar a ~60 fps. O comportamento do loop é determinado por `state.phase`:

| Fase        | Comportamento                                          |
|-------------|--------------------------------------------------------|
| `'title'`   | Desenha a tela de abertura; incrementa `attractTimer`  |
| `'attract'` | Executa o jogo com IA; desenha o banner de demonstração |
| `'playing'` | Executa o jogo com controle do jogador                 |

Um acumulador de tempo (`dropAccumulator`) controla quando a peça deve descer automaticamente; o intervalo diminui conforme o nível aumenta (definido em `LEVEL_SPEEDS`).

### Tela de abertura (`drawTitleScreen`)

Desenhada diretamente sobre o canvas do tabuleiro a cada frame enquanto `phase === 'title'`. Exibe o título em vermelho, o recorde atual em dourado, uma lista de controles e um texto piscante "PRESSIONE QUALQUER TECLA PARA INICIAR". Uma barra vermelha na base do canvas cresce progressivamente até o final da contagem de 10 s, indicando quando o attract mode está prestes a começar.

### Attract mode

Após `ATTRACT_DELAY` (10 000 ms) sem interação na tela de abertura, `startAttract()` é chamado: o estado é resetado, `phase` passa a `'attract'` e o loop começa a rodar o jogo normalmente, mas com a IA no controle. Um banner semitransparente no topo do canvas exibe "MODO DEMONSTRAÇÃO" e instrui o usuário. Ao terminar (game over), o attract mode reinicia automaticamente.

### IA do attract mode (`aiFindBestMove`)

A cada peça nova a IA avalia todas as combinações de rotação e coluna possíveis usando a heurística de Dellacherie, que pondera:

| Fator            | Peso     |
|------------------|----------|
| Altura agregada  | −0,510   |
| Linhas limpas    | +0,761   |
| Buracos          | −0,357   |
| Irregularidade   | −0,184   |

O alvo `{ col, matrix }` é armazenado em `state.aiTarget`. A cada `AI_MOVE_INTERVAL` (100 ms), `aiStep` aplica uma rotação ou um passo horizontal em direção ao alvo; a gravidade cuida da descida.

### Separação de responsabilidades

| Área | Onde fica |
|------|-----------|
| Constantes e dados das peças | Topo de `tetris.js` |
| Lógica do tabuleiro | Funções puras (`createBoard`, `lockPiece`, `isValidPosition`) |
| Lógica de peças e movimentos | Funções puras (`createPiece`, `tryMove`, `tryRotate`, `hardDrop`) |
| IA do attract mode | `aiGetRotations`, `aiEvaluateBoard`, `aiFindBestMove`, `aiStep` |
| Renderização | Funções `draw*` que só lêem o estado |
| Estado mutável do jogo | Objeto `state` único |
| Loop e entradas | `gameLoop` + listeners de `keydown`, `click`, `touchstart` |
| Transições de fase | `startGame`, `startAttract`, `backToTitle`, `restartGame` |
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

---

## Modificações adicionais — Redirecionamento ao game over

### O que mudou

Ao final de uma partida (`state.over === true`), o jogo agora retorna automaticamente à tela de abertura em vez de exibir um overlay estático aguardando o pressionamento de Enter.

**Fluxo após o game over:**

1. O overlay "GAME OVER" é exibido com o texto "Voltando à tela inicial..." e o recorde (novo recorde destacado quando aplicável).
2. Após `GAME_OVER_REDIRECT_DELAY` (3 000 ms), `backToTitle()` é chamado automaticamente via `setTimeout`.
3. Qualquer tecla pressionada durante os 3 segundos também chama `backToTitle()` imediatamente, cancelando o timeout.

### Detalhes de implementação

| Item | Descrição |
| ---- | --------- |
| `GAME_OVER_REDIRECT_DELAY` | Nova constante (3 000 ms): tempo de exibição do overlay antes do redirecionamento. |
| `gameOverTimeoutId` | Variável de módulo que guarda o ID do `setTimeout`, permitindo cancelamento. |
| `clearGameOverTimeout()` | Função auxiliar que cancela o timeout pendente; chamada em `backToTitle()` e no listener de `keydown`. |
| `showGameOver()` | Atualizada: subtítulo passou de "Pressione Enter para reiniciar" para "Voltando à tela inicial..."; agenda o redirecionamento com `setTimeout`. |
| Listener `keydown` (fase `playing`, `state.over`) | Antes aguardava `Enter` para chamar `restartGame()`; agora qualquer tecla cancela o timeout e chama `backToTitle()`. |
| `backToTitle()` | Chama `clearGameOverTimeout()` no início para evitar redirecionamento duplicado. |
| `index.html` — `#overlay-sub` | Texto padrão atualizado para "Voltando à tela inicial..." para consistência. |

---

## Modificações em relação à Etapa 2

### Adicionado

- **Tela de abertura (`drawTitleScreen`)**: desenhada canvas-a-canvas enquanto `state.phase === 'title'`. Exibe título, recorde, lista de controles, texto piscante "PRESSIONE QUALQUER TECLA PARA INICIAR" e uma barra de progresso vermelha que indica o tempo restante antes do attract mode começar.
- **Attract mode**: quando o jogador fica 10 s inativo na tela de abertura, `startAttract()` inicia uma partida com IA. Um banner semitransparente com "MODO DEMONSTRAÇÃO" é desenhado sobre o canvas a cada frame. Se o jogo terminar em modo demonstração, o attract mode é reiniciado automaticamente.
- **IA do attract mode** (`aiGetRotations`, `aiEvaluateBoard`, `aiFindBestMove`, `aiStep`): determina o melhor posicionamento para cada peça via busca exaustiva com a heurística de Dellacherie. `aiStep` aplica uma ação por intervalo de 100 ms; a descida fica a cargo da gravidade normal do jogo.
- **Campo `phase`** no estado: `'title'` | `'playing'` | `'attract'` — governa o comportamento do `gameLoop`.
- **Campo `attractTimer`**: acumula milissegundos na tela de abertura; ao atingir `ATTRACT_DELAY` (10 000 ms), dispara `startAttract()`.
- **Campos `aiTarget` e `aiMoveAccumulator`**: armazenam o alvo calculado para a peça atual e o tempo desde o último passo da IA, respectivamente.
- **`startGame()`**: inicializa o estado com `phase = 'playing'` e inicia o loop; substitui a inicialização direta que existia na Etapa 2.
- **`startAttract()`**: reinicia o estado com `phase = 'attract'` e inicia o loop.
- **`backToTitle()`**: reinicia o estado com `phase = 'title'` e `attractTimer = 0`, retornando à tela de abertura.
- **Listeners de `click` e `touchstart`**: qualquer clique ou toque do usuário também inicia o jogo (na tela de abertura) ou retorna à tela de abertura (no attract mode), além do `keydown` já existente.
- **Constantes `ATTRACT_DELAY` e `AI_MOVE_INTERVAL`**: centralizam os parâmetros de tempo do attract mode.

### Modificado

- **`initialState`**: adicionados os campos `phase`, `attractTimer`, `aiTarget` e `aiMoveAccumulator`.
- **`gameLoop`**: reestruturado em três ramificações (`title`, `attract`, `playing`) para separar claramente o comportamento de cada fase. O delta de tempo é limitado a 100 ms (`Math.min`) para evitar saltos após suspensão da aba.
- **`lockCurrent`**: adicionado `s.aiTarget = null` após a troca de peça, para que a IA recalcule o alvo para a nova peça.
- **`togglePause`**: guarda verifica `state.phase !== 'playing'` antes de agir, impedindo pausar durante o attract mode ou na tela de abertura.
- **`restartGame`**: passa a definir explicitamente `state.phase = 'playing'` (antes o campo não existia).
- **Listener de `keydown`**: adicionadas as ramificações para `phase === 'title'` (chama `startGame`) e `phase === 'attract'` (chama `backToTitle`) antes da lógica de jogo existente.

### Removido

- Nenhum comportamento ou funcionalidade da Etapa 2 foi removido. A inicialização direta do loop no final do arquivo (`lastTime = performance.now(); animationId = requestAnimationFrame(gameLoop)`) foi mantida — agora ela inicia na fase `'title'`.
