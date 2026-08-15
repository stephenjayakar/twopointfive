import { Vec3 } from '../math/vec';
import type { FloorMat } from './floor';

/** What the game layer needs from the audio engine (implemented in src/audio; null object until it is started). */
export interface GameAudioLike {
  play(name: string, pos: Vec3 | null, gain?: number, opts?: Record<string, unknown>): void;
  /** one footfall: `loudness` is the hearing-model level of the step (already scaled by the floor material — floor.ts tread), `mat` the material it landed on
   *  (sample choice and brightness; resolved by the caller so the mixer can never disagree with the guards' ears — omitted: the map is asked at `pos`) */
  footstep(pos: Vec3, loudness: number, isPlayer: boolean, mat?: FloorMat): void;
  /** the rain bed's level 0‥1 (weather.ts: the rate × where the listener stands; 0 = silence it). Optional: the QA harness's counting object has none. */
  rain?(level: number): void;
}
export const nullAudio: GameAudioLike = { play() { /* silent */ }, footstep() { /* silent */ } };
