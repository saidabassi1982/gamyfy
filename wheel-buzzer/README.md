# Wheel Buzzer

Standalone phone buzzer companion for the Interactive Wheel Game. Players use their phones as buzzers during toss-up rounds, and can type their solve on the phone in Hostless mode.

## GitHub Pages

Published from the `main` branch root via GitHub Pages. The wheel host game points QR codes to:

`https://saidabassi1982.github.io/gamyfy/wheel-buzzer/`

## How It Works

- The wheel host creates a PeerJS room code (`wheel-XXXX`).
- Each player opens this hosted page with `room`, `p` (player index), `name`, and `color` query parameters.
- The phone connects to the host room over PeerJS and stays in the room for the whole game.
- When a toss-up starts, the host arms buzzers. The first phone tap locks in that player (first-buzz lockout).
- In Hostless mode, the buzzing player is prompted on their phone to type the answer, which the host board auto-judges.

## Wire Protocol

Phone → host: `{type:'hello', player}` · `{type:'buzz', player}` · `{type:'game-answer', player, answer}`
Host → phone: `{type:'state', armed, winnerIdx, players[]}` · `{type:'answer-prompt', player, playerName, question}` · `{type:'answer-clear'}`

No buyer setup is required beyond scanning the QR code from the game. The companion page is always live; the room itself is created fresh by the host each game.
