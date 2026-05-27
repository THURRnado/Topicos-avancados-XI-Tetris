# Etapa 4 — Música, efeitos sonoros e efeitos visuais (Game Boy style)

## O que é

Continuação direta da Etapa 3. O jogo mantém todas as funcionalidades anteriores (tela de abertura, attract mode com IA, placar de recordes, velocidade por nível) e acrescenta um sistema completo de áudio sintetizado em tempo real via **Web Audio API**, sem nenhum arquivo de áudio externo. A trilha sonora e os efeitos sonoros reproduzem o estilo do Tetris clássico de Game Boy: ondas quadradas (_square wave_), timbres simples e melodias reconhecíveis.

---

## Estrutura de arquivos

```
etapa4/
├── index.html   — marcação da página: canvas do tabuleiro, canvas da próxima peça e HUD
├── style.css    — visual escuro inspirado nos arcades clássicos
├── tetris.js    — toda a lógica do jogo + motor de áudio
└── descricao.md — este arquivo
```

---

## Como executar

Abra `index.html` diretamente em qualquer navegador moderno. Não é necessário servidor web, instalação ou build.

> **Nota:** O áudio só é inicializado após a primeira interação do usuário (clique, toque ou tecla), conforme exigido pela política de _autoplay_ dos navegadores modernos.

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
| M              | Silenciar / retomar a música  |
| Enter          | Reiniciar (após game over)    |

---

## Como o código funciona

### Representação das peças (`PIECES`)

Cada uma das 7 peças do Tetris (I, O, T, S, Z, J, L) é descrita como uma matriz 2-D de 0s e 1s no estado inicial. A função `rotateMatrix` gira essa matriz 90° no sentido horário sempre que o jogador pressiona ↑.

### Tabuleiro (`board`)

O tabuleiro é um array `ROWS × COLS` (20 × 10). Células vazias guardam `null`; células preenchidas guardam a string de cor da peça que as bloqueou.

### Verificação de posição (`isValidPosition`)

Antes de qualquer movimento ou rotação, a função percorre a matriz da peça ativa e verifica se cada célula preenchida está dentro dos limites horizontais, não ultrapassou o fundo e não colide com células já bloqueadas.

### Bloqueio e limpeza de linhas (`lockPiece`)

Quando uma peça não consegue mais descer, ela é "cravada" no `board`. Linhas completamente preenchidas são removidas e novas linhas vazias inseridas no topo. O número de linhas eliminadas de uma vez determina o bônus de pontuação (Tetris scoring clássico: 100 / 300 / 500 / 800 × nível).

### Ghost piece

A função `ghostRow` simula a descida máxima da peça ativa sem alterar o estado. O resultado é desenhado com 20 % de opacidade para guiar o jogador.

### Loop principal (`gameLoop`)

Usa `requestAnimationFrame` para rodar a ~60 fps. O comportamento do loop é determinado por `state.phase`:

| Fase        | Comportamento                                          |
|-------------|--------------------------------------------------------|
| `'title'`   | Desenha a tela de abertura; incrementa `attractTimer`  |
| `'attract'` | Executa o jogo com IA; desenha o banner de demonstração |
| `'playing'` | Executa o jogo com controle do jogador                 |

### Tela de abertura (`drawTitleScreen`)

Exibe título, recorde, lista de controles (incluindo a tecla M) e texto piscante. Barra vermelha na base indica o tempo restante antes do attract mode.

### Attract mode

Após `ATTRACT_DELAY` (10 000 ms) sem interação, o jogo entra em modo demonstração controlado por IA. Ao terminar (game over), reinicia automaticamente.

### IA do attract mode (`aiFindBestMove`)

Avalia todas as combinações de rotação e coluna usando a heurística de Dellacherie:

| Fator            | Peso     |
|------------------|----------|
| Altura agregada  | −0,510   |
| Linhas limpas    | +0,761   |
| Buracos          | −0,357   |
| Irregularidade   | −0,184   |

---

## Motor de áudio

### Inicialização lazy (`getAudio`)

O `AudioContext` e todos os nós de ganho são criados na **primeira interação do usuário**, respeitando a política de _autoplay_ dos navegadores. Se o navegador não suportar Web Audio API, `getAudio()` retorna `null` e todas as funções de áudio tornam-se no-ops silenciosos.

### Grafo de áudio

```
AudioContext.destination
├── musicGain          ← controlado pela tecla M (silencia só a música)
│   ├── melGain        ← melodia (ganho 0,14)
│   └── bassGain       ← baixo (ganho 0,09)
└── sfxGain            ← efeitos sonoros (ganho 0,28, sempre audível)
```

### Música de fundo — Tetris Theme A (Korobeiniki)

A melodia completa (Parte A + Parte B) está codificada em `MELODY` como pares `[nota, duração em colcheias]` a ~160 BPM (`EIGHTH = 0,1875 s`). Um baixo simples `A2 / E3` alterna em colcheias em `BASS`.

