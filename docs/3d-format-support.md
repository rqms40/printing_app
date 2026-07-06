# GRIDGO 3D Format Support

Status: MVP support decision for issue #9.

## Supported For Upload And Checkout

| Extension | Upload validation | Bounds analysis | Mobile preview | Admin preview | Notes |
| --- | --- | --- | --- | --- | --- |
| `stl` | Yes | Yes | Server-converted GLB when mesh triangles parse | Direct STL or server-converted GLB | Binary and ASCII STL are supported. Units are treated as millimeters. |
| `obj` | Yes | Yes | Server-converted GLB when faces parse; direct OBJ fallback | Direct OBJ or server-converted GLB | Polygon faces are triangulated with a fan. Materials/textures are not required for MVP preview. |
| `3mf` | Yes | Yes | Server-converted GLB when triangle mesh parses | Server-converted GLB | Basic mesh vertices/triangles and declared units are parsed. Texture/material fidelity is not an MVP guarantee. |
| `glb` | Yes | No server bounds yet | Direct mobile preview | Direct admin preview | Accepted for preview/model interchange and checkout; admin review can still inspect the original. |
| `gltf` | Yes | No server bounds yet | Direct mobile preview | Direct admin preview | External resource dependencies may limit preview fidelity. |

## Deferred Formats

`fbx`, `ply`, `amf`, `dae`, `step`, and `iges` are intentionally out of MVP upload validation. The current Flutter viewer package advertises GLB/GLTF/OBJ support in its README and package metadata also references FBX support, but GRIDGO does not yet have server-side validation, bounds analysis, or conversion tests for those additional formats. STEP/IGES are CAD exchange formats and need a separate conversion pipeline before they can be safely accepted.

## Preview Policy

Preview generation failure should not block checkout when upload validation succeeds and required order specs are present. If bounds are available, printer-fit validation can still warn the customer. The UI should show a clear fallback when preview is unavailable and allow admin review of the original upload.
