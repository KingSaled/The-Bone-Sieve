# assets/

Everything the game loads from disk. `index.html` is the only file that may sit
at the project root.

```
assets/
  fonts/   typefaces        (Hellbone.otf — ritual titles)
  img/     art              (the ornamental border and the pieces cut from it)
```

## Rules

- **Paths and filenames are case-sensitive** once hosted (Netlify and any Linux
  host). Reference them exactly as they are on disk.
- The whole folder must ship next to `index.html`. Nothing here is optional —
  a missing font degrades silently to a fallback, and a missing image leaves a
  screen unframed with no error.
- Reference assets through a CSS custom property in `:root`, not inline at the
  use site, so a single declaration can be repointed.

## The ornamental border

`.boneFrame` frames both the Ossuary and the Quota Sated box. Drop a
`<div class="boneFrame"></div>` into any `position:relative` box;
`buildBoneFrames()` fills in the eight pieces at startup.

| file | size | role |
|---|---|---|
| `ornate_border.png` | 720x720 | the painted source — kept as the master |
| `ornate_corner.png` | 152x152 | corner cluster, cut from (0,0) |
| `ornate_edge.png` | 220x104 | a run of edge, tiled along the top and bottom |
| `ornate_edge_v.png` | 104x220 | the same run turned clockwise, for the sides |

### Why the pieces are placed, not `border-image`

`border-image` scales each corner to whatever `border-width` the box has. With
two panels of different proportions that meant each got its own uneven corner
scaling, which turned the circular pentagrams into ellipses and squashed the
skull corners. Placing the pieces explicitly means **nothing is ever scaled to
fit a box**: corners are dropped in at a fixed size, edges repeat at their
painted size.

### How the pieces were cut

Measured off `ornate_border.png`, not guessed:

- The painted band reaches **85px** in from each edge.
- The corner cluster runs to about **140px** along each edge — hence a 152px
  square corner crop, with margin.
- The top band is mirror-symmetric about the **x=360** mid-line (measured
  asymmetry across 200 columns: 17, i.e. under a tenth of a pixel per column).
- The two skulls sit at **x=250** and its mirror **x=470**. The edge tile is cut
  between those two centres — 220px wide, centred on the pentagram. Because it
  spans skull-centre to skull-centre, **each repeat joins two half skulls into a
  whole one**, and because it is centred on the symmetry axis the tile is itself
  symmetric, so the seam matches.

Cut with `tools/crop-border-pieces.js`; re-run it if the master art changes.

### Sizing

`--bfe` is the single knob — the edge piece's painted depth. `--bfc` derives
from it at the corner's native ratio (152/104), so **corner and edge always
scale together**. At the default `104px` both render at true painted size.
Changing `--bfe` is a uniform scale, so medallions stay circular; the small
window breakpoint uses that to step the whole ornament down.

`--bf-out` (18px) is how far the frame sits *outside* its panel. The corner art
only turns solid about 14px in from its own edge, so without the overhang the
panel's square corner shows past the ornament's curved silhouette. `--bf-pad`
is what content should inset by to stay clear of the painted band.
