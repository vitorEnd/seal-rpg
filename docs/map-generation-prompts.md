# Operação Neptune — proveniência dos mapas da primeira sessão

## Modo de geração

Os doze mapas foram produzidos com a skill `imagegen`, no modo integrado (built-in) do gerador de imagens. Nenhum fallback por CLI/API foi usado.

- O convés principal usou a imagem enviada pelo usuário exclusivamente como referência de clima e iluminação naval noturna.
- Os conveses superior e inferior usaram o convés principal gerado como âncora arquitetônica, preservando orientação, escala e silhueta geral.
- A base e o heliporto foram gerações originais sem imagem de referência.
- A zona de inserção foi uma geração original sem imagem de referência.
- O complexo industrial e a safehouse foram criados como conjuntos coerentes de mapas, usando a primeira imagem de cada local como referência visual para os respectivos setores e andares.
- Todos os arquivos finais são PNG de 1536 × 1024 pixels.

## Caminhos finais

- `public/art/maps/neptune-cargo-ship-main-deck.png`
- `public/art/maps/neptune-cargo-ship-upper-deck.png`
- `public/art/maps/neptune-cargo-ship-lower-deck.png`
- `public/art/maps/neptune-seal-base.png`
- `public/art/maps/neptune-helipad.png`
- `public/art/maps/neptune-insertion-zone.png`
- `public/art/maps/neptune-industrial-complex-exterior.png`
- `public/art/maps/neptune-industrial-complex-warehouse.png`
- `public/art/maps/neptune-industrial-complex-control.png`
- `public/art/maps/neptune-safehouse-exterior.png`
- `public/art/maps/neptune-safehouse-ground-floor.png`
- `public/art/maps/neptune-safehouse-basement.png`

## Prompts exatos

### Convés principal

```text
Use case: stylized-concept
Asset type: polished virtual tabletop tactical battlemap, first-session environment asset
Primary request: create an original enormous modern cargo ship MAIN DECK at night for a military tabletop RPG mission, designed for close zoom and token movement.
Input images: Image 1 is mood and nighttime naval lighting reference only. Do not copy its composition, ship geometry, container arrangement, game assets, branding, or any recognizable intellectual property.
Scene/backdrop: the full working main deck of a large ocean-going cargo vessel surrounded by dark cold ocean; weathered steel deck; dense but navigable stacks of unbranded red, blue, ochre, gray and green shipping containers; clear tactical lanes between stacks; cargo cranes; tie-down points; deck machinery; lifeboat station; railings; stairways and ladders; sealed access hatches leading to upper and lower levels; stern superstructure footprint visible at the bottom; bow points exactly toward the top of the canvas.
Subject: a highly functional, believable tactical environment with multiple routes, chokepoints, cover, open crossing areas, and readable access points; no characters.
Style/medium: realistic high-detail digital environment render, grounded military thriller art direction, crisp materials, VTT-ready, readable at multiple zoom levels, not a screenshot and not based on an existing game map.
Composition/framing: strict 90-degree top-down bird's-eye orthographic view, zero isometric tilt and zero horizon; landscape 3:2 canvas; entire usable deck footprint visible with a narrow ocean margin; bow at top, stern at bottom; north-up orientation that must be repeatable across companion floor maps.
Lighting/mood: mandatory deep night; restrained cold blue moonlight; sparse warm amber/red practical deck lights and floodlights; atmospheric sea mist only around the perimeter; enough local contrast to read walkable surfaces and obstacles.
Color palette: navy-black ocean, gunmetal and weathered teal steel, muted container colors, small controlled amber and red light pools.
Materials/textures: salt-streaked painted steel, wet reflective patches, worn non-slip deck, oxidized railings, believable container corrugation, rope and cable detail.
Constraints: original design; coherent architectural footprint suitable for matching upper-deck and lower-deck companion maps; clear floor surfaces; no roof blocking playable deck; no baked-in grid; no text; no numbers; no letters; no signs; no logos; no trademarks; no watermark; no UI; no frame; no tokens; no people; no bodies; no creatures; no weapons laid out as props.
Avoid: oblique camera, cinematic horizon, isometric perspective, fisheye distortion, miniature diorama look, excessive smoke, pitch-black unreadable zones, copied videogame layout, clutter that blocks all routes.
```

### Convés superior

