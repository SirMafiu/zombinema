"""
Zombinema Office — Blender Structure Generator v3
===================================================
Based on real office plans and photos.
Open structure (no exterior walls).

LAYOUT (top view — Y goes up = back of building):

Y=10 ┌──────────┬────────┬──────────┐
     │ Salle de │   WC   │ Cuisine  │  ← pièces fermées (sous mezzanine)
     │ réunion  │        │          │
Y=7  ├──────────┴────────┴──────────┤  ← mur de séparation (avec portes)
     │                              │
     │                              │
     │        OPEN SPACE            │  ← double hauteur, RDC
     │        (ground floor)        │
     │                              │
     │                              │
Y=0  └──────────────────────────────┘
    X=0                           X=18

ETAGE (top view):

Y=10 ┌──────────────────────────────┐
     │        (au-dessus des        │
     │         3 pièces)            │
Y=7  ├─────────────┬────────────────┤
     │  ESCALIER   │   MEZZANINE    │
     │  (vide en   │   (ETAGE)      │
     │   dessous)  │                │
     │             │                │
Y=0  └─────────────┘                │
    X=0          X=8              X=18

Escalier: contre mur du fond (Y~7), monte de X=0 vers X=8
Mezzanine: X=8 à X=18, Y=0 à Y=10, à Z=3m

HOW TO USE: Blender → Scripting → Open → Run Script (Alt+P)
===================================================
"""

import bpy

# ─────────────────────────────────────────────
# UTILS
# ─────────────────────────────────────────────

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for mat in bpy.data.materials:
        bpy.data.materials.remove(mat)


def make_material(name, color_hex, roughness=0.9, metallic=0.0, emission=None, transmission=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    h = color_hex.lstrip('#')
    r, g, b = [int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4)]

    output = nodes.new('ShaderNodeOutputMaterial')

    if transmission > 0:
        bsdf = nodes.new('ShaderNodeBsdfPrincipled')
        bsdf.inputs['Base Color'].default_value = (r, g, b, 1)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        bsdf.inputs['Transmission Weight'].default_value = transmission
        bsdf.inputs['IOR'].default_value = 1.5
        links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    elif emission:
        emit = nodes.new('ShaderNodeEmission')
        eh = emission[0].lstrip('#')
        er, eg, eb = [int(eh[i:i+2], 16) / 255.0 for i in (0, 2, 4)]
        emit.inputs['Color'].default_value = (er, eg, eb, 1)
        emit.inputs['Strength'].default_value = emission[1]
        links.new(emit.outputs['Emission'], output.inputs['Surface'])
    else:
        bsdf = nodes.new('ShaderNodeBsdfPrincipled')
        bsdf.inputs['Base Color'].default_value = (r, g, b, 1)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    return mat


