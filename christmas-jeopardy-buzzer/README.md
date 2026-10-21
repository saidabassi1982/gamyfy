# Christmas Jeopardy Buzzer

Christmas-themed phone buzzer companion for Christmas Jeopardy - Buzzer Edition. Same code as `jeopardy-buzzer/`, with the pine, cranberry and gold theme.

## GitHub Pages

Christmas Jeopardy host games point QR codes to:

`https://saidabassi1982.github.io/gamyfy/christmas-jeopardy-buzzer/`

## How It Works

- The host creates a PeerJS room code.
- Team phones open this hosted page with `room`, `team`, `name`, and `color` query parameters.
- The phone page connects to the host room using PeerJS.
- When the host arms buzzers, the first phone tap locks in the team.

When `jeopardy-buzzer/index.html` changes, regenerate this page from it so both stay in sync.