```text
Use case: stylized-concept
Asset type: polished virtual tabletop tactical battlemap, companion floor layer
Primary request: transform the architectural anchor into the UPPER DECK layer of the same original enormous modern cargo ship at night, for a military tabletop RPG. This must read as the immediately higher playable level above the main-deck companion map.
Input images: Image 1 is the generated architectural anchor for the same fictional ship. Preserve its overall hull silhouette, exact bow-up orientation, stern/bow placement, vessel proportions, crane locations, color language, wet-night lighting, and major vertical access alignments. Do not simply repeat the main deck.
Scene/backdrop: upper-level exterior catwalks, crane access walkways, weather deck, lifeboat access, radar and communications platforms without logos, plus a clean roof-removed/cutaway view into the stern bridge and superstructure level. Include believable bridge control room, compact chart/navigation room without readable screens, captain/officer office, radio room, stair landings, narrow corridors, external stairs, ladders and access hatches aligned to the main deck below. Areas with no playable upper floor should be visually subdued as dark roof surfaces or ocean, while all playable upper walkways remain clear.
Subject: a coherent upper-floor tactical environment with multiple routes, chokepoints, observation positions, open catwalks, rooms and vertical transition points; no characters.
Style/medium: realistic high-detail digital environment render, grounded military thriller art direction, crisp materials, VTT-ready, readable at close zoom, original design.
Composition/framing: strict 90-degree top-down orthographic view, zero isometric tilt and zero horizon; landscape 3:2 canvas; same hull registration, crop, scale and north-up alignment as Image 1; bow exactly at top, stern exactly at bottom.
Lighting/mood: deep night; cold blue moonlight; sparse warm amber/red practical deck lights; readable interior pools of dim neutral light; subtle sea mist only around perimeter.
Color palette: navy-black ocean, gunmetal and weathered teal steel, muted gray-green interiors, controlled amber/red highlights.
Materials/textures: salt-streaked steel, wet catwalks, oxidized rails, non-slip floor, safety glass, worn utilitarian interior surfaces.
Constraints: preserve cross-floor architectural logic and access alignment; original fictional ship; no baked-in grid; no text; no numbers; no letters; no maps with readable writing; no signs; no logos; no trademarks; no watermark; no UI; no frame; no tokens; no people; no bodies; no creatures; no loose weapons as props.
Avoid: oblique camera, cinematic horizon, isometric perspective, perspective drift, changed hull proportions, changed bow orientation, repeated container deck as the main subject, miniature diorama look, pitch-black playable rooms, copied videogame layout.
```

### Convés inferior

```text
Use case: stylized-concept
Asset type: polished virtual tabletop tactical battlemap, companion floor layer
Primary request: transform the architectural anchor into the LOWER DECK layer inside the same original enormous modern cargo ship at night, for a military tabletop RPG. This must read as the playable level directly below the main-deck companion map.
Input images: Image 1 is the generated architectural anchor for the same fictional ship. Preserve its overall hull silhouette, exact bow-up orientation, stern/bow placement, vessel proportions, crop, major bulkhead logic, crane-base locations and vertical access alignments. Do not repeat the exposed main deck.
Scene/backdrop: a clean roof-removed/cutaway top-down view inside the lower hull: two large cargo holds with walkable aisles and restrained stacks of unbranded sealed crates and pallets; forepeak storage; secure document room; utility workshops; crew service corridor; watertight bulkheads and doors; stairwells and ladders aligned to deck hatches above; pipes and cable trays; stern engine room with engines, turbines, generators, catwalks and maintenance lanes; small pump room; narrow side passages; dark ocean surrounding the hull.
Subject: a coherent lower-floor tactical environment with multiple paths, chokepoints, cover, rooms, machinery hazards, vertical transitions, and one plausible searchable secure area; no characters.
Style/medium: realistic high-detail digital environment render, grounded military thriller art direction, crisp materials, VTT-ready, readable at close zoom, original fictional design.
Composition/framing: strict 90-degree top-down orthographic view, zero isometric tilt and zero horizon; landscape 3:2 canvas; same hull registration, crop, scale and north-up alignment as Image 1; bow exactly at top, stern exactly at bottom; roof removed uniformly so playable floor plan is visible.
Lighting/mood: deep-night vessel interior; dim cold-blue emergency illumination with localized neutral utility lights and restrained amber/red status glows; exterior ocean nearly black; every playable corridor remains readable.
Color palette: navy-black ocean, charcoal and gunmetal bulkheads, worn teal-gray deck plates, muted brown crates, small amber/red/cool-white practical lights.
Materials/textures: oil-stained steel, worn anti-slip flooring, riveted bulkheads, pipes, valves without labels, wet patches, believable cargo and heavy machinery.
Constraints: preserve cross-floor architectural logic and access alignment; original fictional ship; clear walkable floor surfaces; no baked-in grid; no text; no numbers; no letters; no readable documents; no signs; no logos; no trademarks; no watermark; no UI; no frame; no tokens; no people; no bodies; no creatures; no loose weapons as props.
Avoid: oblique camera, cinematic horizon, isometric perspective, perspective drift, changed hull proportions, changed bow orientation, exposed exterior container deck, miniature diorama look, pitch-black playable rooms, copied videogame layout, excessive clutter that blocks routes.
```

