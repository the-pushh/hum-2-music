type Player = { pause: () => void };

/** The hum playing right now. Only one plays at a time, so starting another pauses this one. */
let playing: Player | null = null;

export function startedPlaying(player: Player) {
  if (playing && playing !== player) playing.pause();
  playing = player;
}

export function stoppedPlaying(player: Player) {
  if (playing === player) playing = null;
}
