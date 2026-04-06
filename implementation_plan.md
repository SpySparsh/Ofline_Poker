# Audio Sync, Expanded Chips & Winner's Curse Fix

## Overview

Four changes across backend and frontend: fix the "Winner's Curse" sequence mode, expand chip denominations with disabled-state UI, implement local SFX, and build a synchronized BGM system using the "DJ" pattern.

## User Review Required

> [!IMPORTANT]
> The soundtrack files are currently in `/soundtracks/` at the project root. Express needs to serve them as static files. I'll add `expressApp.use('/audio', express.static('soundtracks'))` to `server.js` so they're accessible at `/audio/Room1.mp3`, `/audio/chip_low.mp3`, etc. This is simpler than copying them into `/public/`.

> [!WARNING]
> The filename `chip high.mp3` has a space. I'll reference it as `/audio/chip high.mp3` (URL-encoded automatically by the browser). If this causes issues, renaming it to `chip_high.mp3` would be cleaner. Please confirm if renaming is OK.

> [!IMPORTANT]
> For the "sourced" SFX (join, conclude, showdown, button clicks), I'll generate short base64-encoded tones using the Web Audio API at runtime rather than downloading external URLs. This avoids any copyright issues and keeps the project self-contained. Each will be a distinct synthesized sound (chime, buzz, fanfare, click).

---

## Proposed Changes

### 1. Game Engine — Winner's Curse Fix

#### [MODIFY] [gameEngine.js](file:///d:/Poker/server/gameEngine.js)

**`resolveShowdown()`** (line 288): After distributing chips, store the winner's index for the next hand:
```js
// If winner_curse mode, set dealerIndex to the seat right after the winner
if (room.settings.sequenceMode === "winner_curse" && winners.length > 0) {
  const winnerIdx = room.players.findIndex(p => p.id === winners[0]);
  if (winnerIdx !== -1) {
    room.gameState.dealerIndex = winnerIdx;
  }
}
```

**`startHand()`** (line 67-75): The existing code only rotates the dealer for `"standard"` mode. For `"winner_curse"`, `dealerIndex` is already set by `resolveShowdown`, so no rotation is needed — we just skip the rotation block:
```js
if (room.gameState.gameNumber > 1) {
   if (room.settings.sequenceMode === "standard") {
      // existing rotation logic
   }
   // winner_curse: dealerIndex was already set by resolveShowdown, no change needed
}
```

This means the winner becomes the dealer next hand, and action starts to their left (the "curse").

---

### 2. Expanded Chip Denominations & Disabled UI

#### [MODIFY] [ChipIcon.js](file:///d:/Poker/src/components/ChipIcon.js)

- Expand `DENOMINATIONS` from `[100, 500, 1000, 5000]` → `[10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000]`
- Expand `CHIP_COLORS` with new entries:
  - `10`: Light grey/cream
  - `50`: Orange
  - `10000`: Purple
  - `50000`: Gold
  - `100000`: Platinum/silver-gradient
- Update `SingleChip` to accept a `disabled` prop → applies `opacity-40 grayscale cursor-not-allowed` and prevents `onClick`
- Update `ChipTray` to accept `availableStack` and pass `disabled={d > availableStack}` to each chip
- Update label formatting to handle `10K`, `50K`, `100K`

#### [MODIFY] [ActionPanel.js](file:///d:/Poker/src/components/ActionPanel.js)

- `ChipTray` already receives `availableStack` — no change needed (it already passes `availableStack={me.stack}`). The disabling logic moves into `ChipIcon.js`.

---

### 3. Local Sound Effects System

#### [NEW] [useAudio.js](file:///d:/Poker/src/hooks/useAudio.js)

A custom React hook that manages all audio playback:

- **`playChipSound(denomination)`**: Plays `/audio/chip_low.mp3` for denominations ≤ 100, `/audio/chip high.mp3` for ≥ 500.
- **`playSfx(eventName)`**: Plays synthesized tones for:
  - `"join"` — ascending chime (Web Audio API oscillator)
  - `"conclude"` — descending tone
  - `"showdown"` — dramatic fanfare chord
  - `"click"` — short tick