### Base SEAL

```text
Use case: stylized-concept
Asset type: polished virtual tabletop tactical battlemap, first-session environment asset
Primary request: create an original LARGE modern naval special-operations base map for a military tabletop RPG, designed for close zoom, exploration and character movement.
Scene/backdrop: a secure coastal military compound with a complete playable interior/exterior layout. Roofs are cleanly removed in cutaway style. Include a headquarters building with reception/security vestibule, command office, briefing room with blank tables/screens, operations room with blank consoles, radio/communications room, several practical offices and archive room; a separate barracks wing with bunks, lockers, showers, toilets and a small common room; mess hall and kitchen; compact medical room; gym/training room; secured equipment cage; garage/workshop with two unbranded utility vehicles; covered loading area; paved internal roads; parking; fenced perimeter; guarded entry gate without signage; small training yard and landscaped buffer areas.
Subject: a believable functional base with clear circulation, doors, halls, courtyards, multiple routes, indoor and outdoor encounter spaces, and legible room boundaries; no characters.
Style/medium: realistic high-detail digital environment render, grounded contemporary military thriller art direction, crisp surfaces, original fictional facility, VTT-ready, readable at multiple zoom levels, not an existing game map.
Composition/framing: strict 90-degree top-down bird's-eye orthographic view, zero isometric tilt and zero horizon; landscape 3:2 canvas; entire compound fits inside frame with a narrow margin; buildings arranged as a coherent secure campus; all roofs removed uniformly to expose playable interiors; straight walls and undistorted geometry.
Lighting/mood: cool overcast early morning with soft directional daylight; subtle warm practical interior lights; controlled sober atmosphere; enough contrast for every room and walkway.
Color palette: desaturated concrete gray, sand-tan walls, weathered olive and dark navy accents, asphalt charcoal, restrained institutional whites and muted greens.
Materials/textures: worn concrete, non-slip institutional floors, practical metal doors, painted cinder block, fabric bunks, desks, cable trays, chain-link and anti-climb fencing, subtle tire wear.
Constraints: original design; all facilities visually functional; clear walkable surfaces; no baked-in grid; no text; no numbers; no letters; no readable screens; no signs; no flags; no insignia; no logos; no trademarks; no watermark; no UI; no frame; no tokens; no people; no bodies; no creatures; no loose weapons displayed.
Avoid: oblique camera, horizon, isometric perspective, fisheye, decorative sci-fi technology, luxury office styling, cartoon look, miniature diorama look, roofed-over playable rooms, copied videogame layout, excessive clutter, pitch-black rooms.
```

### Heliporto