O **escalonador de lookahead** (`scheduleMusicTick`) é chamado a cada 25 ms via `setTimeout` e agenda notas com 150 ms de antecedência usando `AudioContext.currentTime`, técnica padrão para áudio sem jitter. Cada nota é um `OscillatorNode` do tipo `square` (onda quadrada, timbre Game Boy) ligado a um `GainNode` com envelope de decaimento exponencial.

A música começa do início ao entrar em `playing` ou `attract`, pausa junto com o jogo (tecla P) e para completamente ao retornar à tela de título ou ao ocorrer game over.

### Efeitos sonoros

| Função         | Evento disparador              | Descrição sonora                         |
|----------------|-------------------------------|------------------------------------------|
| `sfxMove()`    | Movimento lateral bem-sucedido | Blip curto e grave (220 Hz, 40 ms)       |
| `sfxRotate()`  | Rotação bem-sucedida           | Dois blips ascendentes (440 → 554 Hz)    |
| `sfxHardDrop()`| Queda instantânea (Espaço)     | Varredura descendente 280 → 55 Hz, 120 ms |
| `sfxLock()`    | Peça bloqueada sem linhas      | Surdo grave (140 Hz, 90 ms)              |
| `sfxLineClear(n)` | 1–3 linhas eliminadas       | Arpejo ascendente de n+1 notas           |
| `sfxLineClear(4)` | Tetris (4 linhas)           | Arpejo completo + nota sustentada (fanfarra) |
| `sfxLevelUp()` | Subida de nível                | Escala ascendente de 5 notas             |
| `sfxGameOver()`| Fim de jogo                    | Descida cromática de 8 notas (440→247 Hz)|

Todos os efeitos verificam `state.phase !== 'playing'` antes de executar, portanto **o attract mode é silencioso em termos de SFX** (apenas a música toca durante a IA).

### Silenciar música (`toggleMute` / tecla M)

Altera `musicGain.gain.value` entre 0 e 1. Como o `sfxGain` se conecta diretamente ao `destination` (fora do `musicGain`), os efeitos sonoros permanecem audíveis mesmo com a música silenciada. O indicador "MÚSICA ON/OFF" na sidebar direita reflete o estado atual.

---

## Separação de responsabilidades

| Área | Onde fica |
|------|-----------|
| Constantes e dados das peças | Topo de `tetris.js` |
| Motor de áudio | Seção `Audio Engine` em `tetris.js` |
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

## Efeitos visuais

### Flash de limpeza de linha (`drawLineClearEffect`)

Ao completar uma ou mais linhas, o jogo entra em uma animação de dois tempos:

1. **Congelamento** — a peça é travada no tabuleiro e as linhas completas ficam visíveis por 350 ms antes de desaparecerem. Durante esse período nenhuma nova peça é spawnada e as queda automática é pausada.
2. **Flash** — as linhas completas piscam em **branco** (1–3 linhas) ou **ciano brilhante** (`#80ffff`, 4 linhas / Tetris). A intensidade segue uma curva senoidal (bell-curve) que vai de 0, atinge o pico no meio do timer e volta a 0, dando a sensação de brilho e apagamento suaves.

Implementação:

- `lockPiece()` passa a retornar `lockedBoard` (snapshot com a peça travada, linhas intactas) e `clearedRows` (índices das linhas completas).
- `lockCurrent()`: quando há linhas limpas, armazena `s.lineClearAnim = { displayBoard: lockedBoard, rows: clearedRows, timer: 350 }` e retorna sem spawnar a próxima peça.
- `spawnNext(s)`: nova função que encapsula a lógica de spawn + verificação de game over (antes embutida em `lockCurrent`).
- No `gameLoop` (fases `playing` e `attract`): enquanto `lineClearAnim.timer > 0`, o loop renderiza `displayBoard` em vez do `state.board` e chama `drawLineClearEffect`; quando o timer expira, chama `spawnNext`.

### Brilho de subida de nível (`drawLevelUpBanner`)

A função existente ganhou uma **borda dourada pulsante** ao redor do canvas do tabuleiro durante todo o período `LEVEL_UP_DURATION` (1 400 ms):

- A borda (`#f0c040`, 8 px) é desenhada com `strokeRect` no canvas a cada frame.
- A opacidade oscila com `Math.sin(Date.now() / 70)`, criando um pulso visual rápido.
- O alpha total diminui gradativamente conforme o timer se esgota (`fadeAlpha = min(1, t × 3)`), fundindo-se com o fundo nos últimos 33 % do timer.
- O texto "NÍVEL UP!" no centro do canvas permanece inalterado.
- O flash amarelo no elemento `#level` da sidebar (CSS `@keyframes levelFlash`) continua existindo em paralelo.

### Animação de game over (`drawGameOverWave`)

