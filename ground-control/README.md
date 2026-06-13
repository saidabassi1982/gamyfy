# Ground Control Phone Companion

Standalone phone companion for the Ground Control party game.

## GitHub Pages

Published from the `main` branch root:

`https://saidabassi1982.github.io/gamyfy/ground-control/`

The Ground Control host adds the active four-character room code:

`https://saidabassi1982.github.io/gamyfy/ground-control/?code=ABCD`

## How It Works

- The host creates a PeerJS room named `gctl-xxxx`.
- Players scan the host QR code or open the companion URL.
- Each phone connects directly to the host through PeerJS.
- The host assigns available player seats and sends game snapshots.
- Active players can choose targets and submit answers from their phones.

PeerJS is bundled in `assets/vendor`, so the companion does not depend on a
third-party script CDN. The host and phones still need internet access for the
PeerJS signaling service.