```text
Use case: stylized-concept
Asset type: polished virtual tabletop tactical battlemap, first-session environment asset
Primary request: create an original MEDIUM-SMALL secure military helipad map for a brief pre-deployment scene in a modern military tabletop RPG, with one unbranded utility helicopter ready for boarding.
Scene/backdrop: a fenced coastal-base aviation pad with one circular concrete landing area marked only by simple geometric safety rings and edge lights; a realistic dark matte military utility helicopter parked at center with rotor blades stopped, side doors visibly open and a readable boarding path; adjacent paved staging apron; compact roof-removed flight operations hut with small waiting room, blank desk, lockers and equipment bench; sheltered gear staging bay; fuel cabinet and hose reel; maintenance cart; fire-suppression cabinet; perimeter fencing; sliding vehicle gate; access road and short pedestrian route connecting to the base.
Subject: a clear, playable transition environment with the helicopter as the focal object, enough open floor for player tokens, a few sensible cover/interaction elements, and simple circulation; no characters.
Style/medium: realistic high-detail digital environment render, grounded contemporary military thriller art direction, crisp surfaces, original fictional facility and aircraft design, VTT-ready, readable at close zoom.
Composition/framing: strict 90-degree top-down bird's-eye orthographic view, zero isometric tilt and zero horizon; landscape 3:2 canvas; entire medium-small helipad facility fits comfortably inside frame; roof removed only from the operations hut; undistorted geometry and wide clear movement lanes.
Lighting/mood: blue-hour just before dawn; cool ambient light with restrained amber runway-edge and interior practical lights; calm, operational, anticipatory atmosphere; all walkable surfaces clearly visible.
Color palette: charcoal asphalt, cool gray concrete, dark desaturated navy/olive aircraft, muted tan utility structures, controlled amber lights.
Materials/textures: weathered concrete, tire scuffs, painted safety rings with no letters or numbers, metal fencing, rubber hoses, matte aircraft panels, subtle salt-air wear.
Constraints: original fictional helicopter, no branding or recognizable manufacturer-specific markings; helicopter may be a plausible generic twin-engine utility silhouette; clear open boarding areas; no baked-in grid; no text; no numbers; no letters; no helipad letter H; no signs; no flags; no insignia; no logos; no trademarks; no watermark; no UI; no frame; no tokens; no people; no bodies; no creatures; no weapons displayed.
Avoid: oblique camera, horizon, isometric perspective, fisheye, helicopter in flight, spinning rotor blur, crowded airfield, commercial airport styling, copied videogame layout, cartoon look, miniature diorama look, pitch-black surfaces.
```

### Zona de inserção

```text
Use case: stylized-concept
Asset type: original top-down VTT tactical battlemap for a private military RPG campaign
Primary request: Create the medium-size “Zona de Inserção”, a remote Afghan desert and rocky helicopter drop-off area at deep night, used as the team’s arrival point before a covert infiltration.
Scene/backdrop: Open arid terrain with wind-shaped sand, scattered gravel, low dunes, dry scrub and sparse thorn bushes. Include several large natural rock formations that create useful cover and believable chokepoints. A subtle disturbed circular patch of dust and faint landing marks indicate that a helicopter has just departed, without showing the aircraft. A winding dirt trail crosses the area and clearly leads toward the mission target beyond the map edge.
Style/medium: Highly detailed, grounded realistic military-thriller environment art, polished game battlemap, physically believable terrain and scale, original fictional design.
Composition/framing: Strict 90-degree overhead orthographic view with no visible horizon or sky, landscape 3:2 canvas, medium encounter scale. Keep all important terrain fully inside the frame. Create multiple readable tactical routes, open landing space, flanking paths and cover without clutter. No decorative frame or interface.
Lighting/mood: Very dark moonlit night, silent, isolated and tactical; cool blue-gray ambient moonlight, restrained warm earth undertones, long soft-edged shadows, very low artificial illumination, faint airborne dust, strong enough local contrast that routes and cover remain playable.
Color palette: Deep charcoal blue, muted slate, dusty tan, weathered brown and desaturated olive.
Materials/textures: Fine sand ripples, compacted dirt, rough fractured stone, gravel patches, dry vegetation and subtle rotor-wash dust.
Text: none.
Constraints: VTT-ready, one continuous playable terrain layer, consistent human-scale proportions, clear navigation, crisp readable surfaces when zoomed, no grid.
Avoid: people, soldiers, tokens, bodies, animals, helicopter or vehicles, buildings, modern signage, text, letters, numbers, logos, emblems, flags, trademarks, watermarks, borders, UI, perspective view, isometric view, horizon, sky, excessive cinematic darkness, fire, explosions, blood.
```

### Complexo industrial costeiro — área externa

