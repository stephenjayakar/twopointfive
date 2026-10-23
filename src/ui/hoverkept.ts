// What the cursor is on, kept between frames for the HUD's lines and the ring's hint (game/orders.ts hover, HoverKept): the PICTURE'S own, one store for
// the two that ask, so the order book holds nothing of it.
import { hoverStore } from '../game/orders';

export const hoverKept = hoverStore();
