# 🎮 RSPMP — Rock, Scissors, Paper Multiplayer

Um mini-jogo de **Pedra, Papel e Tesoura** com sistema de baralho, multiplayer
em tempo real via WebRTC — 100% hospedado no GitHub Pages.

## 🃏 Como Funciona

1. Cada jogador recebe **5 cartas aleatórias** (Pedra 🪨, Papel 📄 ou Tesoura ✂️)
2. Escolha uma carta da sua mão para jogar
3. Ambos revelam simultaneamente
4. Regras clássicas: Pedra > Tesoura > Papel > Pedra
5. **O jogo termina quando um jogador abre 2 pontos de vantagem**
6. Quando as 5 cartas acabam, novas são distribuídas

## 🚀 Como Jogar

### Hospedar uma partida:
1. Acesse o site
2. Digite seu nome
3. Clique em **"Hospedar Novo Jogo"**
4. Compartilhe o **link** com seu amigo (botão Copiar Link)

### Entrar em uma partida:
1. Acesse o **link** recebido (ou digite o código manualmente)
2. Digite seu nome
3. A partida começa automaticamente

## ⚠️ Requisitos

- **Ambos os jogadores devem estar no mesmo navegador/dispositivo** OU
  usar o link de convite (funciona entre abas do mesmo navegador via
  localStorage como canal de sinalização WebRTC)
- Para jogar entre **dispositivos diferentes na mesma rede**, ambos
  precisam acessar via o mesmo domínio do GitHub Pages

## 🎨 Design

- Paleta: **Preto, Cinza e Vermelho escuro**
- Interface minimalista com bordas em vermelho
- Cartas na parte inferior
- Log de partidas à direita
- Botão de saída à esquerda

## 📁 Estrutura