```text
Use case: stylized-concept
Asset type: polished VTT tactical battlemap for a military RPG, 1536x1024 landscape
Primary request: Create an original large coastal industrial compound used as a covert hostile logistics site during a nighttime operation.
Scene/backdrop: a walled compound beside a dark secondary harbor, with a reinforced main gate, broad truck yard, parked unmarked cargo trucks, stacked shipping containers, pallets, wooden crates, concrete barriers, two small guard towers, perimeter fencing, floodlight poles, loading areas, warehouse roofs, a modest administrative building, seawall and a narrow strip of black water with a service pier.
Style/medium: highly detailed realistic digital environment art, grounded modern military-thriller atmosphere, physically believable materials, polished tabletop battlemap.
Composition/framing: strict 90-degree vertical bird's-eye orthographic view, landscape 3:2 ratio, the entire compound readable as one playable tactical map; clear vehicle lanes, patrol routes, cover positions and multiple approach paths; no perspective tilt, no horizon, no cropped playable edges.
Lighting/mood: deep night, dangerous and secretive; sparse cold moonlight mixed with pools of sodium-orange and cool industrial floodlight, long but readable shadows, slight coastal mist; all navigation surfaces remain legible for gameplay.
Color palette: charcoal concrete, weathered steel, muted rust-red, navy water, desaturated container colors, restrained amber and blue-white lights.
Materials/textures: cracked asphalt, oil stains, painted lane markings without letters or numbers, corrugated metal roofs, weathered containers, concrete walls, steel fencing, damp dock surfaces.
Constraints: completely original site design; no people, no soldiers, no bodies, no vehicles in motion, no tokens, no grid, no hexes, no labels, no interface, no title card; all trucks and props seen directly from above; keep enough open ground for miniature placement.
Avoid: any readable text, letters, numbers, logos, trademarks, flags, insignia, watermark, UI, isometric angle, perspective camera, horizon, daylight, fantasy or science-fiction elements.
```

### Complexo industrial costeiro — galpão principal

```text
Use case: stylized-concept
Asset type: polished VTT tactical battlemap for a military RPG, 1536x1024 landscape
Primary request: Create a companion interior map for the main warehouse of the exact same fictional coastal industrial compound shown in Image 1. Transform the large warehouse into a roof-removed cutaway and bring its playable interior close enough to fill most of the frame.
Input images: Image 1 is the visual, architectural, lighting and material reference for this same site; preserve its grounded realism, nighttime palette, corrugated-steel construction, loading-bay character and industrial wear, but do not simply reproduce the exterior overview.
Scene/backdrop: one cavernous main warehouse with several wide loading doors and small margins of the surrounding loading apron. Inside are organized freight lanes, stacks of wooden crates and pallets, sealed military-style storage crates and secure metal racks suggesting weapons storage without labels, two parked unmarked utility vehicles, a forklift, workshop benches, a small caged storage zone, support columns, a short office booth, and a partial overhead catwalk with stairs.
Style/medium: highly detailed realistic digital environment art, grounded modern military-thriller atmosphere, physically believable industrial architecture, polished tabletop battlemap.
Composition/framing: strict 90-degree vertical bird's-eye orthographic view, landscape 3:2 ratio, cutaway/roof removed cleanly with all rooms and routes visible; broad central confrontation space plus flanking cover, chokepoints and multiple paths; no perspective tilt, no horizon.
Lighting/mood: nighttime operation; dim cool industrial lamps with restrained amber work lights and readable tactical shadows; interior must remain clear enough for gameplay.
Color palette: charcoal concrete, dark corrugated steel, muted olive and rust, weathered timber, restrained amber and cool blue-white light.
Materials/textures: stained concrete floor, tire tracks, drainage channels, steel beams, corrugated walls, weathered crates, pallets, metal cages and painted safety markings without letters or numbers.
Constraints: same original site as Image 1; no people, no soldiers, no bodies, no tokens, no grid, no hexes, no labels, no interface, no title card; no roof obstructing the playable interior; props seen directly from above; leave enough traversable ground for miniature placement.
Avoid: any readable text, letters, numbers, logos, trademarks, flags, insignia, watermark, UI, isometric angle, perspective camera, horizon, daylight, fantasy or science-fiction elements.
```

### Complexo industrial costeiro — administração e controle