- Uses `useRef` to cache `Audio` objects and prevent overlapping playback.
- Exposes a `muted` state toggle.

#### [MODIFY] [ActionPanel.js](file:///d:/Poker/src/components/ActionPanel.js)

- Import `useAudio` hook
- Call `playChipSound(denomination)` inside `handleAddChip`
- Call `playSfx("click")` on Fold/Check/Call button clicks

#### [MODIFY] [ChipIcon.js](file:///d:/Poker/src/components/ChipIcon.js)

- `ChipTray`'s `onAddChip` callback already fires on tap — the sound is triggered in `ActionPanel`'s `handleAddChip`, so no change needed in ChipIcon itself.

#### [MODIFY] [SocketContext.js](file:///d:/Poker/src/context/SocketContext.js)

- Listen for `room:updated` events where a new player joins → call `playSfx("join")`
- Listen for game state transitions to showdown → call `playSfx("showdown")`

---

### 4. Synchronized Background Music (BGM)

#### [MODIFY] [roomManager.js](file:///d:/Poker/server/roomManager.js)

Add `bgmState` to the room object at creation:
```js
bgmState: {
  currentTrackIndex: 1,
  startTime: Date.now(),
  totalTracks: 5
}
```

#### [MODIFY] [socketHandlers.js](file:///d:/Poker/server/socketHandlers.js)

- In `room:join` callback, include `room.bgmState` in the response (already sent as part of the full `room` object, so no extra work).
- Add new handler:
```js
socket.on("bgm:trackEnded", ({ roomId }) => {
  const room = getRoom(roomId);
  if (!room) return;
  room.bgmState.currentTrackIndex = (room.bgmState.currentTrackIndex % 5) + 1;
  room.bgmState.startTime = Date.now();
  io.to(roomId).emit("bgm:syncTrack", room.bgmState);
});
```

#### [MODIFY] [server.js](file:///d:/Poker/server.js)

Add static file serving for the soundtracks directory:
```js
expressApp.use('/audio', express.static('soundtracks'));
```
This must be placed *before* the Next.js catch-all route.

#### [NEW] [useBGM.js](file:///d:/Poker/src/hooks/useBGM.js)

A custom hook for synchronized BGM playback:

- Manages an `<audio>` element via `useRef`
- On mount/room join: reads `roomState.bgmState`, calculates offset `(Date.now() - bgmState.startTime) / 1000`, sets `audio.currentTime = offset`, plays
- Listens for `bgm:syncTrack` events → switches to new track, plays from `currentTime = 0`
- If `isAdmin`, attaches `onEnded` listener → emits `bgm:trackEnded`
- Track URLs: `/audio/Room1.mp3` through `/audio/Room5.mp3`
- Respects the `muted` toggle from `useAudio`

#### [MODIFY] [page.js (home)](file:///d:/Poker/src/app/page.js)

- Add a local `<audio>` element that plays `/audio/home_page.mp3` on loop when the landing page is mounted. Clean up on unmount.

#### [MODIFY] [page.js (game)](file:///d:/Poker/src/app/game/page.js)

- Import and use `useBGM(roomState)` hook to start synchronized playback.

---

## Open Questions

1. **Rename `chip high.mp3`?** — Can I rename it to `chip_high.mp3` to avoid URL encoding issues?
2. **Synthesized SFX quality** — Are Web Audio API generated tones acceptable, or do you want me to find and download specific `.mp3` files from freesound.org instead?

## Verification Plan

### Automated Tests
- `npm run build` must pass (no CSR bailout)
- Start server with `npm run dev`
- Browser subagent: Create room → verify home BGM plays → join lobby → start game → verify chips 10-100K render → tap low chip (verify sound) → tap high chip (verify sound) → complete a hand with Winner's Curse mode → verify dealer moves to winner

### Manual Verification
- Two browser tabs in same room should hear synchronized BGM
- Closing a tab should not break BGM for remaining players
