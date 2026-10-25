// A SAVE'S PICTURE, WHICH ROAD (the switch; the pass itself is render/savepic.ts, the host that takes the picture main.ts takeSavePictures).
//
// on = the host takes a save's picture WITHOUT WAITING for the GPU: the frame is boxed down on the GPU and read back a frame or a few later. off = the picture
// as it was taken, by drawing the whole canvas into a 2D one in the save's own frame, which stalls the page while the GPU finishes and hands the frame back.
// The page's alone, as the frame loop's two are (game/knobs.ts VISIT_OWN): nothing in the simulation reads it, a run is the same run either way, and no
// recording sets it — the canvas is configured for it once, at boot, from this page's own address (the table is on VISIT_OWN, the word `savepic` on
// ui/replaykey.ts VISIT_FLAGS: a page that plays a tape keeps the viewer's).
export const SAVEPIC = { on: false };