```text
Use case: stylized-concept
Asset type: polished VTT tactical battlemap for a military RPG, 1536x1024 landscape
Primary request: Create a companion interior map for the administrative and control building of the exact same fictional coastal industrial compound shown in Image 1, matching the visual quality and interior battlemap treatment of Image 2. Transform the small two-story-looking administrative footprint into a roof-removed playable cutaway and bring the building close enough to fill most of the frame.
Input images: Image 1 is the site, exterior architecture, nighttime lighting and material reference; Image 2 is the strict top-down cutaway, scale, realism and tactical-readability reference. Preserve the same fictional compound identity while creating a distinct office/control interior.
Scene/backdrop: compact but important operations building with a reception/security vestibule, connected corridors, several small offices, a central control room, communications room with radio consoles and equipment racks, modest server/utility room, archive and document room, briefing room with a table and blank maps/papers, break nook, restroom, stairwell, and two exterior access doors. Include a narrow perimeter apron and loading/service access around the cutaway.
Style/medium: highly detailed realistic digital environment art, grounded modern military-thriller atmosphere, physically believable worn office-industrial architecture, polished tabletop battlemap.
Composition/framing: strict 90-degree vertical bird's-eye orthographic view, landscape 3:2 ratio, roof removed cleanly; all rooms, doorways and routes visible; clear room separation, tactical chokepoints and alternate paths; no perspective tilt, no horizon.
Lighting/mood: nighttime covert operation; dim cool fluorescent ceiling pools and restrained amber emergency/work lights, readable tactical shadows, no cinematic darkness hiding playable floors.
Color palette: charcoal concrete, dark gray office flooring, muted olive furniture, weathered steel, restrained amber and cool blue-white light.
Materials/textures: stained tile and concrete, plaster walls, metal doors, cable trays, equipment racks, battered desks, blank papers and map-like sheets without readable markings, computer and radio consoles with dark or abstract non-text displays.
Constraints: same original site as Images 1 and 2; no people, no soldiers, no bodies, no tokens, no grid, no hexes, no labels, no interface, no title card; no roof obstructing the playable interior; all furniture and props seen directly from above; leave usable floor around desks and equipment for miniature placement.
Avoid: any readable text, letters, numbers, logos, trademarks, flags, insignia, watermark, UI, isometric angle, perspective camera, horizon, daylight, fantasy or science-fiction elements, neon cyberpunk styling.
```

### Safehouse urbano — rua e exterior

```text
Use case: stylized-concept
Asset type: polished landscape battlemap for a virtual tabletop, 1536x1024
Primary request: create an original, realistic 90-degree overhead map of a humble, discreet urban safehouse exterior in a small Afghan or Central Asian city at night. The building must look ordinary and indistinguishable from its neighbors, suitable for a tense covert military RPG scene.
Scene/backdrop: a compact concrete residential block on a narrow dusty street; one clearly readable safehouse lot with a simple flat-roofed house, low courtyard, perimeter walls, metal gate, small windows, a plain roof, adjacent modest buildings, narrow alleys, a few generic older civilian cars with no brand marks, one sparse streetlight, utility poles and dry urban dust.
Subject: the complete safehouse property and its immediate street approaches, designed as a playable tactical environment with multiple believable entry routes, wall cover, a small courtyard and readable door/gate positions.
Style/medium: high-detail realistic military-thriller environment art, grounded materials, premium VTT battlemap, not painterly, not isometric.
Composition/framing: strict true 90-degree top-down orthographic view, landscape 3:2 composition, entire property visible, north-up site-plan logic, consistent wall thicknesses and clear architecture; reserve the central lot footprint so later roof-removed interior layers can match it exactly.
Lighting/mood: deep night, tense, hidden and quiet; cool moonlight with restrained warm spill from the single streetlight and a few dim windows, readable gameplay contrast without bright daylight.
Color palette: dusty concrete beige, muted clay and charcoal, desaturated blue-black night shadows, small warm amber accents.
Materials/textures: worn poured concrete, dust, cracked pavement, corrugated metal gate, plaster, simple roofing, old car paint, dry dirt.
Constraints: fully original design; no grid; no people; no characters; no soldiers; no bodies; no tokens; no blood; no readable writing; no signs; no labels; no letters; no numbers; no logos; no trademarks; no watermark; no UI; no frame; no perspective tilt; no isometric angle.
```

### Safehouse urbano — térreo

