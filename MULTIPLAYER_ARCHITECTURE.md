# APEX CHAOS realtime multiplayer architecture

## Terminology and audit

Before this refactor, `manualLabOnline.js` used `role === "host"` for three different
concepts: room creator, P1, and gameplay authority. Snapshot transmission, match start,
and remote transform correction were therefore coupled to the creator/P1 branch.

The runtime now exposes separate session identity fields:

- `roomCreatorId`: lobby ownership only.
- `localPlayerId` / `remotePlayerId`: stable network peer identities.
- `localPlayerSlot` / `remotePlayerSlot`: `P1` or `P2`, used only by gameplay/UI/spawns.
- `authorityOwnerId`: identity of the current simulation owner.
- `isAuthorityRuntime`: whether this browser currently owns authoritative simulation.

The current deployment uses a `LocalAuthorityRuntime` on the room creator's browser.
This is a transport/deployment choice, not a P1 rule. The relay publishes
`authorityOwnerId`, so a dedicated server can replace that owner without rewriting the
prediction or interpolation controllers.

## Runtime structure

`public/game/network/apexRealtimeMultiplayer.js` contains:

- `NetworkTickManager`: input tick at 30 Hz and snapshot tick at 25 Hz.
- `PlayerInputPacket` and `PlayerInputHistory`: sequenced, ticked input plus prediction data.
- `AuthoritySimulationController` / `LocalAuthorityRuntime`: input queue, acknowledgements,
  authority adapter, and official snapshots.
- `ClientPredictionController` / `ServerReconciliationController`: local input history,
  acknowledgement cleanup, smooth correction, snap, and pending-input replay.
- `SnapshotBuffer` / `RemoteInterpolationController`: 100 ms interpolation delay, bounded
  extrapolation, and large-error snap correction.
- `NetworkTransformSync`: role-neutral orchestration and transport adapter.
- `MultiplayerDebugOverlay`: live identity, tick, sequence, ping, buffer, and correction data.

The existing APEX CONTROL update loop is currently the authority simulation adapter. It
continues to own collision, hit detection, HP, skills, cooldowns, round state, and win/loss.
Networking no longer decides those outcomes from P1/P2 identity.

## P1 client flow

1. The local P1 controller applies input immediately for client-side prediction.
2. A fixed 30 Hz tick records a sequenced `PlayerInputPacket`.
3. If this client owns authority, the packet enters `LocalAuthorityRuntime`; otherwise it is sent.
4. The authority adapter simulates both slots in the canonical gameplay loop.
5. The authority produces snapshots at 25 Hz with per-player input acknowledgements.
6. The P1 client reconciles the player matching `localPlayerId`.
7. The P1 client buffers and interpolates the player matching `remotePlayerId`.

## P2 client flow

The flow is identical. Only `localPlayerId` and `localPlayerSlot` differ:

1. P2 input predicts P2 immediately.
2. Sequenced input is sent to `authorityOwnerId`.
3. Authority simulates the packet and acknowledges its sequence.
4. P2 reconciles its own authoritative snapshot without raw transform replacement.
5. P2 renders P1 from the delayed snapshot buffer.

## Snapshot protection

- Local player snapshots go only to `ClientPredictionController.reconcile()`.
- Remote player snapshots go only to `RemoteInterpolationController.push()`.
- Authoritative HP, cooldown mirrors, match state, and winner state are applied separately.
- Errors below the small threshold are ignored, medium errors blend/replay, and large errors snap.

## Test checklist

- [x] Relay identifies room creator, player slots, and authority owner separately.
- [x] Relay rejects official snapshots from a non-authority peer.
- [x] Input packets contain tick and increasing sequence.
- [x] Snapshots contain server tick and last processed sequence per player.
- [x] Local and remote snapshots use different application paths.
- [x] Fixed input/snapshot rates are independent from render FPS.
- [x] Small/medium/large correction modes are implemented.
- [x] Debug overlay exposes authority and synchronization state.
- [ ] Manual two-browser test: P1 movement appears smoothly on P2.
- [ ] Manual two-browser test: P2 movement appears smoothly on P1.
- [ ] Network throttling test at high latency and light packet loss.
- [ ] Champion-by-champion skill/VFX replication verification.
- [ ] Disconnect/reconnect mid-match state resynchronization.

