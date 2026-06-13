// Ground Control — per-deployment config (safe to commit; no secrets).
//
// After you run `npx partykit deploy` once with your Cloudflare account,
// PartyKit prints a hostname like `ground-control.<your-handle>.partykit.dev`.
// Paste it below (no protocol; just the host). Until then, the online
// multiplayer mode is disabled and only LAN P2P works.
//
// You can also override at runtime in the browser console for testing:
//   window.GC_PARTYKIT_HOST = "ground-control.your-handle.partykit.dev"
//   localStorage.setItem("gc.roomMode", "online");
//
window.GC_PARTYKIT_HOST = "ground-control.saidabassi1982.partykit.dev";