```text
Use case: precise-object-edit
Asset type: polished landscape battlemap layer for a virtual tabletop, 1536x1024
Primary request: transform the referenced exterior safehouse map into the matching ground-floor interior layer. Remove only the roof of the central safehouse building and reveal a compact, believable, messy safehouse ground floor while preserving the exact site footprint, property walls, courtyard, street, neighboring buildings, camera, crop, orientation and access points.
Input images: Image 1 is the structural reference and edit target; keep its central lot, street, gate, exterior walls, neighboring buildings, lighting direction, scale and north-up orientation unchanged.
Scene/backdrop: the same humble Afghan or Central Asian residential block at night, with the central property shown as a clean roof-removed architectural cutaway.
Subject: inside the central L-shaped house, create a tight main living room, a simple kitchen, one small bathroom, a compact storage room, a narrow hall, a table covered with unmarked documents and maps with no readable text, a modest radio and computer station with blank screens, scattered supply crates and a clearly visible stair access descending to a basement. Keep the existing courtyard and metal gate usable.
Style/medium: high-detail realistic military-thriller environment art, grounded materials, premium VTT battlemap, not painterly, not isometric.
Composition/framing: strict true 90-degree top-down orthographic view; preserve the referenced image pixel composition and building outline as closely as possible; walls and doorways must be tactically readable; roof removed only from the central safehouse.
Lighting/mood: deep night, cramped, stuffy, dim, tense and improvised; muted warm practical lights inside with cool moonlight outdoors; readable gameplay contrast.
Color palette: dusty beige concrete, faded brown and olive furnishings, charcoal and desaturated blue-black shadows, restrained warm amber lamps.
Materials/textures: worn plaster, bare concrete, old rugs without lettering, cheap wood furniture, dusty tile, cables, plain metal shelves and anonymous equipment.
Constraints: preserve all exterior geometry and overall layout from Image 1; fully original interior; no grid; no people; no characters; no soldiers; no bodies; no tokens; no blood; no readable writing; no labels; no letters; no numbers; no logos; no trademarks; no watermark; no UI; no frame; no perspective tilt; no isometric angle.
```

### Safehouse urbano — porão oculto

```text
Use case: precise-object-edit
Asset type: polished landscape battlemap layer for a virtual tabletop, 1536x1024
Primary request: transform the referenced safehouse ground-floor map into the matching hidden basement layer. Replace only the revealed interior of the central safehouse with a believable compact subterranean plan while preserving the exact property footprint, street, courtyard, neighboring buildings, camera, crop, scale, orientation and all exterior geometry.
Input images: Image 1 is the structural reference and edit target; keep its central lot, perimeter walls, courtyard, metal gate, street, neighboring buildings, lighting direction, north-up orientation and pixel composition unchanged. Align the basement stair landing exactly beneath the existing stair access in the central house.
Scene/backdrop: the same humble Afghan or Central Asian residential block at night, with the hidden basement rendered as a clean roof-removed underground cutaway inside the central property; exterior surroundings remain dark and unchanged.
Subject: a tight improvised basement containing one rough sleeping room, a cramped storage chamber, a small communications nook with an old radio and computer on blank screens, a worktable covered in unmarked documents and maps with no readable text, stacked anonymous supply crates, several sealed armament crates, plain metal shelving, loose cables, utility pipes, a concealed material cache behind a movable shelf, and the aligned staircase back to the ground floor. Create narrow corridors, readable doorways and useful tactical cover without overcrowding.
Style/medium: high-detail realistic military-thriller environment art, grounded materials, premium VTT battlemap, not painterly, not isometric.
Composition/framing: strict true 90-degree top-down orthographic view; preserve the referenced image composition and central building outline as closely as possible; the underground walls must fit logically beneath the ground-floor footprint and the stair must register precisely.
Lighting/mood: dim, stuffy, secretive and improvised; sparse bare warm bulbs with deep cool shadows, readable gameplay contrast and no daylight.
Color palette: raw concrete gray, dusty brown, faded olive, rusted metal, charcoal shadows and restrained amber practical lights.
Materials/textures: unfinished concrete, worn plaster, exposed pipes, rough timber, old rugs without lettering, plain metal shelves, anonymous electronics and dusty sealed crates.
Constraints: preserve all exterior geometry and overall layout from Image 1; fully original basement; no grid; no people; no characters; no soldiers; no bodies; no tokens; no blood; no loose graphic weapon display; no readable writing; no labels; no letters; no numbers; no logos; no trademarks; no watermark; no UI; no frame; no perspective tilt; no isometric angle.
```