Ao detectar game over, em vez de exibir o overlay HTML imediatamente, o jogo:

1. Para a música e toca `sfxGameOver()` no mesmo frame em que `state.over` é detectado.
2. Executa uma animação de **onda cinza** de 1 200 ms que preenche o tabuleiro de **baixo para cima**, linha por linha:
   - Cada linha preenchida recebe um retângulo `#2a2a2a` com 80 % de opacidade.
   - Uma linha de 2 px em `#cccccc` marca a borda líder da onda.
3. Somente após o fim da animação o overlay HTML ("GAME OVER / Voltando à tela inicial…") é exibido e o timeout de redirecionamento é iniciado.

Flags de controle adicionadas ao estado: `gameOverStarted`, `gameOverAnimTimer`, `gameOverShown`.

---

## Modificações em relação à Etapa 3

### Adicionado

- **Motor de áudio completo** (`Audio Engine` em `tetris.js`): implementado inteiramente com Web Audio API, sem arquivos externos. Sintetiza sons via `OscillatorNode` do tipo `square` (timbre Game Boy).
- **`NOTE_FREQ`**: tabela de frequências em Hz para todas as notas usadas.
- **`MELODY`**: sequência completa do Tetris Theme A (Korobeiniki), Parte A + Parte B, em colcheias a ~160 BPM.
- **`BASS`**: padrão de baixo A2/E3 alternado em colcheias, repetido em loop durante toda a música.
- **`EIGHTH`**: constante `0,1875 s` (duração de uma colcheia a 160 BPM).
- **`getAudio()`**: fábrica lazy que cria o `AudioContext` e os nós de ganho na primeira interação do usuário.
- **`scheduleNote()`**: agenda uma única nota (oscilador + envelope) em um nó de ganho alvo.
- **`scheduleMusicTick()`**: escalonador de lookahead (25 ms / 150 ms à frente) que alimenta a melodia e o baixo continuamente sem jitter.
- **`startMusic(fromStart)`**, **`stopMusic()`**, **`pauseMusic()`**, **`resumeMusic()`**: ciclo de vida da música ligado às transições de fase.
- **`toggleMute()`**: silencia/retoma a música via `musicGain.gain.value`; atualiza o indicador visual na sidebar.
- **`sfxMove()`**, **`sfxRotate()`**, **`sfxHardDrop()`**, **`sfxLock()`**, **`sfxLineClear(n)`**, **`sfxLevelUp()`**, **`sfxGameOver()`**: sete efeitos sonoros distintos.
- **Tecla M**: alterna mute da música durante o jogo (adicionada ao listener `keydown` e à lista de controles na tela de abertura e no sidebar).
- **`<div id="music-box">` / `<span id="music-status">`** em `index.html`: indicador visual "MÚSICA ON/OFF" na sidebar direita.
- **`#music-status` / `#music-status.muted`** em `style.css`: estilo verde (ON) e cinza (OFF) para o indicador.

### Modificado

- **`lockCurrent()`**: a cadeia de efeitos sonoros foi integrada. Se houve subida de nível → `sfxLevelUp()`; senão, se houve linhas → `sfxLineClear(n)`; senão → `sfxLock()`. O nível anterior é capturado antes de `s.level` ser atualizado para detectar a mudança.
- **`hardDrop()`**: chama `sfxHardDrop()` antes de executar a queda.
- **`tryRotate()`**: passa a retornar `true` quando a rotação é bem-sucedida (e `false` implicitamente quando falha), permitindo ao listener de teclado tocar `sfxRotate()` apenas em rotações válidas.
- **`showGameOver()`**: chama `stopMusic()` e `sfxGameOver()` antes de exibir o overlay.
- **`startGame()`**: chama `startMusic(true)` (reinicia a melodia do início).
- **`startAttract()`**: chama `startMusic(true)` (a IA joga com música).
- **`backToTitle()`**: chama `stopMusic()` (silêncio na tela de abertura).
- **`togglePause()`**: chama `pauseMusic()` ao pausar e `resumeMusic()` ao retomar.
- **Listener `keydown`**: desbloqueio do `AudioContext` (`ctx.resume()`) adicionado no início, antes de qualquer ramificação de fase; tratamento da tecla `M` adicionado ao `switch`.
- **Listeners `click` e `touchstart`**: adicionado desbloqueio do `AudioContext`.
- **`drawTitleScreen()`**: linha "M Música ON/OFF" incluída na lista de controles exibida no canvas; o layout vertical foi levemente ajustado para acomodar a linha extra.
- **`index.html`**: adicionada linha `<p>M Música</p>` no `#controls` e o bloco `#music-box` na sidebar direita.
- **`style.css`**: adicionadas regras para `#music-status` (cor verde) e `#music-status.muted` (cor cinza).

### Removido

- Nenhum comportamento ou funcionalidade da Etapa 3 foi removido.
