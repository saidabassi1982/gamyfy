# Feud Buzzer

Standalone phone buzzer companion for Feud-style Gamyfy games, including Office Feud, Friendly Feud, Bachelorette Feud, and Baby Shower Feud.

## GitHub Pages

Publish this folder with GitHub Pages from the `main` branch root. Feud host games should point QR codes to:

`https://saidabassi1982.github.io/gamyfy/feud-buzzer/`

## How It Works

- The Feud host creates a PeerJS room code.
- Team phones open this hosted page with `room`, `team`, `name`, and `color` query parameters.
- The phone page connects to the host room using PeerJS.
- When the host arms buzzers, the first phone tap locks in the team.

No buyer setup is required beyond scanning the QR code from the game.