def add_box(name, location, dimensions, material):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (dimensions[0] / 2, dimensions[1] / 2, dimensions[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(material)
    return obj


def add_marker(name, location):
    """Small cube marker — exported in .glb, hidden by map-loader in Babylon.js."""
    bpy.ops.mesh.primitive_cube_add(location=location, size=0.3)
    obj = bpy.context.active_object
    obj.name = name
    obj.display_type = 'WIRE'  # wireframe in Blender for visibility
    return obj


# ─────────────────────────────────────────────
# MATERIALS
# ─────────────────────────────────────────────

def build_materials():
    return {
        'dark_concrete':  make_material('MAT_DarkConcrete',  '#1E1E1E', roughness=0.2),
        'white_plaster':  make_material('MAT_WhitePlaster',  '#F2F2F2', roughness=0.9),
        'oak_wood':       make_material('MAT_OakWood',       '#C68B3E', roughness=0.4),
        'steel':          make_material('MAT_Steel',         '#9E9E9E', roughness=0.3, metallic=1.0),
        'railing_steel':  make_material('MAT_RailingSteel',  '#C0C0C0', roughness=0.25, metallic=1.0),
        'led_cyan':       make_material('MAT_LED_Cyan',      '#000000', emission=('#00CFFF', 3.0)),
        'led_magenta':    make_material('MAT_LED_Magenta',   '#000000', emission=('#CC00FF', 3.0)),
        'led_white':      make_material('MAT_LED_White',     '#000000', emission=('#FFFFFF', 5.0)),
        'ceiling_white':  make_material('MAT_CeilingWhite',  '#EFEFEF', roughness=0.85),
        'gravel':         make_material('MAT_Gravel',        '#E8E4DC', roughness=0.95),
    }


# ─────────────────────────────────────────────
# FLOORS
# ─────────────────────────────────────────────

def build_floors(mats):
    # Ground floor — 50x50m centered on building (building is 18x10 at corner 0,0)
    add_box('floor_ground', (9, 5, -0.05), (50, 50, 0.1), mats['dark_concrete'])

    # Mezzanine — right half (X: 8-18), full depth (Y: 0-10), at Z=3m
    add_box('floor_upper', (13, 5, 2.95), (10, 10, 0.1), mats['dark_concrete'])

    # Gravel zone under staircase
    add_box('floor_gravel', (4, 6.5, 0.01), (6, 1.5, 0.02), mats['gravel'])


# ─────────────────────────────────────────────
# BACK ROOMS: Salle de réunion, WC, Cuisine
# Rooms are at the back (Y: 7-10), under the mezzanine
# ─────────────────────────────────────────────

def build_back_rooms(mats):
    W = 0.15    # wall thickness
    H = 3.0     # room height (ground to mezzanine floor)

    # ── Front wall of rooms (Y=7) with door openings ──

    # Salle de réunion door: X = 5.0 to 6.0 (1m wide, at the right end of the room,
    # past the staircase so people can actually enter — staircase is too low on the left)
    sr_door_start = 5.0
    sr_door_end = 6.0
    sr_door_h = 2.1

    # WC door: X = 8.0 to 9.0 (1m wide, single door)
    wc_door_start = 8.0
    wc_door_end = 9.0
    wc_door_h = 2.1

    # Cuisine opening: X = 13.0 to 15.5 (2.5m wide, double door opening)
    cu_door_start = 13.0
    cu_door_end = 15.5
    cu_door_h = 2.1

    # Front wall segments (Y=7, from left to right with gaps for doors)
    # Segment 1: X=0 to sr_door_start
    add_box('wall_front_rooms_1',
            (sr_door_start / 2, 7, H / 2),
            (sr_door_start, W, H),
            mats['white_plaster'])

    # Segment 2: sr_door_end to wc_door_start
    seg2_len = wc_door_start - sr_door_end
    add_box('wall_front_rooms_2',
            (sr_door_end + seg2_len / 2, 7, H / 2),
            (seg2_len, W, H),
            mats['white_plaster'])

    # Segment 3: wc_door_end to cu_door_start
    seg3_len = cu_door_start - wc_door_end
    add_box('wall_front_rooms_3',
            (wc_door_end + seg3_len / 2, 7, H / 2),
            (seg3_len, W, H),
            mats['white_plaster'])

    # Segment 4: cu_door_end to X=18
    seg4_len = 18 - cu_door_end
    add_box('wall_front_rooms_4',
            (cu_door_end + seg4_len / 2, 7, H / 2),
            (seg4_len, W, H),
            mats['white_plaster'])

    # Above salle de réunion door
    top_sr = H - sr_door_h
    add_box('wall_front_rooms_above_sr',
            ((sr_door_start + sr_door_end) / 2, 7, sr_door_h + top_sr / 2),
            (sr_door_end - sr_door_start, W, top_sr),
            mats['white_plaster'])

    # Above WC door
    top_wc = H - wc_door_h
    add_box('wall_front_rooms_above_wc',
            ((wc_door_start + wc_door_end) / 2, 7, wc_door_h + top_wc / 2),
            (wc_door_end - wc_door_start, W, top_wc),
            mats['white_plaster'])

    # Above cuisine opening
    top_cu = H - cu_door_h
    add_box('wall_front_rooms_above_cu',
            ((cu_door_start + cu_door_end) / 2, 7, cu_door_h + top_cu / 2),
            (cu_door_end - cu_door_start, W, top_cu),
            mats['white_plaster'])

    # ── Dividing walls between rooms (running Y: 7-10) ──

    # Wall between Salle de réunion and WC (X = 6)
    add_box('wall_room_div_1',
            (6, 8.5, H / 2),
            (W, 3, H),
            mats['white_plaster'])

    # Wall between WC and Cuisine (X = 12)
    add_box('wall_room_div_2',
            (12, 8.5, H / 2),
            (W, 3, H),
            mats['white_plaster'])


# ─────────────────────────────────────────────
# STAIRCASE — against back wall (Y~7), ascending left to right (X: 1→7)
# ─────────────────────────────────────────────

def build_staircase(mats):
    """
    Floating staircase: 15 treads from X=0.5 to X=8.0 (connects to mezzanine edge).
    Mezzanine is at Z=3m, so last tread lands at Z=3m at X=8.
    """
    num_steps = 15
    step_width = 1.2    # along Y axis (depth of tread)
    step_thick = 0.05

    stair_y = 6.2       # in front of back wall
    stair_x_start = 0.5
    stair_x_end = 8.0   # meets the mezzanine edge

    total_run = stair_x_end - stair_x_start
    step_length = total_run / num_steps  # ~0.5m per step
    step_rise = 3.0 / num_steps          # 0.2m per step

    for i in range(num_steps):
        x = stair_x_start + i * step_length + step_length / 2
        z = (i + 1) * step_rise
        add_box(
            f'stair_tread_{i:02d}',
            (x, stair_y, z),
            (step_length, step_width, step_thick),
            mats['oak_wood']
        )

    # Steel stringers (front and back)
    mid_x = stair_x_start + total_run / 2
    mid_z = 3.0 / 2
    for label, y_off in [('front', -0.55), ('back', 0.55)]:
        add_box(
            f'stair_stringer_{label}',
            (mid_x, stair_y + y_off, mid_z),
            (total_run + 0.2, 0.06, 0.10),
            mats['steel']
        )


# Railings removed — staircase has treads + stringers only


# ─────────────────────────────────────────────
# CEILING & LEDs (above mezzanine zone only)
# ─────────────────────────────────────────────

def build_ceiling(mats):
    # Ceiling over mezzanine at Z=6m
    add_box('ceiling_mezzanine', (13, 5, 6.0), (10, 10, 0.1), mats['ceiling_white'])

    # False ceiling strip along mezzanine open edge
    add_box('ceiling_false_strip', (8.0, 3.5, 5.65), (0.8, 7, 0.05), mats['ceiling_white'])

    # LED strips
    add_box('led_strip_cyan',    (7.6, 3.5, 5.68), (0.04, 7, 0.02), mats['led_cyan'])
    add_box('led_strip_magenta', (8.4, 3.5, 5.62), (0.04, 7, 0.02), mats['led_magenta'])

    # LED panels on mezzanine ceiling
    for px in [10, 12, 14, 16]:
        for py in [2, 5, 8]:
            add_box(f'led_panel_{px}_{py}',
                    (px, py, 5.98), (0.6, 0.6, 0.01), mats['led_white'])


# ─────────────────────────────────────────────
# GAME MARKERS
# ─────────────────────────────────────────────

def build_game_markers():
    # Player start — center of open space
    add_marker('player_start', (4, 3, 0))

    # Enemy spawns
    add_marker('spawn_ground_front_left', (2, 1, 0))
    add_marker('spawn_ground_front_right', (6, 1, 0))
    add_marker('spawn_salle_reunion', (3, 8.5, 0))
    add_marker('spawn_cuisine', (15, 8.5, 0))
    add_marker('spawn_mezzanine_center', (13, 5, 3))
    add_marker('spawn_mezzanine_back', (15, 8, 3))

    # Power-ups
    add_marker('powerup_under_stairs', (3, 6, 0))
    add_marker('powerup_mezzanine', (16, 2, 3))


# ─────────────────────────────────────────────
# CAMERA & LIGHTS
# ─────────────────────────────────────────────

def setup_camera_and_lights():
    bpy.ops.object.camera_add(location=(9, -15, 10))
    cam = bpy.context.active_object
    cam.rotation_euler = (1.05, 0, 0)
    bpy.context.scene.camera = cam

    bpy.ops.object.light_add(type='SUN', location=(9, 5, 15))
    sun = bpy.context.active_object
    sun.data.energy = 3.0
    sun.rotation_euler = (0.5, 0.2, 0)

    bpy.ops.object.light_add(type='AREA', location=(4, 3, 5.5))
    area = bpy.context.active_object
    area.data.energy = 500
    area.data.size = 6

    bpy.ops.object.light_add(type='AREA', location=(13, 5, 5.5))
    area2 = bpy.context.active_object
    area2.data.energy = 300
    area2.data.size = 5


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    print("── Zombinema Office Generator v3 ──")
    clear_scene()

    mats = build_materials()
    print("[OK] Materials")

    build_floors(mats)
    print("[OK] Floors (ground + mezzanine)")

    build_back_rooms(mats)
    print("[OK] Back rooms (salle de reunion + WC + cuisine) — walls & openings only")

    build_staircase(mats)
    print("[OK] Staircase (15 treads, left→right against back wall)")

    print("[--] Railings removed")

    build_ceiling(mats)
    print("[OK] Ceiling + LEDs")

    build_game_markers()
    print("[OK] Game markers")

    setup_camera_and_lights()
    print("[OK] Camera & lights")

    bpy.context.scene.render.engine = 'CYCLES'
    bpy.context.scene.cycles.samples = 128

    print(f"\n{'='*45}")
    print(f"  Generated! ({len(bpy.data.objects)} objects)")
    print(f"  Open space: Y=0-7 (double height)")
    print(f"  Back rooms: Y=7-10 (salle réunion|WC|cuisine)")
    print(f"  Mezzanine: X=8-18, Z=3m")
    print(f"  Staircase: X=0.5-6.5, Y~6.2, left→right")
    print(f"{'='*45}")


main()
