import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.document = { getElementById: () => null };
await import('../public/game/network/apexRealtimeMultiplayer.js');

const {
  SnapshotBuffer,
  ServerReconciliationController,
  AuthoritySimulationController,
  PlayerInputHistory,
  ClientPredictionController,
  NetworkTransformSync,
} = globalThis.APEX_REALTIME_MULTIPLAYER;

const history = new PlayerInputHistory(3);
history.push({ sequence:1 });
history.push({ sequence:2 });
history.push({ sequence:3 });
history.acknowledge(2);
assert.deepEqual(history.items.map(item => item.sequence), [3]);

const buffer = new SnapshotBuffer();
buffer.push({ snapshotTick:1, position:{x:0,y:0}, velocity:{x:10,y:0}, facingDirection:{x:1,y:0} }, 1000);
buffer.push({ snapshotTick:2, position:{x:10,y:0}, velocity:{x:10,y:0}, facingDirection:{x:1,y:0} }, 1100);
const interpolated = buffer.sample(1050);
assert.equal(interpolated.position.x, 5);
assert.equal(interpolated.extrapolated, false);

// Tiny idle corrections must not become extrapolated movement. This guards the
// standing-player vibration/rotation regression seen by both P1 and P2.
const idleBuffer = new SnapshotBuffer();
idleBuffer.push({ snapshotTick:1, position:{x:100,y:100}, velocity:{x:.8,y:-.4}, facingDirection:{x:1,y:0} }, 1000);
idleBuffer.push({ snapshotTick:2, position:{x:100.2,y:99.9}, velocity:{x:-.6,y:.3}, facingDirection:{x:1,y:0} }, 1100);
const idleInterpolated = idleBuffer.sample(1050);
assert.deepEqual(idleInterpolated.position, {x:100.2,y:99.9});
assert.deepEqual(idleInterpolated.velocity, {x:0,y:0});
const idleExtrapolated = idleBuffer.sample(1200);
assert.deepEqual(idleExtrapolated.position, {x:100.2,y:99.9});
assert.equal(idleExtrapolated.extrapolated, false);

assert.equal(ServerReconciliationController.correctionMode({x:0,y:0},{x:2,y:0}).mode, 'none');
assert.equal(ServerReconciliationController.correctionMode({x:0,y:0},{x:12,y:0}).mode, 'smooth');
assert.equal(ServerReconciliationController.correctionMode({x:0,y:0},{x:60,y:0}).mode, 'replay');
assert.equal(ServerReconciliationController.correctionMode({x:0,y:0},{x:200,y:0}).mode, 'snap');

const applied = [];
const authority = new AuthoritySimulationController({
  applyAuthorityInput: packet => applied.push(packet.sequence),
  validateAuthorityState: () => {},
  captureAuthoritySnapshot: () => ({ players:[] }),
});
authority.submitInput({ playerId:'peer-2', sequence:4 });
authority.submitInput({ playerId:'peer-2', sequence:5 });
authority.simulateTick(12, 1/30);
assert.deepEqual(applied, [5]);
const snapshot = authority.createSnapshot();
assert.equal(snapshot.serverTick, 12);
assert.equal(snapshot.lastProcessedInputSequenceByPlayer['peer-2'], 5);

// Unacknowledged snapshots must never pull the predicted local player toward an
// old authority position.
let localTransformWrites = 0;
const prediction = new ClientPredictionController({
  getLocalPlayerState: () => ({position:{x:800,y:500}}),
  setLocalPlayerTransform: () => { localTransformWrites++; },
  offsetLocalPlayer: () => { localTransformWrites++; },
});
prediction.reconcile({position:{x:0,y:0}}, 0);
prediction.update(1/30);
assert.equal(localTransformWrites, 0);
assert.equal(prediction.correctionMode, 'none');

prediction.record({sequence:1,moveX:1,moveY:0,localPredictedPosition:{x:800,y:500}});
prediction.reconcile({position:{x:740,y:500}}, 1);
prediction.update(1/30);
assert.equal(localTransformWrites, 0);
assert.equal(prediction.correctionMode, 'prediction');

prediction.record({sequence:2,moveX:0,moveY:0,localPredictedPosition:{x:800,y:500}});
prediction.reconcile({position:{x:790,y:500}}, 2);
prediction.update(1/30);
assert.equal(localTransformWrites, 1);
assert.equal(prediction.correctionMode, 'smooth');

// The authority fixed tick must process queued guest inputs even when the room
// creator is completely idle and has no local input sample.
const sync = new NetworkTransformSync({
  applyAuthorityInput: () => {},
  validateAuthorityState: () => {},
  captureAuthoritySnapshot: () => ({players:[]}),
}, {});
sync.configureSession({localPlayerId:'peer-1',authorityOwnerId:'peer-1',localPlayerSlot:'P1'});
sync.receiveInput({playerId:'peer-2',playerSlot:'P2',sequence:9});
sync.fixedInputTick(7, 1/30);
assert.equal(sync.authority.serverTick, 7);
assert.equal(sync.authority.lastProcessedInputSequenceByPlayer['peer-2'], 9);

console.log('[realtime-multiplayer] prediction, interpolation, correction, and authority sequence tests passed');
