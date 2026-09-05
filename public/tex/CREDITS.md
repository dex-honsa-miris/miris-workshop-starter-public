# Surface textures

Public domain (CC0) from [Poly Haven](https://polyhaven.com), resized and
recompressed for the web. The floor is also colour-graded: the parquet ships a
dark walnut that sat well outside this room's palette, so its albedo was lifted
per channel toward #c9b18a, the tone the flat-colour version of this step used.
Mean went from #926f4d to #b9a887. CC0 allows that, and the alternative was
giving up the herringbone -- no lighter parquet exists in the library, and the
pattern is the part that reads as a boutique. CC0 asks for nothing, but provenance is worth
recording: these are redistributable, which is exactly why they are the ones
committed here.

| folder | Poly Haven asset        | used for                    |
|--------|-------------------------|-----------------------------|
| floor  | `herringbone_parquet`   | the floor                   |
| wall   | `painted_plaster_wall`  | walls and ceiling           |
| rug    | `wool_boucle`           | the rug                     |

Each folder holds three files. `color` is albedo, tagged sRGB. `normal` is
OpenGL-convention (green up), which is what three.js expects -- the DirectX
variant reads as lighting bent the wrong way. `arm` packs three greyscale maps
into one image's channels: ambient occlusion in red, roughness in green,
metalness in blue. One download and one upload to the GPU instead of three.

Brass is not textured. It is a colour, a low roughness and metalness 1, and the
environment from 01.3 does the rest -- which is the cheapest convincing metal
there is.
